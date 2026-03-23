#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod chordpro_cli;
mod config;

use tauri::Manager;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      let base_title = "ChordPro Studio";
      let version = app.package_info().version.to_string();
      let window_title = if version.is_empty() {
        base_title.to_string()
      } else {
        format!("{base_title} - v{version}")
      };

      for window in app.webview_windows().values() {
        let _ = window.set_title(&window_title);
      }

      Ok(())
    })
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
