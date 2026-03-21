#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod chordpro_cli;
mod config;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
      chordpro_cli::generate_preview,
      chordpro_cli::export_pdf,
      chordpro_cli::export_songbook_pdf,
      config::read_config,
      config::write_config
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
