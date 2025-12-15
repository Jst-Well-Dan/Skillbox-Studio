//! Bundled Plugins Installation Module
//!
//! This module handles the automatic installation of pre-bundled plugins
//! (Skill-Box) when the application starts. It extracts plugins from the
//! app's resource directory to the user's Claude plugins directory.

use anyhow::{Context, Result};
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

// ============================================================================
// Data Structures
// ============================================================================

/// Metadata about installed bundled plugins
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundledPluginsStatus {
    pub app_version: String,
    pub marketplace_version: String,
    pub installed_plugins: Vec<String>,
    pub installed_at: String,
}

/// Structure for parsing marketplace.json
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct MarketplaceManifest {
    name: String,
    version: String,
    #[serde(default)]
    description: Option<String>,
    owner: MarketplaceOwner,
    plugins: Vec<PluginEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct MarketplaceOwner {
    name: String,
    #[serde(default)]
    url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct PluginEntry {
    name: String,
    #[serde(default)]
    description: Option<String>,
    source: String,
    #[serde(default)]
    category: Option<String>,
}


// ============================================================================
// Path Helpers
// ============================================================================

/// Get the bundled plugins source directory from app resources
fn get_bundled_plugins_source(app: &AppHandle) -> Result<PathBuf> {
    let resource_dir = app
        .path()
        .resource_dir()
        .context("Failed to get resource directory")?;

    Ok(resource_dir.join("bundled-plugins").join("Skill-Box"))
}

/// Get the Claude plugins directory
fn get_claude_plugins_dir() -> Result<PathBuf> {
    let claude_dir = dirs::home_dir()
        .context("Could not find home directory")?
        .join(".claude");

    fs::create_dir_all(&claude_dir).context("Failed to create ~/.claude directory")?;

    let plugins_dir = claude_dir.join("plugins");
    fs::create_dir_all(&plugins_dir).context("Failed to create plugins directory")?;

    Ok(plugins_dir)
}

/// Get the target directory for Skill-Box installation
fn get_skill_box_target_dir() -> Result<PathBuf> {
    let plugins_dir = get_claude_plugins_dir()?;

    let marketplaces_dir = plugins_dir.join("marketplaces");
    fs::create_dir_all(&marketplaces_dir).context("Failed to create marketplaces directory")?;

    Ok(marketplaces_dir.join("Skill-Box"))
}

/// Get the path for installation metadata file
fn get_metadata_path() -> Result<PathBuf> {
    let plugins_dir = get_claude_plugins_dir()?;
    Ok(plugins_dir.join(".bundled-plugins-meta.json"))
}

// ============================================================================
// Core Logic
// ============================================================================

/// Read and parse marketplace.json from a directory
fn read_marketplace_manifest(dir: &Path) -> Result<MarketplaceManifest> {
    let manifest_path = dir.join(".claude-plugin").join("marketplace.json");
    let content =
        fs::read_to_string(&manifest_path).context("Failed to read marketplace.json")?;

    serde_json::from_str(&content).context("Failed to parse marketplace.json")
}

/// Check if installation/update is needed based on version
fn should_install(metadata_path: &Path, source_version: &str) -> Result<bool> {
    if !metadata_path.exists() {
        debug!("Metadata file not found, installation needed");
        return Ok(true);
    }

    let content = fs::read_to_string(metadata_path)?;
    let metadata: BundledPluginsStatus = serde_json::from_str(&content)?;

    if metadata.marketplace_version != source_version {
        debug!(
            "Version mismatch: installed={}, source={}",
            metadata.marketplace_version, source_version
        );
        return Ok(true);
    }

    Ok(false)
}

/// Recursively copy a directory, skipping .git
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let file_name = entry.file_name();
        let dst_path = dst.join(&file_name);

        // Skip .git directory and other unwanted files
        if let Some(name) = file_name.to_str() {
            if name == ".git" || name == ".gitignore" || name == ".DS_Store" {
                continue;
            }
        }

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

/// Register marketplace by directly writing to known_marketplaces.json
/// This is more reliable than CLI as it doesn't depend on claude being in PATH
fn register_marketplace_directly(install_location: &Path, marketplace_name: &str) -> Result<()> {
    use std::collections::HashMap;

    let plugins_dir = get_claude_plugins_dir()?;
    let known_marketplaces_path = plugins_dir.join("known_marketplaces.json");

    info!(
        "Registering marketplace directly to {:?}",
        known_marketplaces_path
    );

    // Read existing marketplaces or create new map
    let mut marketplaces: HashMap<String, serde_json::Value> = if known_marketplaces_path.exists() {
        let content = fs::read_to_string(&known_marketplaces_path)
            .context("Failed to read known_marketplaces.json")?;
        serde_json::from_str(&content).unwrap_or_else(|_| HashMap::new())
    } else {
        HashMap::new()
    };

    // Create marketplace entry
    let marketplace_entry = serde_json::json!({
        "source": {
            "source": "directory",
            "url": install_location.to_string_lossy()
        },
        "installLocation": install_location.to_string_lossy(),
        "lastUpdated": chrono::Utc::now().to_rfc3339()
    });

    // Add or update the marketplace
    marketplaces.insert(marketplace_name.to_string(), marketplace_entry);

    // Write back to file
    let json_content = serde_json::to_string_pretty(&marketplaces)
        .context("Failed to serialize known_marketplaces.json")?;
    fs::write(&known_marketplaces_path, json_content)
        .context("Failed to write known_marketplaces.json")?;

    info!(
        "Successfully registered {} marketplace at {:?}",
        marketplace_name, install_location
    );

    Ok(())
}

/// Register marketplace using official Claude CLI command
/// Falls back to direct JSON writing if CLI fails
fn register_marketplace_via_cli(install_location: &Path) -> Result<()> {
    use std::process::Command;

    let path_str = install_location.to_string_lossy();

    info!(
        "Attempting to register marketplace via CLI: claude plugin marketplace add {}",
        path_str
    );

    // Try CLI first
    let cli_result = Command::new("claude")
        .args(["plugin", "marketplace", "add", &path_str])
        .output();

    match cli_result {
        Ok(output) if output.status.success() => {
            info!("Successfully registered Skill-Box marketplace via CLI");
            Ok(())
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            warn!("Claude CLI marketplace add failed: {}", stderr);
            warn!("Falling back to direct JSON registration...");
            register_marketplace_directly(install_location, "Skill-Box")
        }
        Err(e) => {
            warn!("Failed to execute claude CLI: {}", e);
            warn!("Falling back to direct JSON registration...");
            register_marketplace_directly(install_location, "Skill-Box")
        }
    }
}

/// Save installation metadata
fn save_installation_metadata(
    path: &Path,
    version: &str,
    plugins: &[String],
) -> Result<()> {
    let metadata = BundledPluginsStatus {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        marketplace_version: version.to_string(),
        installed_plugins: plugins.to_vec(),
        installed_at: chrono::Utc::now().to_rfc3339(),
    };

    let json = serde_json::to_string_pretty(&metadata)?;
    fs::write(path, json)?;

    Ok(())
}

// ============================================================================
// Main Installation Function
// ============================================================================

/// Main installation function - called from main.rs setup hook
///
/// This function:
/// 1. Checks if bundled plugins exist in app resources
/// 2. Compares versions to determine if installation/update is needed
/// 3. Copies plugins to ~/.claude/plugins/marketplaces/Skill-Box
/// 4. Registers marketplace via `claude plugin marketplace add` CLI command
/// 5. Saves installation metadata for version tracking
pub async fn install_bundled_plugins(app: &AppHandle) -> Result<Vec<String>> {
    info!("Starting bundled plugins installation check...");

    // 1. Get paths
    let bundled_source = get_bundled_plugins_source(app)?;
    let target_dir = get_skill_box_target_dir()?;
    let metadata_path = get_metadata_path()?;

    // 2. Check if source exists (only present in release builds)
    if !bundled_source.exists() {
        // In development mode, try to find Skill-Box in project directory
        let dev_source = std::env::current_dir()
            .ok()
            .map(|p| p.join("Skill-Box"));

        if let Some(dev_path) = dev_source {
            if dev_path.exists() {
                info!("Development mode: Found Skill-Box at {:?}", dev_path);
                return install_from_source(&dev_path, &target_dir, &metadata_path).await;
            }
        }

        warn!(
            "Bundled plugins source not found at {:?} (normal in dev mode)",
            bundled_source
        );
        return Ok(vec![]);
    }

    install_from_source(&bundled_source, &target_dir, &metadata_path).await
}

/// Install plugins from a source directory
async fn install_from_source(
    source_dir: &Path,
    target_dir: &Path,
    metadata_path: &Path,
) -> Result<Vec<String>> {
    // 3. Read source marketplace.json for version
    let source_manifest = read_marketplace_manifest(source_dir)?;
    let source_version = &source_manifest.version;

    // 4. Check if update is needed
    let needs_install = should_install(metadata_path, source_version)?;

    if !needs_install {
        info!(
            "Bundled plugins are up to date (version {})",
            source_version
        );
        return Ok(vec![]);
    }

    info!("Installing bundled plugins version {}...", source_version);

    // 5. Remove old installation if exists
    if target_dir.exists() {
        info!("Removing old installation at: {:?}", target_dir);
        fs::remove_dir_all(target_dir).context("Failed to remove old bundled plugins directory")?;
    }

    // 6. Copy directory recursively
    info!("Copying plugins from {:?} to {:?}", source_dir, target_dir);
    copy_dir_recursive(source_dir, target_dir)?;

    // 7. Register marketplace via official CLI command
    register_marketplace_via_cli(target_dir)?;

    // 8. Get plugin names and save metadata
    let plugin_names: Vec<String> = source_manifest
        .plugins
        .iter()
        .map(|p| p.name.clone())
        .collect();

    save_installation_metadata(metadata_path, source_version, &plugin_names)?;

    info!(
        "Successfully installed {} bundled plugins (Skill-Box v{})",
        plugin_names.len(),
        source_version
    );

    Ok(plugin_names)
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Get the status of bundled plugins installation
#[tauri::command]
pub async fn get_bundled_plugins_status() -> Result<Option<BundledPluginsStatus>, String> {
    let metadata_path = get_metadata_path().map_err(|e| e.to_string())?;

    if !metadata_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    let metadata: BundledPluginsStatus =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse metadata: {}", e))?;

    Ok(Some(metadata))
}

/// Manually trigger bundled plugins installation (for UI button if needed)
#[tauri::command]
pub async fn install_bundled_plugins_command(app: AppHandle) -> Result<Vec<String>, String> {
    install_bundled_plugins(&app).await.map_err(|e| e.to_string())
}

/// Force reinstall bundled plugins (ignore version check)
#[tauri::command]
pub async fn force_reinstall_bundled_plugins(app: AppHandle) -> Result<Vec<String>, String> {
    // Delete metadata to force reinstall
    if let Ok(metadata_path) = get_metadata_path() {
        let _ = fs::remove_file(&metadata_path);
    }

    install_bundled_plugins(&app)
        .await
        .map_err(|e| e.to_string())
}
