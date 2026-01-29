import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, RefreshCw, Trash2, CheckCircle, AlertCircle, Volume2 } from 'lucide-react';
import {
    getTranslationConfig,
    updateTranslationConfig,
    clearTranslationCache,
    getTranslationCacheStats,
    translateText,
    TranslationConfig,
    CacheStats
} from '../../lib/api';

interface TranslationSettingsProps {
    config?: any; // We load config internally, but keeping signature consistent
    onChange?: (config: any) => void;
}

export const TranslationSettings: React.FC<TranslationSettingsProps> = () => {
    const { t } = useTranslation();
    const [config, setConfig] = useState<TranslationConfig>({
        enabled: false,
        api_base_url: "https://open.bigmodel.cn/api/paas/v4",
        api_key: "",
        model: "GLM-4-Flash",
        timeout_seconds: 30,
        cache_ttl_seconds: 86400,
        enable_response_translation: true
    });

    const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cfg, stats] = await Promise.all([
                getTranslationConfig(),
                getTranslationCacheStats()
            ]);
            setConfig(cfg);
            setCacheStats(stats);
        } catch (error) {
            console.error("Failed to load translation data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateTranslationConfig(config);
            setTestResult({ success: true, message: t('settings.translation.save_success') });
            setTimeout(() => setTestResult(null), 3000);
        } catch (error) {
            setTestResult({ success: false, message: `${t('settings.translation.save_failed')}: ${error}` });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setSaving(true);
        setTestResult(null);
        try {
            // Temporarily save config first to ensure backend uses new key
            await updateTranslationConfig(config);

            const result = await translateText("Hello World", "zh");
            if (result && result.length > 0) {
                setTestResult({ success: true, message: `${t('settings.translation.test_success')}: ${result}` });
                loadData(); // Refresh stats
            } else {
                throw new Error("Empty response");
            }
        } catch (error) {
            setTestResult({ success: false, message: `${t('settings.translation.test_failed')}: ${error}` });
        } finally {
            setSaving(false);
        }
    };

    const handleClearCache = async () => {
        if (!confirm(t('settings.translation.confirm_clear'))) return;

        setClearing(true);
        try {
            await clearTranslationCache();
            loadData(); // Refresh stats
        } catch (error) {
            console.error("Failed to clear cache:", error);
        } finally {
            setClearing(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Volume2 className="w-5 h-5 text-primary" />
                    {t('settings.translation.title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {t('settings.translation.description')}
                </p>
            </div>

            <div className="grid gap-6">
                <div className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/30 p-4">
                    <input
                        id="translation-enabled"
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-primary"
                        checked={config.enabled}
                        onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    />
                    <label htmlFor="translation-enabled" className="space-y-1">
                        <div className="text-sm font-medium">{t('settings.translation.enabled')}</div>
                        <div className="text-xs text-muted-foreground">{t('settings.translation.enabled_hint')}</div>
                    </label>
                </div>

                <div className="grid gap-2">
                    <label className="text-sm font-medium">{t('settings.translation.api_key')}</label>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={config.api_key}
                            onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                            className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="sk-..."
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t('settings.translation.get_api_key_prefix')}<a href="https://open.bigmodel.cn" target="_blank" rel="noreferrer" className="text-primary hover:underline">open.bigmodel.cn</a>{t('settings.translation.get_api_key_suffix')}
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">{t('settings.translation.model')}</label>
                        <input
                            type="text"
                            value={config.model}
                            onChange={(e) => setConfig({ ...config, model: e.target.value })}
                            className="px-3 py-2 bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">{t('settings.translation.api_base_url')}</label>
                        <input
                            type="text"
                            value={config.api_base_url}
                            onChange={(e) => setConfig({ ...config, api_base_url: e.target.value })}
                            className="px-3 py-2 bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        <Save size={16} />
                        {t('settings.translation.save')}
                    </button>

                    <button
                        onClick={handleTestConnection}
                        disabled={saving || !config.api_key}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={saving ? "animate-spin" : ""} />
                        {t('settings.translation.test')}
                    </button>
                </div>

                {testResult && (
                    <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                        {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        {testResult.message}
                    </div>
                )}

                <div className="border-t border-border pt-6 mt-2">
                    <h4 className="text-base font-medium mb-4 flex items-center gap-2">
                        <RefreshCw size={16} />
                        {t('settings.translation.cache_stats')}
                    </h4>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-2xl font-bold">{cacheStats?.total_entries || 0}</div>
                            <div className="text-xs text-muted-foreground">{t('settings.translation.total')}</div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{cacheStats?.active_entries || 0}</div>
                            <div className="text-xs text-muted-foreground">{t('settings.translation.active')}</div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">{cacheStats?.expired_entries || 0}</div>
                            <div className="text-xs text-muted-foreground">{t('settings.translation.expired')}</div>
                        </div>
                    </div>

                    <button
                        onClick={handleClearCache}
                        disabled={clearing || !cacheStats?.total_entries}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                    >
                        <Trash2 size={16} />
                        {t('settings.translation.clear_cache')}
                    </button>
                </div>
            </div>
        </div>
    );
};
