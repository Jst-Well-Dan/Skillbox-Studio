use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// 已安装插件信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledPlugin {
    pub name: String,
    pub category: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub installed_at: String,
    pub location: PluginLocation,
    pub agents: Vec<String>,
    pub skills: Vec<String>,
    pub size_bytes: u64,
    pub paths_by_agent: HashMap<String, String>, // agent_id -> path
    pub source_type: Option<String>, // "Marketplace" or "LocalDirectory"
}

// 插件安装位置信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginLocation {
    pub scope: String, // "global" 或 "project"
    pub project_path: Option<String>,
    pub paths: Vec<String>,
}

// 扫描结果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanResult {
    pub total_count: usize,
    pub by_scope: ScanSummary,
    pub by_agent: HashMap<String, usize>,
    pub plugins: Vec<InstalledPlugin>,
}

// 扫描统计
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanSummary {
    pub global: usize,
    pub project: usize,
}

// 卸载结果
#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct UninstallResult {
    pub success: bool,
    pub removed_paths: Vec<String>,
    pub failed_paths: Vec<String>,
    pub message: String,
}

// 安装历史记录
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryRecord {
    pub id: String,
    pub plugin_name: String,
    pub agents: Vec<String>,
    pub scope: String,
    pub project_path: Option<String>,
    pub operation: String, // "install" | "uninstall"
    pub installed_at: String,
    pub status: String, // "success", "partial", "failed"
    pub error_message: Option<String>,
    pub skills_installed: Vec<String>,
}

// 历史文件格式
#[derive(Debug, Serialize, Deserialize)]
pub struct HistoryFile {
    pub version: String,
    pub records: Vec<HistoryRecord>,
    pub last_updated: String,
}

// 批量删除结果
#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct BatchDeleteResult {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub details: Vec<String>,
}


// --- New Configuration Types ---

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AppConfig {
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub general: GeneralSettings,
    #[serde(default)]
    pub marketplace: MarketplaceConfig,
    #[serde(default)]
    pub agents: AgentsConfig,
    #[serde(default)]
    pub advanced: AdvancedSettings,
}

fn default_version() -> String {
    "1.0".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeneralSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_startup_page")]
    pub startup_page: String,
    #[serde(default = "default_card_density")]
    pub card_density: String,
    #[serde(default = "true_val")]
    pub auto_check_updates: bool,
    #[serde(default = "true_val")]
    pub confirm_before_install: bool,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            language: default_language(),
            startup_page: default_startup_page(),
            card_density: default_card_density(),
            auto_check_updates: true,
            confirm_before_install: true,
        }
    }
}

fn default_theme() -> String { "light".to_string() }
fn default_language() -> String { "zh-CN".to_string() }
fn default_startup_page() -> String { "install".to_string() }
fn default_card_density() -> String { "comfortable".to_string() }
fn true_val() -> bool { true }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketplaceConfig {
    #[serde(default)]
    pub repositories: Vec<RepositoryInfo>,
}

impl Default for MarketplaceConfig {
    fn default() -> Self {
        Self {
            repositories: vec![
                RepositoryInfo {
                    id: "skillbox-official".to_string(),
                    name: "Skillbox".to_string(),
                    url: "https://github.com/Jst-Well-Dan/Skill-Box".to_string(),
                    repo_type: "official".to_string(),
                    enabled: true,
                    priority: 0,
                    local_path: "../Skill-Box".to_string(),
                    last_updated: chrono::Utc::now().to_rfc3339(),
                    auth_type: "public".to_string(),
                }
            ]
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepositoryInfo {
    pub id: String,
    pub name: String,
    pub url: String,
    #[serde(rename = "type")]
    pub repo_type: String, // "official" | "custom"
    pub enabled: bool,
    pub priority: u32,
    pub local_path: String,
    pub last_updated: String,
    #[serde(default = "default_auth_type")]
    pub auth_type: String, // "public" | "ssh" | "token"
}

fn default_auth_type() -> String { "public".to_string() }

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AgentsConfig {
    #[serde(default)]
    pub custom_paths: HashMap<String, String>,
    #[serde(default)]
    pub custom_icons: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdvancedSettings {
    #[serde(default)]
    pub debug_mode: bool,
    #[serde(default = "true_val")]
    pub cache_enabled: bool,
    #[serde(default = "default_max_history")]
    pub max_history_records: u32,
}

impl Default for AdvancedSettings {
    fn default() -> Self {
        Self {
            debug_mode: false,
            cache_enabled: true,
            max_history_records: 500,
        }
    }
}

fn default_max_history() -> u32 { 500 }


#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct UpdateResult {
    pub success: bool,
    pub changes: String,
    pub commits: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub plugin_count: u32,
}

// --- Local Skills Types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalSkill {
    pub name: String,
    pub description: String,
    pub path: String,  // 本地路径 (绝对路径)
    pub source: SkillSource,  // 来源标记
    pub has_scripts: bool,
    pub has_references: bool,
    pub has_assets: bool,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SkillSource {
    Marketplace,  // 来自 Skill-Box/marketplace.json
    LocalDirectory,  // 来自本地导入
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalSkillScanResult {
    pub success: bool,
    pub path: String,
    pub skills_found: Vec<LocalSkill>,
    pub error_message: Option<String>,
    pub total_skills: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalDirectory {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalSkillsRegistry {
    pub registered_directories: Vec<LocalDirectory>,  // 已注册的本地skills目录
    pub last_updated: String,  // ISO 8601 时间戳
}

