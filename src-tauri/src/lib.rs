mod commands;
mod types;

use commands::{agent_config, marketplace, plugin_installer, plugin_scanner, install_history, system, skill_metadata, translator};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            skill_metadata::get_plugin_skills_details,
            skill_metadata::export_marketplace_catalog,
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
            // Local Skills
            commands::local_skills_scanner::scan_local_skills,
            commands::local_skills_registry::register_local_directory,
            commands::local_skills_registry::unregister_local_directory,
            commands::local_skills_registry::list_registered_directories,
            commands::local_skills_registry::update_local_directory,
            commands::local_skills_installer::install_local_skill,
            // Translation
            translator::translate,
            translator::translate_batch,
            translator::get_translation_config,
            translator::update_translation_config,
            translator::clear_translation_cache,
            translator::get_translation_cache_stats,
            translator::detect_text_language,
            translator::init_translation_service_command,
        ])


        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
