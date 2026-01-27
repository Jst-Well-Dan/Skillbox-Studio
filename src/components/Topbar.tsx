import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Settings } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SettingsDialog } from "./settings/SettingsDialog";
import { getAppConfig } from "../lib/api";
import { AppConfig } from "../lib/types_config";
import { useTheme } from "./ThemeProvider";

interface TopbarProps {
    currentPage: "install" | "installed";
    onPageChange: (page: "install" | "installed") => void;
    currentStep?: number;
    onRefresh?: () => void;
}

export function Topbar({ currentPage, onPageChange, currentStep, onRefresh }: TopbarProps) {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [config, setConfig] = useState<AppConfig | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);
    const loadConfig = async () => {
        try {
            const cfg = await getAppConfig();
            setConfig(cfg);
        } catch (e) {
            console.error("Failed to load config", e);
        }
    };

    const handleConfigChange = async (newConfig: AppConfig) => {
        setConfig(newConfig);
    };

    const toggleTheme = () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
    };

    return (
        <>
            <div className="h-14 border-b flex items-center px-6 justify-between bg-card text-card-foreground shadow-sm z-10 relative">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 font-bold text-lg text-primary">
                        <img src="/Skillbox.svg" className="h-6 w-6" alt="Skillbox Studio" />
                        <span>Skillbox Studio</span>
                    </div>

                    {/* 页面导航标签 */}
                    <div className="flex gap-4 border-l border-r px-4">
                        <button
                            onClick={() => onPageChange("install")}
                            className={`text-sm font-medium transition-colors ${currentPage === "install"
                                ? "text-primary border-b-2 border-primary -mb-3.5 pb-3.5"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {t('topbar.install')}
                        </button>
                        <button
                            onClick={() => onPageChange("installed")}
                            className={`text-sm font-medium transition-colors ${currentPage === "installed"
                                ? "text-primary border-b-2 border-primary -mb-3.5 pb-3.5"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {t('topbar.installed')}
                        </button>
                    </div>
                </div>

                {/* 步骤指示器（仅在Install页面显示） */}
                {currentPage === "install" && currentStep && (
                    <div className="hidden md:flex items-center gap-6 text-sm font-medium">
                        <div className={`flex items-center gap-2 ${currentStep >= 1 ? "text-primary" : "text-muted-foreground"}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${currentStep >= 1 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>1</div>
                            <span>{t('topbar.market')}</span>
                        </div>
                        <div className="w-8 h-px bg-border"></div>
                        <div className={`flex items-center gap-2 ${currentStep >= 2 ? "text-primary" : "text-muted-foreground"}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${currentStep >= 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>2</div>
                            <span>{t('topbar.scope')}</span>
                        </div>
                        <div className="w-8 h-px bg-border"></div>
                        <div className={`flex items-center gap-2 ${currentStep >= 3 ? "text-primary" : "text-muted-foreground"}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${currentStep >= 3 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>3</div>
                            <span>{t('topbar.agents')}</span>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-1">
                    <LanguageSwitcher />
                    <button
                        onClick={toggleTheme}
                        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                    <button
                        onClick={() => {
                            loadConfig(); // Reload config when opening
                            setIsSettingsOpen(true);
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Settings className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {config && (
                <SettingsDialog
                    open={isSettingsOpen}
                    onClose={() => {
                        setIsSettingsOpen(false);
                        if (onRefresh) onRefresh();
                    }}
                    config={config}
                    onConfigChange={handleConfigChange}
                />
            )}
        </>
    )
}
