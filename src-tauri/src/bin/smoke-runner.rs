use chordpro_studio::{chordpro_cli, smoke};
use std::path::PathBuf;

fn main() {
  let output_dir = std::env::args_os()
    .nth(1)
    .map(PathBuf::from)
    .unwrap_or_else(|| PathBuf::from(".smoke"));

  let app = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .manage(std::sync::Arc::new(chordpro_cli::PreviewExecutionState::default()))
    .build(tauri::generate_context!())
    .expect("error while building tauri application for smoke mode");

  let result = tauri::async_runtime::block_on(smoke::run(app.handle().clone(), output_dir));

  match result {
    Ok(summary) => {
      println!(
        "{}",
        serde_json::to_string(&summary).expect("could not serialize smoke summary")
      );
    }
    Err(error) => {
      eprintln!("{error}");
      std::process::exit(1);
    }
  }
}
