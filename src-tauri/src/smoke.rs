use crate::chordpro_cli::{
  export_pdf_internal, generate_preview_with_state, ChordProCommandError, PreviewExecutionState,
  RenderStyleOptions,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::{
  fs,
  path::{Path, PathBuf},
  sync::Arc,
};
use tauri::AppHandle;

const SMOKE_CHORDPRO_TEXT: &str = "{title: Smoke Test}\n{artist: Test}\n\n[C]Hello [G]world\n[F]This is a [C]test\n";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmokeSummary {
  pub preview_path: String,
  pub preview_size: u64,
  pub second_preview_path: String,
  pub second_preview_size: u64,
  pub export_pdf_path: String,
  pub export_pdf_size: u64,
  pub export_cho_path: String,
  pub export_cho_size: u64,
}

pub async fn run(app: AppHandle, output_dir: PathBuf) -> Result<SmokeSummary, String> {
  fs::create_dir_all(&output_dir)
    .map_err(|error| format!("Could not prepare smoke output directory: {error}"))?;

  let preview_state = Arc::new(PreviewExecutionState::default());
  let render_style = Some(RenderStyleOptions::default());
  let file_name = Some(String::from("smoke-test.cho"));

  let first_preview = generate_preview_with_state(
    app.clone(),
    Arc::clone(&preview_state),
    SMOKE_CHORDPRO_TEXT.to_string(),
    false,
    render_style.clone(),
    file_name.clone(),
  )
  .await
  .map_err(format_backend_error)?;

  let preview_output_path = output_dir.join("preview.pdf");
  let preview_bytes = decode_pdf_bytes(&first_preview.pdf_base64)?;
  write_non_empty_file(&preview_output_path, &preview_bytes, "preview PDF")?;

  let second_preview = generate_preview_with_state(
    app.clone(),
    Arc::clone(&preview_state),
    SMOKE_CHORDPRO_TEXT.to_string(),
    false,
    render_style.clone(),
    file_name.clone(),
  )
  .await
  .map_err(format_backend_error)?;
  let second_preview_bytes = decode_pdf_bytes(&second_preview.pdf_base64)?;

  let export_pdf_path = output_dir.join("export.pdf");
  export_pdf_internal(
    app,
    SMOKE_CHORDPRO_TEXT.to_string(),
    export_pdf_path.to_string_lossy().into_owned(),
    render_style,
    file_name,
  )
  .map_err(format_backend_error)?;
  let export_pdf_size = file_size(&export_pdf_path, "export PDF")?;

  let export_cho_path = output_dir.join("export.cho");
  write_non_empty_file(
    &export_cho_path,
    SMOKE_CHORDPRO_TEXT.as_bytes(),
    "export CHO",
  )?;

  Ok(SmokeSummary {
    preview_path: preview_output_path.to_string_lossy().into_owned(),
    preview_size: preview_bytes.len() as u64,
    second_preview_path: second_preview.pdf_path,
    second_preview_size: second_preview_bytes.len() as u64,
    export_pdf_path: export_pdf_path.to_string_lossy().into_owned(),
    export_pdf_size,
    export_cho_path: export_cho_path.to_string_lossy().into_owned(),
    export_cho_size: SMOKE_CHORDPRO_TEXT.len() as u64,
  })
}

fn decode_pdf_bytes(pdf_base64: &str) -> Result<Vec<u8>, String> {
  let bytes = STANDARD
    .decode(pdf_base64)
    .map_err(|error| format!("Could not decode preview PDF bytes: {error}"))?;

  if bytes.is_empty() {
    return Err(String::from("Preview PDF bytes are empty."));
  }

  Ok(bytes)
}

fn write_non_empty_file(path: &Path, contents: &[u8], label: &str) -> Result<(), String> {
  if contents.is_empty() {
    return Err(format!("{label} is empty."));
  }

  fs::write(path, contents).map_err(|error| format!("Could not write {label}: {error}"))?;
  file_size(path, label).map(|_| ())
}

fn file_size(path: &Path, label: &str) -> Result<u64, String> {
  let metadata = fs::metadata(path).map_err(|error| format!("Could not inspect {label}: {error}"))?;
  let size = metadata.len();

  if size == 0 {
    return Err(format!("{label} was generated but is empty."));
  }

  Ok(size)
}

fn format_backend_error(error: ChordProCommandError) -> String {
  let mut parts = vec![format!("{}: {}", error.code, error.message)];

  if let Some(stderr) = error.stderr.filter(|value| !value.trim().is_empty()) {
    parts.push(stderr);
  } else if let Some(stdout) = error.stdout.filter(|value| !value.trim().is_empty()) {
    parts.push(stdout);
  }

  parts.join("\n\n")
}
