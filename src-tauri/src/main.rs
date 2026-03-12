mod chordpro_cli;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      chordpro_cli::generate_preview,
      chordpro_cli::export_pdf
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
