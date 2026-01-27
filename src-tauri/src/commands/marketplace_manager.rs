use std::path::Path;
use crate::commands::marketplace::{MarketplaceData, Plugin};
use crate::types::AppConfig;

pub fn aggregate_marketplace_data(config: &AppConfig) -> MarketplaceData {
    let mut all_plugins: Vec<Plugin> = Vec::new();
    
    // Sort repositories by priority (ascending or descending? Design doc says "Handle plugin conflicts (priority mechanism)").
    // Let's assume lower number = higher priority (1 is top), or higher = higher?
    // Usually 1 is top.
    // However, if we simply process in order, we can check if plugin exists.
    // Let's sort by priority value.
    let mut repos = config.marketplace.repositories.clone();
    repos.sort_by_key(|r| r.priority);

    for repo in repos {
        if !repo.enabled {
            continue;
        }

        let path = Path::new(&repo.local_path).join(".claude-plugin").join("marketplace.json");
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(data) = serde_json::from_str::<MarketplaceData>(&content) {
                    for mut plugin in data.plugins {
                        // Check for duplicates
                        // If we process high priority first, we keep the first one we see.
                        if !all_plugins.iter().any(|p| p.name == plugin.name) {
                            plugin.source_repo = Some(repo.name.clone());
                            plugin.source_url = Some(repo.url.clone());
                            all_plugins.push(plugin);
                        }
                    }
                }
            }
        }
    }

    MarketplaceData {
        name: Some("Skillbox Studio Aggregated Marketplace".to_string()),
        version: Some(config.version.clone()),
        plugins: all_plugins,
    }
}
