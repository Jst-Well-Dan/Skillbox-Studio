export interface AppConfig {
    version: string;
    general: GeneralSettings;
    marketplace: MarketplaceConfig;
    agents: AgentsConfig;
    advanced: AdvancedSettings;
}

export interface GeneralSettings {
    theme: string; // "light" | "dark" | "auto"
    language: string; // "en" | "zh-CN"
    startup_page: string;
    card_density: string;
    auto_check_updates: boolean;
    confirm_before_install: boolean;
}

export interface MarketplaceConfig {
    repositories: RepositoryInfo[];
}

export interface RepositoryInfo {
    id: string;
    name: string;
    url: string;
    type: "official" | "custom";
    enabled: boolean;
    priority: number;
    local_path: string;
    last_updated: string;
    auth_type: string; // "public" | "ssh" | "token"
}

export interface AgentsConfig {
    custom_paths: Record<string, string>;
    custom_icons: Record<string, string>;
}

export interface AdvancedSettings {
    debug_mode: boolean;
    cache_enabled: boolean;
    max_history_records: number;
}
