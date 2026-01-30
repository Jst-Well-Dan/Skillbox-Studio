import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Settings } from "lucide-react";

import { SettingsDialog } from "./settings/SettingsDialog";
import { getAppConfig } from "../lib/api";
import { AppConfig } from "../lib/types_config";
import { useTheme } from "./ThemeProvider";

interface TopbarProps {
    currentPage: "install" | "installed";
    onPageChange: (page: "install" | "installed") => void;
    currentStep?: number;
    onRefresh?: () => void;
    showTranslated?: boolean;
    onToggleTranslation?: (enabled: boolean) => void;
    translationStatus?: 'idle' | 'translating' | 'translated' | 'error';
    translationConfig?: {
        enabled: boolean;
        api_key: string;
    } | null;
    onTranslationError?: (message: string) => void;
}

import { Loader2, Check, AlertCircle, Languages } from "lucide-react";

export function Topbar({ currentPage, onPageChange, currentStep, onRefresh, showTranslated, onToggleTranslation, translationStatus, translationConfig, onTranslationError }: TopbarProps) {
    const { t, i18n } = useTranslation();
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
            // Sync i18n with backend config
            if (cfg.general.language) {
                const i18nLang = cfg.general.language === 'zh-CN' ? 'zh' : cfg.general.language;
                if (i18n.language !== i18nLang) {
                    i18n.changeLanguage(i18nLang);
                }
            }
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

    // 语言切换处理函数
    const handleLanguageToggle = () => {
        const currentLang = i18n.language;
        const newLang = currentLang === 'en' ? 'zh' : 'en';

        // 切换语言
        i18n.changeLanguage(newLang);

        // 如果切换到英文，自动关闭AI翻译
        if (newLang === 'en' && showTranslated && onToggleTranslation) {
            onToggleTranslation(false);
        }
    };

    // AI翻译切换处理函数
    const handleTranslationToggle = () => {
        if (!onToggleTranslation) return;

        // 如果当前是英文模式，不允许启用AI翻译
        if (i18n.language === 'en') {
            onTranslationError?.("仅支持中文翻译");
            return;
        }

        const newState = !showTranslated;

        // 如果要启用翻译，检查配置
        if (newState) {
            if (!translationConfig || !translationConfig.enabled) {
                onTranslationError?.("翻译功能未启用，请在设置中开启并配置 API Key。");
                return;
            }
            if (!translationConfig.api_key) {
                onTranslationError?.("未配置翻译 API Key，请在设置中填写后重试。");
                return;
            }
        }

        onToggleTranslation(newState);
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
                            <span>{t('topbar.agents')}</span>
                        </div>
                        <div className="w-8 h-px bg-border"></div>
                        <div className={`flex items-center gap-2 ${currentStep >= 3 ? "text-primary" : "text-muted-foreground"}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${currentStep >= 3 ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>3</div>
                            <span>{t('topbar.scope')}</span>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-1">
                    {/* 语言切换按钮 - 优化为文字图标，去除硬编码颜色，通过文字直观展示 */}
                    <button
                        onClick={handleLanguageToggle}
                        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium text-sm tracking-tight"
                        title={i18n.language === 'en' ? t('topbar.language_en', 'English - Click for Chinese') : t('topbar.language_zh', '中文 - 点击切换至英文')}
                    >
                        {i18n.language === 'en' ? 'En' : '中'}
                    </button>

                    {/* AI翻译按钮 - 与技能详情页保持一致 */}
                    {onToggleTranslation && i18n.language !== 'en' && (
                        <button
                            onClick={handleTranslationToggle}
                            disabled={translationStatus === 'translating'}
                            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${translationStatus === 'translating'
                                ? 'bg-primary/20 text-primary'
                                : translationStatus === 'error'
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                    : showTranslated
                                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                }`}
                            title={
                                translationStatus === 'translating'
                                    ? t('topbar.ai_translation_translating', '正在翻译...')
                                    : translationStatus === 'error'
                                        ? t('topbar.ai_translation_error', '翻译失败，请检查设置')
                                        : showTranslated
                                            ? t('topbar.ai_translation_disable', '关闭AI翻译')
                                            : t('topbar.ai_translation_enable', '启用AI翻译')
                            }
                        >
                            {translationStatus === 'translating' ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>{t('topbar.translating', '翻译中...')}</span>
                                </>
                            ) : translationStatus === 'error' ? (
                                <>
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <span>{t('topbar.error', '错误')}</span>
                                </>
                            ) : showTranslated ? (
                                <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>{t('topbar.translated', '已翻译')}</span>
                                </>
                            ) : (
                                <>
                                    <Languages className="h-3.5 w-3.5" />
                                    <span>{t('topbar.translate', '翻译')}</span>
                                </>
                            )}
                        </button>
                    )}

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
