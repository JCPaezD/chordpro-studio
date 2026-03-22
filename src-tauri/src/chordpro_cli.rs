use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
  ffi::OsString,
  fs,
  io,
  path::{Path, PathBuf},
  process::Command,
};
use tauri::{path::BaseDirectory, AppHandle, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const PREVIEW_CHO_FILENAME: &str = "preview.cho";
const PREVIEW_PDF_FILENAME: &str = "preview.pdf";
const EXPORT_CHO_FILENAME: &str = "export.cho";
const PREVIEW_CACHE_FOLDER: &str = "cache/previews";

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

#[tauri::command]
pub fn generate_preview(
  app: AppHandle,
  chordpro_text: String,
) -> Result<PreviewResponse, ChordProCommandError> {
  let preview_dir = ensure_preview_dir(&app)?;
  let cache_path = preview_cache_file_path(&app, &chordpro_text)?;

  if let Some(cached_pdf_bytes) = read_valid_cached_preview(&cache_path) {
    return Ok(PreviewResponse {
      pdf_path: cache_path.to_string_lossy().into_owned(),
      pdf_base64: STANDARD.encode(cached_pdf_bytes),
    });
  }

  let input_path = preview_dir.join(PREVIEW_CHO_FILENAME);
  let output_path = preview_dir.join(PREVIEW_PDF_FILENAME);

  write_text_file(&input_path, &chordpro_text)?;
  run_chordpro_command(
    &app,
    [
      input_path.as_os_str(),
      "--output".as_ref(),
      output_path.as_os_str(),
    ],
  )?;

  let generated_pdf_bytes = fs::read(&output_path).map_err(|error| ChordProCommandError {
    code: "PREVIEW_READ_ERROR".into(),
    message: format!("Failed to read generated preview PDF: {error}"),
    stdout: None,
    stderr: None,
    details: Some(output_path.to_string_lossy().into_owned()),
  })?;

  let response_path = if write_preview_cache_file(&cache_path, &generated_pdf_bytes).is_ok() {
    cache_path
  } else {
    output_path
  };

  Ok(PreviewResponse {
    pdf_path: response_path.to_string_lossy().into_owned(),
    pdf_base64: STANDARD.encode(generated_pdf_bytes),
  })
}

#[tauri::command]
pub fn export_pdf(
  app: AppHandle,
  chordpro_text: String,
  output_path: String,
) -> Result<ExportPdfResponse, ChordProCommandError> {
  let cache_dir = ensure_preview_dir(&app)?;
  let input_path = cache_dir.join(EXPORT_CHO_FILENAME);
  let output_path = PathBuf::from(output_path);

  ensure_output_directory(&output_path)?;

  write_text_file(&input_path, &chordpro_text)?;
  run_chordpro_command(
    &app,
    [
      input_path.as_os_str(),
      "--output".as_ref(),
      output_path.as_os_str(),
    ],
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

  let mut args: Vec<OsString> = input_paths.into_iter().map(OsString::from).collect();
  args.push(OsString::from("--output"));
  args.push(output_path.as_os_str().to_os_string());

  run_chordpro_command(&app, args)?;

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
) -> Result<PathBuf, ChordProCommandError> {
  let cache_dir = ensure_preview_cache_dir(app)?;
  let cache_key = hash_chordpro_text(chordpro_text);
  Ok(cache_dir.join(format!("{cache_key}.pdf")))
}

fn hash_chordpro_text(chordpro_text: &str) -> String {
  let mut hasher = Sha256::new();
  hasher.update(chordpro_text.as_bytes());

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

fn run_chordpro_command<I, S>(app: &AppHandle, args: I) -> Result<(), ChordProCommandError>
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
