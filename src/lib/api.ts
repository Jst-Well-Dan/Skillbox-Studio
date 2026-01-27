

import { invoke } from "@tauri-apps/api/core";

export interface AgentConfig {
    id: string;
    name: string;
    project_path: string;
    global_path: string;
    icon: string;
}

export interface Author {
    name: string;
    url: string;
}

export interface Plugin {
    name: string;
    description: string;
    category?: string;
    author?: Author;
    authors?: Author[];
    skills: string[];
    source_repo?: string;
    source_url?: string;
}

export interface MarketplaceData {
    name?: string;
    version?: string;
    plugins: Plugin[];
}

export async function getAgents(): Promise<AgentConfig[]> {
    return invoke("get_agents");
}

export async function getMarketplaceData(): Promise<MarketplaceData> {
    return invoke("get_marketplace_data");
}

export async function installPlugin(
    pluginName: string,
    agents: string[],
    scopeType: "global" | "project",
    scopePath?: string
): Promise<string> {
    return invoke("install_plugin", {
        pluginName,
        agents,
        scopeType,
        scopePath
    });
}

// 已安装插件管理接口

export interface PluginLocation {
    scope: "global" | "project";
    project_path?: string;
    paths: string[];
}

export interface InstalledPlugin {
    name: string;
    category?: string;
    description?: string;
    version?: string;
    installed_at: string;
    location: PluginLocation;
    agents: string[];
    skills: string[];
    size_bytes: number;
    paths_by_agent: Record<string, string>;
    source_type?: string;
}

export interface ScanSummary {
    global: number;
    project: number;
}

export interface ScanResult {
    total_count: number;
    by_scope: ScanSummary;
    by_agent: Record<string, number>;
    plugins: InstalledPlugin[];
}




export interface HistoryRecord {
    id: string;
    plugin_name: string;
    agents: string[];
    scope: string;
    operation: string; // "install" | "uninstall"
    installed_at: string;
    status: string; // "success" | "failed"
    error_message?: string;
}


export async function scanInstalledPlugins(
    scope?: "global" | "project",
    projectPath?: string
): Promise<ScanResult> {
    return invoke("scan_installed_plugins", { scope, projectPath });
}

export async function searchInstalledPlugins(
    query: string,
    scope?: "global" | "project",
    projectPath?: string
): Promise<InstalledPlugin[]> {
    return invoke("search_installed_plugins", {
        query,
        scope,
        projectPath
    });
}




// 历史记录管理
export interface HistoryStats {
    total_records: number;
    total_installs: number;
    total_uninstalls: number;
    successful_installs: number;
    failed_installs: number;
    last_updated: string;
}

export async function getInstallHistory(
    limit?: number,
    pluginName?: string
): Promise<HistoryRecord[]> {
    return invoke("get_install_history", { limit, pluginName });
}

export async function clearInstallHistory(
    beforeDate?: string
): Promise<number> {
    return invoke("clear_install_history", { before_date: beforeDate });
}

export async function getHistoryStats(): Promise<HistoryStats> {
    return invoke("get_history_stats");
}

export async function openProjectFolder(path: string): Promise<void> {
    return invoke("open_project_folder", { path });
}

// Settings & Git Config
import { AppConfig, GeneralSettings, RepositoryInfo } from "./types_config";

export async function addMarketplaceRepository(
    url: string,
    name: string,
    authType: string,
    authToken?: string
): Promise<RepositoryInfo> {
    return invoke("add_marketplace_repository", { url, name, authType, authToken });
}

export async function validateMarketplaceRepository(path: string): Promise<any> {
    return invoke("validate_marketplace_repository", { path });
}

export async function getAppConfig(): Promise<AppConfig> {
    return invoke("get_app_config");
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
    return invoke("save_app_config", { config });
}

export async function updateGeneralSettings(settings: GeneralSettings): Promise<void> {
    return invoke("update_general_settings", { settings });
}

export async function addRepositoryToConfig(repo: RepositoryInfo): Promise<void> {
    return invoke("add_repository_to_config", { repo });
}

export async function removeRepositoryFromConfig(repoId: string): Promise<void> {
    return invoke("remove_repository_from_config", { repoId });
}

export async function updateRepositoryEnabled(repoId: string, enabled: boolean): Promise<void> {
    return invoke("update_repository_enabled", { repoId, enabled });
}

export async function updateRepositoryInConfig(repoId: string, name: string, url: string): Promise<void> {
    return invoke("update_repository_in_config", { repoId, name, url });
}

// --- Local Skills API ---

export interface LocalSkill {
    name: string;
    description: string;
    path: string;
    source: 'Marketplace' | 'LocalDirectory';
    has_scripts: boolean;
    has_references: boolean;
    has_assets: boolean;
    size_bytes: number;
}

export interface LocalSkillScanResult {
    success: boolean;
    path: string;
    skills_found: LocalSkill[];
    error_message?: string;
    total_skills: number;
}

export interface LocalDirectory {
    path: string;
    name: string;
}

export async function scanLocalSkills(directory: string): Promise<LocalSkillScanResult> {
    return invoke<LocalSkillScanResult>('scan_local_skills', { directory });
}

export async function registerLocalDirectory(path: string, name?: string): Promise<boolean> {
    return invoke<boolean>('register_local_directory', { path, name });
}

export async function unregisterLocalDirectory(path: string): Promise<boolean> {
    return invoke<boolean>('unregister_local_directory', { path });
}

export async function listRegisteredDirectories(): Promise<LocalDirectory[]> {
    return invoke<LocalDirectory[]>('list_registered_directories');
}

export async function updateLocalDirectory(path: string, name: string): Promise<boolean> {
    return invoke<boolean>('update_local_directory', { path, name });
}

export async function installLocalSkill(
    skillPath: string,
    scope: "global" | "project",
    selectedAgents: string[],
    scopePath?: string
): Promise<string> {
    return invoke("install_local_skill", {
        skillPath,
        scope,
        selectedAgents,
        scopePath
    });
}
