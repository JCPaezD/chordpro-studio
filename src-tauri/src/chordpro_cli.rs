use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
  collections::BTreeSet,
  ffi::OsString,
  fs,
  io,
  path::{Path, PathBuf},
  process::Command,
  sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
  },
};
use tauri::{path::BaseDirectory, AppHandle, Manager, State};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const PREVIEW_CHO_FILENAME: &str = "preview.cho";
const PREVIEW_PDF_FILENAME: &str = "preview.pdf";
const EXPORT_CHO_FILENAME: &str = "export.cho";
const PREVIEW_CACHE_FOLDER: &str = "cache/previews";
const DEFAULT_SINGLE_COLUMN_TAB_MAX_CHARS: usize = 70;
const DEFAULT_MULTI_COLUMN_TAB_MAX_CHARS: usize = 35;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Default)]
pub struct PreviewExecutionState {
  latest_request_id: AtomicU64,
  execution_lock: Mutex<()>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChordProCommandError {
  pub code: String,
  pub message: String,
  pub stdout: Option<String>,
  pub stderr: Option<String>,
  pub details: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
  pub pdf_path: String,
  pub pdf_base64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPdfResponse {
  pub output_path: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RenderStyleOptions {
  pub show_chord_diagrams: bool,
  pub instrument: DiagramInstrument,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DiagramInstrument {
  Guitar,
  Piano,
  Ukulele,
}

impl Default for DiagramInstrument {
  fn default() -> Self {
    Self::Piano
  }
}

impl Default for RenderStyleOptions {
  fn default() -> Self {
    Self {
      show_chord_diagrams: true,
      instrument: DiagramInstrument::Piano,
    }
  }
}

#[tauri::command]
pub async fn generate_preview(
  app: AppHandle,
  preview_execution_state: State<'_, Arc<PreviewExecutionState>>,
  chordpro_text: String,
  bypass_cache: bool,
  render_style: Option<RenderStyleOptions>,
  file_name: Option<String>,
) -> Result<PreviewResponse, ChordProCommandError> {
  let request_id = preview_execution_state
    .latest_request_id
    .fetch_add(1, Ordering::SeqCst)
    + 1;
  let render_style = render_style.unwrap_or_default();
  let rendered_chordpro_text =
    preprocess_chordpro_for_render(&chordpro_text, &render_style, file_name.as_deref());
  let cache_path = preview_cache_file_path(&app, &rendered_chordpro_text, &render_style)?;

  if !bypass_cache {
    if let Some(cached_pdf_bytes) = read_valid_cached_preview(&cache_path) {
      return Ok(PreviewResponse {
        pdf_path: cache_path.to_string_lossy().into_owned(),
        pdf_base64: STANDARD.encode(cached_pdf_bytes),
      });
    }
  }

  let preview_execution_state = Arc::clone(preview_execution_state.inner());
  let preview = tauri::async_runtime::spawn_blocking(move || {
    let _execution_guard = preview_execution_state
      .execution_lock
      .lock()
      .map_err(|_| preview_lock_error())?;

    ensure_preview_request_is_latest(&preview_execution_state, request_id)?;
    let preview =
      generate_preview_uncached(&app, &rendered_chordpro_text, &render_style, &cache_path)?;
    ensure_preview_request_is_latest(&preview_execution_state, request_id)?;
    Ok(preview)
  })
  .await
  .map_err(|error| ChordProCommandError {
    code: "PREVIEW_TASK_JOIN_ERROR".into(),
    message: format!("Preview generation task failed: {error}"),
    stdout: None,
    stderr: None,
    details: None,
  })??;

  Ok(preview)
}

fn generate_preview_uncached(
  app: &AppHandle,
  rendered_chordpro_text: &str,
  render_style: &RenderStyleOptions,
  cache_path: &Path,
) -> Result<PreviewResponse, ChordProCommandError> {
  let preview_dir = ensure_preview_dir(app)?;
  let input_path = preview_dir.join(PREVIEW_CHO_FILENAME);
  let output_path = preview_dir.join(PREVIEW_PDF_FILENAME);

  if output_path.exists() {
    fs::remove_file(&output_path).map_err(|error| ChordProCommandError {
      code: "PREVIEW_RESET_ERROR".into(),
      message: format!("Failed to reset the previous preview PDF: {error}"),
      stdout: None,
      stderr: None,
      details: Some(output_path.to_string_lossy().into_owned()),
    })?;
  }

  write_text_file(&input_path, rendered_chordpro_text)?;
  run_chordpro_command(
    app,
    [
      input_path.as_os_str(),
      "--output".as_ref(),
      output_path.as_os_str(),
    ],
    render_style,
  )?;

  let generated_pdf_bytes = fs::read(&output_path).map_err(|error| ChordProCommandError {
    code: "PREVIEW_READ_ERROR".into(),
    message: format!("Failed to read generated preview PDF: {error}"),
    stdout: None,
    stderr: None,
    details: Some(output_path.to_string_lossy().into_owned()),
  })?;

  let response_path = if write_preview_cache_file(cache_path, &generated_pdf_bytes).is_ok() {
    cache_path.to_path_buf()
  } else {
    output_path
  };

  Ok(PreviewResponse {
    pdf_path: response_path.to_string_lossy().into_owned(),
    pdf_base64: STANDARD.encode(generated_pdf_bytes),
  })
}

fn ensure_preview_request_is_latest(
  preview_execution_state: &PreviewExecutionState,
  request_id: u64,
) -> Result<(), ChordProCommandError> {
  if preview_execution_state.latest_request_id.load(Ordering::SeqCst) == request_id {
    return Ok(());
  }

  Err(ChordProCommandError {
    code: "PREVIEW_SUPERSEDED".into(),
    message: "Preview request was superseded by a newer one.".into(),
    stdout: None,
    stderr: None,
    details: None,
  })
}

fn preview_lock_error() -> ChordProCommandError {
  ChordProCommandError {
    code: "PREVIEW_LOCK_ERROR".into(),
    message: "Preview execution state became unavailable.".into(),
    stdout: None,
    stderr: None,
    details: None,
  }
}
#[tauri::command]
pub fn export_pdf(
  app: AppHandle,
  chordpro_text: String,
  output_path: String,
  render_style: Option<RenderStyleOptions>,
  file_name: Option<String>,
) -> Result<ExportPdfResponse, ChordProCommandError> {
  let cache_dir = ensure_preview_dir(&app)?;
  let input_path = cache_dir.join(EXPORT_CHO_FILENAME);
  let output_path = PathBuf::from(output_path);
  let render_style = render_style.unwrap_or_default();
  let rendered_chordpro_text =
    preprocess_chordpro_for_render(&chordpro_text, &render_style, file_name.as_deref());

  ensure_output_directory(&output_path)?;

  write_text_file(&input_path, &rendered_chordpro_text)?;
  run_chordpro_command(
    &app,
    [
      input_path.as_os_str(),
      "--output".as_ref(),
      output_path.as_os_str(),
    ],
    &render_style,
  )?;

  Ok(ExportPdfResponse {
    output_path: output_path.to_string_lossy().into_owned(),
  })
}

#[tauri::command]
pub fn export_songbook_pdf(
  app: AppHandle,
  input_paths: Vec<String>,
  output_path: String,
  render_style: Option<RenderStyleOptions>,
) -> Result<ExportPdfResponse, ChordProCommandError> {
  if input_paths.is_empty() {
    return Err(ChordProCommandError {
      code: "NO_INPUT_FILES".into(),
      message: "No songs found.".into(),
      stdout: None,
      stderr: None,
      details: None,
    });
  }

  let output_path = PathBuf::from(output_path);
  ensure_output_directory(&output_path)?;

  let preview_dir = ensure_preview_dir(&app)?;
  let render_style = render_style.unwrap_or_default();
  let prepared_input_paths = prepare_songbook_render_inputs(&preview_dir, &input_paths, &render_style)?;
  let mut args: Vec<OsString> = prepared_input_paths
    .iter()
    .map(|path| path.as_os_str().to_os_string())
    .collect();
  args.push(OsString::from("--output"));
  args.push(output_path.as_os_str().to_os_string());

  run_chordpro_command(&app, args, &render_style)?;

  Ok(ExportPdfResponse {
    output_path: output_path.to_string_lossy().into_owned(),
  })
}

fn ensure_preview_dir(app: &AppHandle) -> Result<PathBuf, ChordProCommandError> {
  let cache_dir = app
    .path()
    .app_cache_dir()
    .map_err(|error| ChordProCommandError {
      code: "CACHE_DIRECTORY_ERROR".into(),
      message: format!("Failed to resolve application cache directory: {error}"),
      stdout: None,
      stderr: None,
      details: None,
    })?
    .join("preview");

  fs::create_dir_all(&cache_dir).map_err(|error| ChordProCommandError {
    code: "CACHE_DIRECTORY_ERROR".into(),
    message: format!("Failed to prepare preview cache directory: {error}"),
    stdout: None,
    stderr: None,
    details: Some(cache_dir.to_string_lossy().into_owned()),
  })?;

  Ok(cache_dir)
}

fn prepare_songbook_render_inputs(
  preview_dir: &Path,
  input_paths: &[String],
  render_style: &RenderStyleOptions,
) -> Result<Vec<PathBuf>, ChordProCommandError> {
  let rendered_inputs_dir = preview_dir.join("songbook-export-inputs");

  if rendered_inputs_dir.exists() {
    fs::remove_dir_all(&rendered_inputs_dir).map_err(|error| ChordProCommandError {
      code: "CACHE_DIRECTORY_ERROR".into(),
      message: format!("Failed to reset songbook export input directory: {error}"),
      stdout: None,
      stderr: None,
      details: Some(rendered_inputs_dir.to_string_lossy().into_owned()),
    })?;
  }

  fs::create_dir_all(&rendered_inputs_dir).map_err(|error| ChordProCommandError {
    code: "CACHE_DIRECTORY_ERROR".into(),
    message: format!("Failed to prepare songbook export input directory: {error}"),
    stdout: None,
    stderr: None,
    details: Some(rendered_inputs_dir.to_string_lossy().into_owned()),
  })?;

  let mut prepared_input_paths = Vec::with_capacity(input_paths.len());

  for (index, input_path) in input_paths.iter().enumerate() {
    let source_path = PathBuf::from(input_path);
    let chordpro_text = fs::read_to_string(&source_path).map_err(|error| ChordProCommandError {
      code: "FILE_READ_ERROR".into(),
      message: format!("Failed to read songbook source file: {error}"),
      stdout: None,
      stderr: None,
      details: Some(source_path.to_string_lossy().into_owned()),
    })?;
    let source_file_name = source_path.file_name().and_then(|value| value.to_str());
    let rendered_chordpro_text =
      preprocess_chordpro_for_render(&chordpro_text, render_style, source_file_name);
    let rendered_input_path = rendered_inputs_dir.join(format!("{:03}-render.cho", index + 1));

    write_text_file(&rendered_input_path, &rendered_chordpro_text)?;
    prepared_input_paths.push(rendered_input_path);
  }

  Ok(prepared_input_paths)
}

fn ensure_preview_cache_dir(app: &AppHandle) -> Result<PathBuf, ChordProCommandError> {
  let cache_dir = app
    .path()
    .app_config_dir()
    .map_err(|error| ChordProCommandError {
      code: "CACHE_DIRECTORY_ERROR".into(),
      message: format!("Failed to resolve application config directory: {error}"),
      stdout: None,
      stderr: None,
      details: None,
    })?
    .join(PREVIEW_CACHE_FOLDER);

  fs::create_dir_all(&cache_dir).map_err(|error| ChordProCommandError {
    code: "CACHE_DIRECTORY_ERROR".into(),
    message: format!("Failed to prepare preview cache directory: {error}"),
    stdout: None,
    stderr: None,
    details: Some(cache_dir.to_string_lossy().into_owned()),
  })?;

  Ok(cache_dir)
}

fn preview_cache_file_path(
  app: &AppHandle,
  chordpro_text: &str,
  render_style: &RenderStyleOptions,
) -> Result<PathBuf, ChordProCommandError> {
  let cache_dir = ensure_preview_cache_dir(app)?;
  let cache_key = hash_preview_input(chordpro_text, render_style);
  Ok(cache_dir.join(format!("{cache_key}.pdf")))
}

fn hash_preview_input(chordpro_text: &str, render_style: &RenderStyleOptions) -> String {
  let mut hasher = Sha256::new();
  hasher.update(chordpro_text.as_bytes());
  hasher.update(b"\n--render-style--\n");
  let instrument_signature: &[u8] = match render_style.instrument {
    DiagramInstrument::Guitar => b"instrument:guitar",
    DiagramInstrument::Piano => b"instrument:piano",
    DiagramInstrument::Ukulele => b"instrument:ukulele",
  };
  let diagrams_signature: &[u8] = if render_style.show_chord_diagrams {
    b"showChordDiagrams:true"
  } else {
    b"showChordDiagrams:false"
  };
  hasher.update(instrument_signature);
  hasher.update(b"\n");
  hasher.update(diagrams_signature);

  hasher
    .finalize()
    .iter()
    .map(|byte| format!("{byte:02x}"))
    .collect()
}

fn read_valid_cached_preview(cache_path: &Path) -> Option<Vec<u8>> {
  let metadata = fs::metadata(cache_path).ok()?;
  if !metadata.is_file() || metadata.len() == 0 {
    return None;
  }

  let bytes = fs::read(cache_path).ok()?;
  if bytes.is_empty() || !bytes.starts_with(b"%PDF-") {
    return None;
  }

  Some(bytes)
}

fn write_preview_cache_file(cache_path: &Path, pdf_bytes: &[u8]) -> io::Result<()> {
  if pdf_bytes.is_empty() {
    return Err(io::Error::new(io::ErrorKind::InvalidData, "Preview PDF is empty."));
  }

  if let Some(parent) = cache_path.parent() {
    fs::create_dir_all(parent)?;
  }

  let mut temporary_path = cache_path.to_path_buf();
  temporary_path.set_extension("pdf.tmp");

  if temporary_path.exists() {
    let _ = fs::remove_file(&temporary_path);
  }

  fs::write(&temporary_path, pdf_bytes)?;

  if cache_path.exists() {
    let _ = fs::remove_file(cache_path);
  }

  fs::rename(&temporary_path, cache_path)?;
  Ok(())
}

fn preprocess_chordpro_for_render(
  chordpro_text: &str,
  render_style: &RenderStyleOptions,
  file_name: Option<&str>,
) -> String {
  let rendered = std::panic::catch_unwind(|| preprocess_chordpro_for_render_inner(chordpro_text))
    .ok()
    .and_then(Result::ok)
    .unwrap_or_else(|| fallback_to_single_column(chordpro_text));
  let rendered = inject_derived_title_if_missing(&rendered, file_name);

  if render_style.instrument == DiagramInstrument::Ukulele && render_style.show_chord_diagrams {
    return inject_ukulele_enharmonic_aliases(&rendered);
  }

  rendered
}

fn preprocess_chordpro_for_render_inner(chordpro_text: &str) -> Result<String, ()> {
  let newline = if chordpro_text.contains("\r\n") { "\r\n" } else { "\n" };
  let normalized = chordpro_text.replace("\r\n", "\n");
  let had_trailing_newline = normalized.ends_with('\n');
  let mut output_lines = Vec::new();
  let mut current_columns = 1usize;
  let mut tab_lines = Vec::new();
  let mut in_tab_block = false;

  for line in normalized.lines() {
    let trimmed = line.trim();

    if in_tab_block {
      if is_tab_end(trimmed) {
        output_lines.extend(split_tab_block(&tab_lines, current_columns)?);
        tab_lines.clear();
        in_tab_block = false;
      } else if is_tab_start(trimmed) {
        return Err(());
      } else {
        tab_lines.push(line.to_string());
      }

      continue;
    }

    if is_tab_start(trimmed) {
      in_tab_block = true;
      tab_lines.clear();
      continue;
    }

    if let Some(columns) = parse_columns_directive(trimmed) {
      current_columns = columns;
    }

    output_lines.push(line.to_string());
  }

  if in_tab_block {
    return Err(());
  }

  let mut rendered = output_lines.join("\n");
  if had_trailing_newline {
    rendered.push('\n');
  }

  if newline == "\r\n" {
    rendered = rendered.replace('\n', "\r\n");
  }

  Ok(rendered)
}

fn inject_derived_title_if_missing(chordpro_text: &str, file_name: Option<&str>) -> String {
  if extract_metadata_directive_value(chordpro_text, "title").is_some() {
    return chordpro_text.to_string();
  }

  let newline = if chordpro_text.contains("\r\n") { "\r\n" } else { "\n" };
  let derived_title = derive_display_title(chordpro_text, file_name);
  format!("{{title: {derived_title}}}{newline}{chordpro_text}")
}

fn derive_display_title(chordpro_text: &str, file_name: Option<&str>) -> String {
  if let Some(title) = extract_metadata_directive_value(chordpro_text, "title") {
    return title;
  }

  let artist = extract_metadata_directive_value(chordpro_text, "artist");
  let mut in_tab_block = false;

  for raw_line in chordpro_text.replace("\r\n", "\n").lines() {
    let trimmed = raw_line.trim();

    if trimmed.is_empty() {
      continue;
    }

    if is_tab_start(trimmed) {
      in_tab_block = true;
      continue;
    }

    if is_tab_end(trimmed) {
      in_tab_block = false;
      continue;
    }

    if in_tab_block || is_directive_line(trimmed) {
      continue;
    }

    let lyric_candidate = normalize_whitespace(&strip_chord_tokens(raw_line));
    if lyric_candidate.is_empty() || !contains_letter(&lyric_candidate) {
      continue;
    }

    return lyric_candidate;
  }

  if let Some(artist_name) = artist.filter(|value| !value.trim().is_empty()) {
    return artist_name;
  }

  let fallback_name = file_name
    .map(strip_file_extension)
    .filter(|value| !value.is_empty());

  fallback_name.unwrap_or_else(|| "Untitled".into())
}

fn extract_metadata_directive_value(chordpro_text: &str, key: &str) -> Option<String> {
  chordpro_text.lines().find_map(|line| {
    let trimmed = line.trim();
    let inner = trimmed.strip_prefix('{')?.strip_suffix('}')?;
    let (directive_key, directive_value) = inner.split_once(':')?;
    if !directive_key.trim().eq_ignore_ascii_case(key) {
      return None;
    }

    let normalized_value = directive_value.trim();
    if normalized_value.is_empty() {
      None
    } else {
      Some(normalized_value.to_string())
    }
  })
}

fn is_directive_line(line: &str) -> bool {
  line.starts_with('{') && line.ends_with('}')
}

fn strip_chord_tokens(line: &str) -> String {
  let mut output = String::with_capacity(line.len());
  let mut in_chord = false;

  for character in line.chars() {
    match character {
      '[' => in_chord = true,
      ']' => {
        in_chord = false;
        output.push(' ');
      }
      _ if !in_chord => output.push(character),
      _ => {}
    }
  }

  output
}

fn normalize_whitespace(value: &str) -> String {
  value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn contains_letter(value: &str) -> bool {
  value.chars().any(|character| character.is_alphabetic())
}

fn strip_file_extension(file_name: &str) -> String {
  let trimmed_name = file_name.trim();
  if trimmed_name.is_empty() {
    return String::new();
  }

  Path::new(trimmed_name)
    .file_stem()
    .and_then(|stem| stem.to_str())
    .unwrap_or(trimmed_name)
    .trim()
    .to_string()
}

fn inject_ukulele_enharmonic_aliases(chordpro_text: &str) -> String {
  let newline = if chordpro_text.contains("\r\n") { "\r\n" } else { "\n" };
  let defined_chords = collect_defined_chord_names(chordpro_text);
  let alias_definitions = collect_used_chord_names(chordpro_text)
    .into_iter()
    .filter_map(|chord_name| {
      if defined_chords.contains(&chord_name) {
        return None;
      }

      let alias_target = enharmonic_ukulele_alias_target(&chord_name)?;
      Some(format!("{{define: {chord_name} copy {alias_target}}}"))
    })
    .collect::<Vec<_>>();

  if alias_definitions.is_empty() {
    return chordpro_text.to_string();
  }

  let mut rendered = alias_definitions.join(newline);
  rendered.push_str(newline);
  rendered.push_str(chordpro_text);
  rendered
}

fn collect_defined_chord_names(chordpro_text: &str) -> BTreeSet<String> {
  chordpro_text
    .lines()
    .filter_map(|line| {
      let trimmed = line.trim();
      let definition = trimmed.strip_prefix("{define:")?.strip_suffix('}')?.trim();
      let chord_name = definition.split_whitespace().next()?.trim();
      if chord_name.is_empty() {
        return None;
      }
      Some(chord_name.to_string())
    })
    .collect()
}

fn collect_used_chord_names(chordpro_text: &str) -> BTreeSet<String> {
  let mut chord_names = BTreeSet::new();

  for line in chordpro_text.lines() {
    let mut remainder = line;
    while let Some(start) = remainder.find('[') {
      let chord_start = start + 1;
      let segment = &remainder[chord_start..];
      let Some(end) = segment.find(']') else {
        break;
      };
      let chord_name = segment[..end].trim();
      if !chord_name.is_empty() && !chord_name.starts_with('*') {
        chord_names.insert(chord_name.to_string());
      }
      remainder = &segment[end + 1..];
    }
  }

  chord_names
}

fn enharmonic_ukulele_alias_target(chord_name: &str) -> Option<String> {
  let (primary, bass) = chord_name.split_once('/').map_or((chord_name, None), |(head, tail)| {
    (head, Some(tail))
  });

  let mapped_primary = map_sharp_root_to_flat(primary)?;
  let mut mapped_chord = mapped_primary;

  if let Some(bass_name) = bass {
    let mapped_bass = map_sharp_root_to_flat(bass_name).unwrap_or_else(|| bass_name.to_string());
    mapped_chord.push('/');
    mapped_chord.push_str(&mapped_bass);
  }

  if mapped_chord == chord_name {
    None
  } else {
    Some(mapped_chord)
  }
}

fn map_sharp_root_to_flat(chord_name: &str) -> Option<String> {
  let mut chars = chord_name.chars();
  let root_letter = chars.next()?;
  if !matches!(root_letter, 'A'..='G') {
    return None;
  }

  let remaining = chars.as_str();
  let suffix = remaining.strip_prefix('#')?;
  let flat_root = match root_letter {
    'A' => "Bb",
    'C' => "Db",
    'D' => "Eb",
    'F' => "Gb",
    'G' => "Ab",
    _ => return None,
  };

  Some(format!("{flat_root}{suffix}"))
}

fn split_tab_block(tab_lines: &[String], columns: usize) -> Result<Vec<String>, ()> {
  let mut groups: Vec<Vec<String>> = Vec::new();
  let mut current_group = Vec::new();

  for line in tab_lines {
    if line.trim().is_empty() {
      if !current_group.is_empty() {
        groups.push(current_group);
        current_group = Vec::new();
      }
      continue;
    }

    current_group.push(line.clone());
  }

  if !current_group.is_empty() {
    groups.push(current_group);
  }

  if groups.is_empty() {
    return Err(());
  }

  let mut split_blocks = Vec::new();

  for group in groups {
    if !split_blocks.is_empty() {
      split_blocks.push(String::new());
    }

    split_blocks.extend(split_tab_line_group(&group, columns)?);
  }

  Ok(split_blocks)
}

fn split_tab_line_group(tab_lines: &[String], columns: usize) -> Result<Vec<String>, ()> {
  let max_chars = max_chars_for_columns(columns);
  let max_line_length = tab_lines
    .iter()
    .map(|line| line.chars().count())
    .max()
    .unwrap_or_default();

  if max_line_length == 0 {
    return Err(());
  }

  if max_line_length <= max_chars {
    let mut original_block = Vec::with_capacity(tab_lines.len() + 2);
    original_block.push("{start_of_tab}".into());
    original_block.extend(tab_lines.iter().cloned());
    original_block.push("{end_of_tab}".into());
    return Ok(original_block);
  }

  let normalized_lines: Vec<Vec<char>> = tab_lines
    .iter()
    .map(|line| {
      let mut chars: Vec<char> = line.chars().collect();
      while chars.len() < max_line_length {
        chars.push(' ');
      }
      chars
    })
    .collect();

  let chunk_count = max_line_length.div_ceil(max_chars);
  let base_chunk_width = max_line_length / chunk_count;
  let wider_chunk_count = max_line_length % chunk_count;

  let mut split_blocks = Vec::new();
  let mut chunk_start = 0usize;

  for chunk_index in 0..chunk_count {
    if !split_blocks.is_empty() {
      split_blocks.push(String::new());
    }

    let chunk_width = base_chunk_width + usize::from(chunk_index < wider_chunk_count);
    let chunk_end = chunk_start + chunk_width;
    split_blocks.push("{start_of_tab}".into());

    for line_chars in &normalized_lines {
      let chunk: String = line_chars[chunk_start..chunk_end].iter().collect();
      split_blocks.push(chunk.trim_end_matches(' ').to_string());
    }

    split_blocks.push("{end_of_tab}".into());
    chunk_start = chunk_end;
  }

  Ok(split_blocks)
}

fn max_chars_for_columns(columns: usize) -> usize {
  match columns {
    2 => DEFAULT_MULTI_COLUMN_TAB_MAX_CHARS,
    1 => DEFAULT_SINGLE_COLUMN_TAB_MAX_CHARS,
    _ => DEFAULT_SINGLE_COLUMN_TAB_MAX_CHARS,
  }
}

fn fallback_to_single_column(chordpro_text: &str) -> String {
  let newline = if chordpro_text.contains("\r\n") { "\r\n" } else { "\n" };
  let normalized = chordpro_text.replace("\r\n", "\n");
  let had_trailing_newline = normalized.ends_with('\n');
  let mut output_lines = Vec::new();

  for line in normalized.lines() {
    if parse_columns_directive(line.trim()) == Some(2) {
      output_lines.push("{columns: 1}".to_string());
    } else {
      output_lines.push(line.to_string());
    }
  }

  let mut rendered = output_lines.join("\n");
  if had_trailing_newline {
    rendered.push('\n');
  }

  if newline == "\r\n" {
    rendered = rendered.replace('\n', "\r\n");
  }

  rendered
}

fn parse_columns_directive(line: &str) -> Option<usize> {
  let directive = line.strip_prefix('{')?.strip_suffix('}')?.trim();
  let (name, value) = directive.split_once(':')?;

  if !name.trim().eq_ignore_ascii_case("columns") {
    return None;
  }

  value.trim().parse().ok()
}

fn is_tab_start(line: &str) -> bool {
  is_directive(line, "start_of_tab") || is_directive(line, "sot") || is_directive(line, "tab")
}

fn is_tab_end(line: &str) -> bool {
  is_directive(line, "end_of_tab")
}

fn is_directive(line: &str, expected: &str) -> bool {
  line
    .strip_prefix('{')
    .and_then(|value| value.strip_suffix('}'))
    .map(|value| value.trim().eq_ignore_ascii_case(expected))
    .unwrap_or(false)
}
fn ensure_output_directory(output_path: &Path) -> Result<(), ChordProCommandError> {
  if let Some(parent) = output_path.parent() {
    fs::create_dir_all(parent).map_err(|error| ChordProCommandError {
      code: "OUTPUT_DIRECTORY_ERROR".into(),
      message: format!("Failed to prepare output directory: {error}"),
      stdout: None,
      stderr: None,
      details: Some(parent.to_string_lossy().into_owned()),
    })?;
  }

  Ok(())
}

fn write_text_file(path: &Path, contents: &str) -> Result<(), ChordProCommandError> {
  fs::write(path, contents).map_err(|error| ChordProCommandError {
    code: "FILE_WRITE_ERROR".into(),
    message: format!("Failed to write temporary file: {error}"),
    stdout: None,
    stderr: None,
    details: Some(path.to_string_lossy().into_owned()),
  })
}

fn append_render_style_args(command_args: &mut Vec<OsString>, render_style: &RenderStyleOptions) {
  match render_style.instrument {
    DiagramInstrument::Guitar => {
      command_args.push(OsString::from("--define=instrument.type=guitar"));
    }
    DiagramInstrument::Piano => {
      command_args.push(OsString::from("--define=instrument.type=keyboard"));
    }
    DiagramInstrument::Ukulele => {
      command_args.push(OsString::from("--define=instrument.type=ukulele"));
    }
  }

  if render_style.show_chord_diagrams {
    return;
  }

  command_args.push(OsString::from("--define=diagrams.show=none"));
}

fn instrument_preset_resource_path(instrument: DiagramInstrument) -> Option<&'static str> {
  match instrument {
    DiagramInstrument::Ukulele => Some("lib/ChordPro/res/config/ukulele.json"),
    DiagramInstrument::Guitar | DiagramInstrument::Piano => None,
  }
}

fn run_chordpro_command<I, S>(
  app: &AppHandle,
  args: I,
  render_style: &RenderStyleOptions,
) -> Result<(), ChordProCommandError>
where
  I: IntoIterator<Item = S>,
  S: AsRef<std::ffi::OsStr>,
{
  let binary_path = resolve_chordpro_binary(app)?;
  let style_config_path = resolve_chordpro_style_config(app)?;
  let mut command_args = vec![
    OsString::from("--config"),
    style_config_path.as_os_str().to_os_string(),
  ];

  if let Some(resource_name) = instrument_preset_resource_path(render_style.instrument) {
    let preset_config_path = resolve_chordpro_runtime_config(app, resource_name)?;
    command_args.push(OsString::from("--config"));
    command_args.push(preset_config_path.as_os_str().to_os_string());
  }

  append_render_style_args(&mut command_args, render_style);
  command_args.extend(args.into_iter().map(|arg| arg.as_ref().to_os_string()));

  let mut command = Command::new(&binary_path);
  command.args(&command_args);
  configure_background_command(&mut command);

  let output = command.output().map_err(|error| ChordProCommandError {
    code: "CHORDPRO_EXECUTION_ERROR".into(),
    message: format!("Failed to execute bundled ChordPro CLI: {error}"),
    stdout: None,
    stderr: None,
    details: Some(binary_path.to_string_lossy().into_owned()),
  })?;

  if output.status.success() {
    return Ok(());
  }

  Err(ChordProCommandError {
    code: "CHORDPRO_CLI_FAILED".into(),
    message: format!(
      "ChordPro CLI failed with exit code {}.",
      output.status.code().unwrap_or_default()
    ),
    stdout: decode_output(output.stdout),
    stderr: decode_output(output.stderr),
    details: Some(binary_path.to_string_lossy().into_owned()),
  })
}

fn resolve_chordpro_binary(app: &AppHandle) -> Result<PathBuf, ChordProCommandError> {
  let binary_name = if cfg!(target_os = "windows") {
    "chordpro.exe"
  } else {
    "chordpro"
  };

  let candidate_paths = chordpro_resource_candidates(app, binary_name);
  let binary_path =
    resolve_existing_resource(&candidate_paths).ok_or_else(|| ChordProCommandError {
      code: "CHORDPRO_BINARY_NOT_FOUND".into(),
      message: "Bundled ChordPro binary was not found in any expected location.".into(),
      stdout: None,
      stderr: None,
      details: Some(format_attempted_paths(&candidate_paths)),
    })?;

  if cfg!(target_os = "windows") {
    let binary_dir = binary_path.parent().unwrap_or_else(|| Path::new(""));
    let has_perl_runtime = fs::read_dir(binary_dir)
      .ok()
      .into_iter()
      .flat_map(|entries| entries.filter_map(Result::ok))
      .any(|entry| {
        let name = entry.file_name();
        let name = name.to_string_lossy().to_lowercase();
        name.starts_with("perl5") && name.ends_with(".dll")
      });

    if !has_perl_runtime {
      return Err(ChordProCommandError {
        code: "CHORDPRO_RUNTIME_INCOMPLETE".into(),
        message: "Bundled ChordPro runtime is incomplete on Windows.".into(),
        stdout: None,
        stderr: None,
        details: Some(format!(
          "Resolved binary: {}. The bundled chordpro.exe requires Perl runtime files such as perl5*.dll in the same runtime folder.",
          binary_path.to_string_lossy()
        )),
      });
    }
  }

  Ok(binary_path)
}

fn resolve_chordpro_style_config(app: &AppHandle) -> Result<PathBuf, ChordProCommandError> {
  let candidate_paths = chordpro_studio_resource_candidates(app, "style.json");

  resolve_existing_resource(&candidate_paths).ok_or_else(|| ChordProCommandError {
    code: "CHORDPRO_STYLE_NOT_FOUND".into(),
    message: "Bundled ChordPro Studio style configuration was not found in any expected location."
      .into(),
    stdout: None,
    stderr: None,
    details: Some(format_attempted_paths(&candidate_paths)),
  })
}

fn resolve_chordpro_runtime_config(
  app: &AppHandle,
  resource_name: &str,
) -> Result<PathBuf, ChordProCommandError> {
  let candidate_paths = chordpro_resource_candidates(app, resource_name);

  resolve_existing_resource(&candidate_paths).ok_or_else(|| ChordProCommandError {
    code: "CHORDPRO_RUNTIME_CONFIG_NOT_FOUND".into(),
    message: "Bundled ChordPro runtime configuration was not found in any expected location."
      .into(),
    stdout: None,
    stderr: None,
    details: Some(format_attempted_paths(&candidate_paths)),
  })
}

fn chordpro_resource_candidates(app: &AppHandle, resource_name: &str) -> Vec<PathBuf> {
  let mut candidates = Vec::new();

  push_bundled_resource_candidate(
    app,
    PathBuf::from("chordpro").join(resource_name),
    &mut candidates,
  );
  push_bundled_resource_candidate(
    app,
    PathBuf::from("..").join("resources").join("chordpro").join(resource_name),
    &mut candidates,
  );

  if let Ok(resource_dir) = app.path().resource_dir() {
    candidates.push(resource_dir.join("chordpro").join(resource_name));
    candidates.push(resource_dir.join("resources").join("chordpro").join(resource_name));
    candidates.push(
      resource_dir
        .join("_up_")
        .join("resources")
        .join("chordpro")
        .join(resource_name),
    );
  }

  candidates.push(
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
      .join("..")
      .join("resources")
      .join("chordpro")
      .join(resource_name),
  );

  dedupe_paths(candidates)
}

fn chordpro_studio_resource_candidates(app: &AppHandle, resource_name: &str) -> Vec<PathBuf> {
  let mut candidates = Vec::new();

  push_bundled_resource_candidate(
    app,
    PathBuf::from("chordpro-studio").join(resource_name),
    &mut candidates,
  );
  push_bundled_resource_candidate(
    app,
    PathBuf::from("..").join("resources").join("chordpro-studio").join(resource_name),
    &mut candidates,
  );

  if let Ok(resource_dir) = app.path().resource_dir() {
    candidates.push(resource_dir.join("chordpro-studio").join(resource_name));
    candidates.push(
      resource_dir
        .join("resources")
        .join("chordpro-studio")
        .join(resource_name),
    );
    candidates.push(
      resource_dir
        .join("_up_")
        .join("resources")
        .join("chordpro-studio")
        .join(resource_name),
    );
  }

  candidates.push(
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
      .join("..")
      .join("resources")
      .join("chordpro-studio")
      .join(resource_name),
  );

  dedupe_paths(candidates)
}

fn push_bundled_resource_candidate(
  app: &AppHandle,
  resource_path: PathBuf,
  candidates: &mut Vec<PathBuf>,
) {
  if let Ok(resolved_path) = app.path().resolve(&resource_path, BaseDirectory::Resource) {
    candidates.push(resolved_path);
  }
}

#[cfg(target_os = "windows")]
fn configure_background_command(command: &mut Command) {
  command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn configure_background_command(_command: &mut Command) {}

#[cfg(test)]
mod tests {
  use super::{
    append_render_style_args, hash_preview_input, instrument_preset_resource_path,
    preprocess_chordpro_for_render,
    DiagramInstrument, RenderStyleOptions,
  };
  use std::ffi::OsString;

  #[test]
  fn leaves_short_tab_blocks_unchanged_in_two_columns() {
    let input = "{title: Test}\n{columns: 2}\n{start_of_tab}\nE|--0--|\nB|--1--|\n{end_of_tab}\n";
    let render_style = RenderStyleOptions::default();

    assert_eq!(preprocess_chordpro_for_render(input, &render_style, None), input);
  }

  #[test]
  fn splits_long_tab_blocks_into_multiple_tab_sections() {
    let line_a = "A".repeat(45);
    let line_b = "B".repeat(45);
    let line_c = "C".repeat(45);
    let line_d = "D".repeat(45);
    let input = format!(
      "{{title: Test}}
{{columns: 2}}
{{start_of_tab}}
{line_a}
{line_b}
{line_c}
{line_d}
{{end_of_tab}}
"
    );
    let expected = format!(
      "{{title: Test}}
{{columns: 2}}
{{start_of_tab}}
{}
{}
{}
{}
{{end_of_tab}}

{{start_of_tab}}
{}
{}
{}
{}
{{end_of_tab}}
",
      "A".repeat(23),
      "B".repeat(23),
      "C".repeat(23),
      "D".repeat(23),
      "A".repeat(22),
      "B".repeat(22),
      "C".repeat(22),
      "D".repeat(22)
    );
    let render_style = RenderStyleOptions::default();

    assert_eq!(preprocess_chordpro_for_render(&input, &render_style, None), expected);
  }

  #[test]
  fn tracks_the_current_column_mode_per_tab_block() {
    let long_tab = "X".repeat(50);
    let input = format!(
      "{{title: Test}}
{{columns: 1}}
{{start_of_tab}}
{long_tab}
{{end_of_tab}}
{{columns: 2}}
{{start_of_tab}}
{long_tab}
{{end_of_tab}}
"
    );
    let expected = format!(
      "{{title: Test}}
{{columns: 1}}
{{start_of_tab}}
{long_tab}
{{end_of_tab}}
{{columns: 2}}
{{start_of_tab}}
{}
{{end_of_tab}}

{{start_of_tab}}
{}
{{end_of_tab}}
",
      "X".repeat(25),
      "X".repeat(25)
    );
    let render_style = RenderStyleOptions::default();

    assert_eq!(preprocess_chordpro_for_render(&input, &render_style, None), expected);
  }

  #[test]
  fn splits_two_line_tab_example_from_real_input() {
    let input = "{title: Test}\n{columns: 2}\n{start_of_tab}\ne----------12--12------------12--12--------------12--12--14--14--12--12--\nb--14--14------------14--14------------14--14---------------------------(x2)\n{end_of_tab}\n";
    let render_style = RenderStyleOptions::default();
    let rendered = preprocess_chordpro_for_render(input, &render_style, None);

    assert_eq!(rendered.matches("{start_of_tab}").count(), 3);
    assert!(rendered.contains("e----------12--12"));
    assert!(rendered.contains("b--14--14"));
    assert!(rendered.contains("(x2)"));
  }

  #[test]
  fn splits_blank_line_separated_tab_groups_independently() {
    let input = format!(
      "{{title: Test}}
{{columns: 2}}
{{start_of_tab}}
{}
{}

{}
{}
{{end_of_tab}}
",
      "A".repeat(45),
      "B".repeat(45),
      "C".repeat(45),
      "D".repeat(45)
    );
    let expected = format!(
      "{{title: Test}}
{{columns: 2}}
{{start_of_tab}}
{}
{}
{{end_of_tab}}

{{start_of_tab}}
{}
{}
{{end_of_tab}}

{{start_of_tab}}
{}
{}
{{end_of_tab}}

{{start_of_tab}}
{}
{}
{{end_of_tab}}
",
      "A".repeat(23),
      "B".repeat(23),
      "A".repeat(22),
      "B".repeat(22),
      "C".repeat(23),
      "D".repeat(23),
      "C".repeat(22),
      "D".repeat(22)
    );
    let render_style = RenderStyleOptions::default();

    assert_eq!(preprocess_chordpro_for_render(&input, &render_style, None), expected);
  }

  #[test]
  fn splits_six_line_tab_example_from_real_input() {
    let input = "{title: Test}
{columns: 2}
{start_of_tab}
E|------------------------------------------|
B|-------------------1---1---1---1----------|
G|-2---2---2---2-----0---0---0---0----------|
D|-3---3---3---3-----2---2---2---2----------|
A|-3---3---3---3-----3-3-3-3-3-3-3-3--------|
E|-1-1-1-1-1-1-1-1--------------------------|
{end_of_tab}

{start_of_tab}
E|------------------------------------------|
B|-1---1---1---1----------------------------|
G|-3---3---3---3-----2---2---2---2----------|
D|-2---2---2---2-----3---3---3---3----------|
A|-3-3-3-3-3-3-3-3---3---3---3---3----------|
E|-------------------1-1-1-1-1-1-1-1--------|
{end_of_tab}
";
    let render_style = RenderStyleOptions::default();
    let rendered = preprocess_chordpro_for_render(input, &render_style, None);

    assert_eq!(rendered.matches("{start_of_tab}").count(), 4);
    assert!(rendered.contains("E|----------------"));
    assert!(rendered.contains("A|-3-3-3-3-3-3-3-3"));
    assert!(rendered.contains("1-1-1-1-1-1-1-1"));
  }

  #[test]
  fn falls_back_to_single_column_on_malformed_tab_blocks() {
    let input = "{title: Test}\n{columns: 2}\n{start_of_tab}\nE|-----\n";
    let expected = "{title: Test}\n{columns: 1}\n{start_of_tab}\nE|-----\n";
    let render_style = RenderStyleOptions::default();

    assert_eq!(preprocess_chordpro_for_render(input, &render_style, None), expected);
  }

  #[test]
  fn preprocess_injects_title_from_first_valid_lyric_line_when_metadata_is_missing() {
    let input = "{comment: Intro}\n[C] [Em] [Am]\n\n[F]Desmarcate del mar [Em]\n";
    let render_style = RenderStyleOptions::default();
    let rendered = preprocess_chordpro_for_render(input, &render_style, None);

    assert!(rendered.starts_with("{title: Desmarcate del mar}\n"));
    assert!(rendered.contains("[C] [Em] [Am]"));
    assert!(rendered.contains("[F]Desmarcate del mar [Em]"));
  }

  #[test]
  fn preprocess_falls_back_to_artist_or_filename_when_no_valid_lyric_title_exists() {
    let artist_only_input = "{artist: Vetusta Morla}\n[C] [Em] [Am]\n";
    let render_style = RenderStyleOptions::default();
    let artist_rendered = preprocess_chordpro_for_render(artist_only_input, &render_style, None);
    assert!(artist_rendered.starts_with("{title: Vetusta Morla}\n"));

    let filename_rendered =
      preprocess_chordpro_for_render("[C] [Em] [Am]\n", &render_style, Some("demo-song.cho"));
    assert!(filename_rendered.starts_with("{title: demo-song}\n"));
  }

  #[test]
  fn preview_cache_hash_changes_when_instrument_changes() {
    let chordpro_text = "{title: Test}\n[C]Hello\n";
    let piano_style = RenderStyleOptions {
      show_chord_diagrams: true,
      instrument: DiagramInstrument::Piano,
    };
    let guitar_style = RenderStyleOptions {
      show_chord_diagrams: true,
      instrument: DiagramInstrument::Guitar,
    };
    let ukulele_style = RenderStyleOptions {
      show_chord_diagrams: true,
      instrument: DiagramInstrument::Ukulele,
    };

    assert_ne!(
      hash_preview_input(chordpro_text, &piano_style),
      hash_preview_input(chordpro_text, &guitar_style)
    );
    assert_ne!(
      hash_preview_input(chordpro_text, &guitar_style),
      hash_preview_input(chordpro_text, &ukulele_style)
    );
  }

  #[test]
  fn preview_cache_hash_changes_when_derived_title_changes() {
    let render_style = RenderStyleOptions::default();
    let first = preprocess_chordpro_for_render("[C]Hello world\n", &render_style, Some("demo.cho"));
    let second = preprocess_chordpro_for_render("[C]Goodbye world\n", &render_style, Some("demo.cho"));

    assert_ne!(
      hash_preview_input(&first, &render_style),
      hash_preview_input(&second, &render_style)
    );
  }

  #[test]
  fn render_style_args_apply_instrument_and_hide_all_diagrams_when_disabled() {
    let mut command_args = Vec::<OsString>::new();
    let render_style = RenderStyleOptions {
      show_chord_diagrams: false,
      instrument: DiagramInstrument::Piano,
    };

    append_render_style_args(&mut command_args, &render_style);

    assert_eq!(
      command_args,
      vec![
        OsString::from("--define=instrument.type=keyboard"),
        OsString::from("--define=diagrams.show=none"),
      ]
    );
  }

  #[test]
  fn render_style_args_support_ukulele_instrument() {
    let mut command_args = Vec::<OsString>::new();
    let render_style = RenderStyleOptions {
      show_chord_diagrams: true,
      instrument: DiagramInstrument::Ukulele,
    };

    append_render_style_args(&mut command_args, &render_style);

    assert_eq!(command_args, vec![OsString::from("--define=instrument.type=ukulele")]);
  }

  #[test]
  fn ukulele_instrument_requires_runtime_preset_config() {
    assert_eq!(
      instrument_preset_resource_path(DiagramInstrument::Ukulele),
      Some("lib/ChordPro/res/config/ukulele.json")
    );
    assert_eq!(instrument_preset_resource_path(DiagramInstrument::Guitar), None);
    assert_eq!(instrument_preset_resource_path(DiagramInstrument::Piano), None);
  }

  #[test]
  fn preprocess_injects_ukulele_enharmonic_aliases_without_changing_song_chords() {
    let input = "{title: Test}\n[F#]one [G#m]two [D#m]three [C#m]four\n";
    let render_style = RenderStyleOptions {
      show_chord_diagrams: true,
      instrument: DiagramInstrument::Ukulele,
    };
    let rendered = preprocess_chordpro_for_render(input, &render_style, None);

    assert!(rendered.contains("{define: F# copy Gb}"));
    assert!(rendered.contains("{define: G#m copy Abm}"));
    assert!(rendered.contains("{define: D#m copy Ebm}"));
    assert!(rendered.contains("{define: C#m copy Dbm}"));
    assert!(rendered.contains("[F#]one [G#m]two [D#m]three [C#m]four"));
  }

  #[test]
  fn preprocess_does_not_inject_ukulele_aliases_when_diagrams_are_hidden_or_defined_by_user() {
    let hidden_input = "{title: Test}\n[F#]one\n";
    let hidden_render_style = RenderStyleOptions {
      show_chord_diagrams: false,
      instrument: DiagramInstrument::Ukulele,
    };
    let hidden_rendered = preprocess_chordpro_for_render(hidden_input, &hidden_render_style, None);
    assert!(!hidden_rendered.contains("{define: F# copy Gb}"));

    let defined_input = "{define: F# copy Gb}\n[F#]one\n";
    let render_style = RenderStyleOptions {
      show_chord_diagrams: true,
      instrument: DiagramInstrument::Ukulele,
    };
    let defined_rendered = preprocess_chordpro_for_render(defined_input, &render_style, None);
    assert_eq!(defined_rendered.matches("{define: F# copy Gb}").count(), 1);
  }
}

fn resolve_existing_resource(candidate_paths: &[PathBuf]) -> Option<PathBuf> {
  candidate_paths.iter().find(|path| path.is_file()).cloned()
}

fn dedupe_paths(candidate_paths: Vec<PathBuf>) -> Vec<PathBuf> {
  let mut deduped = Vec::new();

  for path in candidate_paths {
    if !deduped.iter().any(|existing| existing == &path) {
      deduped.push(path);
    }
  }

  deduped
}

fn format_attempted_paths(candidate_paths: &[PathBuf]) -> String {
  let attempted_paths = candidate_paths
    .iter()
    .map(|path| format!("- {}", path.to_string_lossy()))
    .collect::<Vec<_>>();

  format!("Attempted paths:\n{}", attempted_paths.join("\n"))
}

fn decode_output(output: Vec<u8>) -> Option<String> {
  let text = String::from_utf8_lossy(&output).trim().to_string();
  if text.is_empty() {
    None
  } else {
    Some(text)
  }
}







