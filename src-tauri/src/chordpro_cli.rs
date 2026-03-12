use serde::Serialize;
use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
};
use tauri::{AppHandle, Manager};

const PREVIEW_CHO_FILENAME: &str = "preview.cho";
const PREVIEW_HTML_FILENAME: &str = "preview.html";
const EXPORT_CHO_FILENAME: &str = "export.cho";

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
  pub html_path: String,
  pub html_content: String,
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
  let cache_dir = ensure_preview_dir(&app)?;
  let input_path = cache_dir.join(PREVIEW_CHO_FILENAME);
  let output_path = cache_dir.join(PREVIEW_HTML_FILENAME);

  write_text_file(&input_path, &chordpro_text)?;
  run_chordpro_command(
    &app,
    [
      input_path.as_os_str(),
      "--output".as_ref(),
      output_path.as_os_str(),
    ],
  )?;

  Ok(PreviewResponse {
    html_path: output_path.to_string_lossy().into_owned(),
    html_content: fs::read_to_string(&output_path).map_err(|error| ChordProCommandError {
      code: "PREVIEW_READ_ERROR".into(),
      message: format!("Failed to read generated preview HTML: {error}"),
      stdout: None,
      stderr: None,
      details: Some(output_path.to_string_lossy().into_owned()),
    })?,
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

  if let Some(parent) = output_path.parent() {
    fs::create_dir_all(parent).map_err(|error| ChordProCommandError {
      code: "OUTPUT_DIRECTORY_ERROR".into(),
      message: format!("Failed to prepare output directory: {error}"),
      stdout: None,
      stderr: None,
      details: Some(parent.to_string_lossy().into_owned()),
    })?;
  }

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
  let output = Command::new(&binary_path)
    .args(args)
    .output()
    .map_err(|error| ChordProCommandError {
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

  let mut candidates = Vec::new();

  if let Ok(resource_dir) = app.path().resource_dir() {
    candidates.push(resource_dir.join("chordpro").join(binary_name));
  }

  candidates.push(
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
      .join("..")
      .join("resources")
      .join("chordpro")
      .join(binary_name),
  );

  let binary_path = candidates.into_iter().find(|path| path.is_file()).ok_or_else(|| {
    ChordProCommandError {
      code: "CHORDPRO_BINARY_NOT_FOUND".into(),
      message: "Bundled ChordPro binary was not found.".into(),
      stdout: None,
      stderr: None,
      details: Some("Expected resources/chordpro/chordpro(.exe)".into()),
    }
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
        details: Some(
          "The bundled chordpro.exe requires Perl runtime files such as perl5*.dll in resources/chordpro (and any nested support files).".into(),
        ),
      });
    }
  }

  Ok(binary_path)
}

fn decode_output(output: Vec<u8>) -> Option<String> {
  let text = String::from_utf8_lossy(&output).trim().to_string();
  if text.is_empty() {
    None
  } else {
    Some(text)
  }
}
