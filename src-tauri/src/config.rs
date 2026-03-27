use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
  #[serde(rename = "geminiApiKey")]
  pub gemini_api_key: Option<String>,
  #[serde(rename = "lastSongbookPath")]
  pub last_songbook_path: Option<String>,
  #[serde(rename = "lastOpenedSongPath")]
  pub last_opened_song_path: Option<String>,
  #[serde(rename = "conversionMode")]
  pub conversion_mode: Option<String>,
  #[serde(rename = "playgroundModel")]
  pub playground_model: Option<String>,
  #[serde(rename = "showChordDiagrams")]
  pub show_chord_diagrams: bool,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      gemini_api_key: None,
      last_songbook_path: None,
      last_opened_song_path: None,
      conversion_mode: None,
      playground_model: None,
      show_chord_diagrams: true,
    }
  }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
  let app_config_dir = app
    .path()
    .app_config_dir()
    .map_err(|error| format!("Could not resolve app config directory: {error}"))?;

  Ok(app_config_dir.join("config.json"))
}

fn ensure_parent_directory(path: &PathBuf) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|error| format!("Could not create app config directory: {error}"))?;
  }

  Ok(())
}

fn persist_config_file(path: &PathBuf, config: &AppConfig) -> Result<(), String> {
  ensure_parent_directory(path)?;

  let serialized = serde_json::to_string_pretty(config)
    .map_err(|error| format!("Could not serialize config: {error}"))?;

  fs::write(path, serialized).map_err(|error| format!("Could not write config file: {error}"))
}

#[tauri::command]
pub fn read_config(app: AppHandle) -> Result<AppConfig, String> {
  let path = config_path(&app)?;

  if !path.exists() {
    let default_config = AppConfig::default();
    persist_config_file(&path, &default_config)?;
    return Ok(default_config);
  }

  let raw_config =
    fs::read_to_string(&path).map_err(|error| format!("Could not read config file: {error}"))?;

  let parsed = serde_json::from_str::<AppConfig>(&raw_config).unwrap_or_default();
  Ok(parsed)
}

#[tauri::command]
pub fn write_config(app: AppHandle, config: AppConfig) -> Result<AppConfig, String> {
  let path = config_path(&app)?;
  persist_config_file(&path, &config)?;
  Ok(config)
}
