use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Author {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Plugin {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub author: Option<Author>,
    #[serde(default)]
    pub authors: Option<Vec<Author>>,
    #[serde(default)]
    pub source_repo: Option<String>,
    #[serde(default)]
    pub source_url: Option<String>,
    pub skills: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketplaceData {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    pub plugins: Vec<Plugin>,
}

#[tauri::command]
pub fn get_marketplace_data(app: tauri::AppHandle) -> Result<MarketplaceData, String> {
    // Load config
    let config = crate::commands::config_manager::load_config(&app)?;
    
    // If no repositories are configured (first run?), we might want to default to the local one 
    // or the "official" one if it's in the default config.
    // The default config in `types.rs` has empty repositories list.
    // So initally this might return empty. 
    // TODO: We might want to auto-add the default one on first run or if list is empty.
    
    // But for now, let's just aggregate.
    
    // Aggregate data
    let data = crate::commands::marketplace_manager::aggregate_marketplace_data(&config);
    
    // Fallback: if aggregation yields 0 plugins, 
    // try the old hardcoded paths and resource directory for backward compatibility
    if data.plugins.is_empty() {
        let mut paths = vec![
            PathBuf::from("Skill-Box/.claude-plugin/marketplace.json"),
            PathBuf::from("../Skill-Box/.claude-plugin/marketplace.json"),
        ];

        // Add resource directory path if available
        if let Ok(resource_dir) = app.path().resource_dir() {
            paths.push(resource_dir.join("Skill-Box").join(".claude-plugin").join("marketplace.json"));
            // Also try flat structure just in case
            paths.push(resource_dir.join(".claude-plugin").join("marketplace.json"));
        }

        for path in paths {
            if path.exists() {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(legacy_data) = serde_json::from_str::<MarketplaceData>(&content) {
                        return Ok(legacy_data);
                    }
                }
            }
        }
    }

    Ok(data)
}
