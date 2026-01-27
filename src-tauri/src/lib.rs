mod commands;
mod types;

use commands::{agent_config, marketplace, plugin_installer, plugin_scanner, install_history, system};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            agent_config::get_agents,
            marketplace::get_marketplace_data,
            plugin_installer::install_plugin,
            plugin_scanner::scan_installed_plugins,
            plugin_scanner::search_installed_plugins,
            install_history::get_install_history,
            install_history::clear_install_history,
            install_history::get_history_stats,
            system::open_project_folder,
            // Git & Config
            commands::git_manager::add_marketplace_repository,
            commands::git_manager::validate_marketplace_repository,
            commands::config_manager::get_app_config,
            commands::config_manager::save_app_config,
            commands::config_manager::update_general_settings,
            commands::config_manager::add_repository_to_config,
            commands::config_manager::remove_repository_from_config,
            commands::config_manager::update_repository_enabled,
            commands::config_manager::update_repository_in_config,
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
