import { useState, useEffect } from "react";
import {
    scanInstalledPlugins,
    ScanResult,
    getInstallHistory,
    clearInstallHistory,
    HistoryRecord,
    searchInstalledPlugins,
} from "../lib/api";
import { useDebounce } from "../lib/hooks";
import { InstalledPluginCard } from "./InstalledPluginCard";

import { PluginFilters } from "./PluginFilters";
import { InstallHistoryPanel } from "./InstallHistoryPanel";
import { Button } from "./ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";


interface FilterState {
    search: string;
    scope: "all" | "global" | "project";
    agent: string | null;
}

export function InstalledPluginsPage() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<FilterState>({
        search: "",
        scope: "all",
        agent: null,
    });
    const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);

    const [history, setHistory] = useState<HistoryRecord[]>([]);

    // 防抖处理搜索关键字
    const debouncedSearch = useDebounce(filters.search, 300);

    // 初始加载
    useEffect(() => {
        loadData();
        loadHistory();
    }, []);

    // 当防抖关键字或筛选条件改变时，重新加载数据
    useEffect(() => {
        if (debouncedSearch) {
            handleBackendSearch();
        } else {
            loadData();
        }
    }, [debouncedSearch, filters.scope, filters.agent]);

    const loadData = async () => {
        setLoading(true);
        try {
            const scope = filters.scope === "all" ? undefined : filters.scope;
            const result = await scanInstalledPlugins(scope);
            setScanResult(result);
            setError(null);
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleBackendSearch = async () => {
        setLoading(true);
        try {
            const scope = filters.scope === "all" ? undefined : filters.scope;
            const plugins = await searchInstalledPlugins(
                debouncedSearch,
                scope
            );

            // 将搜索结果更新到 scanResult 中
            setScanResult(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    plugins: plugins
                };
            });
            setError(null);
        } catch (e: any) {
            console.error("Backend search failed:", e);
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async () => {
        try {
            const records = await getInstallHistory(50); // 最近50条
            setHistory(records);
        } catch (e) {
            console.error("Failed to load history:", e);
        }
    };



    // 清除历史
    const handleClearHistory = async () => {
        if (!confirm("确定要清除所有历史记录吗？")) return;

        try {
            const count = await clearInstallHistory();
            alert(`已清除 ${count} 条历史记录`);
            await loadHistory();
        } catch (e: any) {
            alert(`清除历史失败: ${e.toString()}`);
        }
    };


    // 筛选插件列表
    // 当存在 debouncedSearch 时，scanResult.plugins 已经是由后端 search_installed_plugins 过滤并排序后的结果
    const filteredPlugins = scanResult?.plugins.filter((plugin) => {
        // 如果没有搜索词，则进行基础的前端范围/代理过滤
        if (!debouncedSearch) {
            const matchScope =
                filters.scope === "all" || plugin.location.scope === filters.scope;
            const matchAgent =
                !filters.agent || plugin.agents.includes(filters.agent);
            return matchScope && matchAgent;
        }
        // 如果有搜索词，后端已经处理了搜索匹配，这里只需确保符合当前选中的 scope/agent（虽然后端也包含这些参数，但前端二次过滤更安全）
        const matchScope =
            filters.scope === "all" || plugin.location.scope === filters.scope;
        const matchAgent =
            !filters.agent || plugin.agents.includes(filters.agent);
        return matchScope && matchAgent;
    }) || [];

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">
                        {t('installed_plugins.loading')}
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-6 space-y-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <h1 className="text-xl font-bold">{t('installed_plugins.load_failed')}</h1>
                <p className="text-muted-foreground">{error}</p>
                <Button onClick={loadData}>{t('common.retry')}</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-4 p-6">


            {/* 筛选器 */}
            <PluginFilters
                filters={filters}
                onFilterChange={setFilters}
                agents={[...new Set(scanResult?.plugins.flatMap((p) => p.agents) || [])].sort()}
            />



            {/* 插件列表 */}
            {filteredPlugins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <p>{t('installed_plugins.no_plugins')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-1">
                    {filteredPlugins.map((plugin) => (
                        <InstalledPluginCard
                            key={plugin.name}
                            plugin={plugin}
                            selectedAgent={filters.agent}
                            isSelected={selectedPlugins.includes(plugin.name)}
                            onSelect={(selected) => {
                                setSelectedPlugins((prev) =>
                                    selected
                                        ? [...prev, plugin.name]
                                        : prev.filter((p) => p !== plugin.name)
                                );
                            }}
                        />
                    ))}
                </div>
            )}

            {/* 历史记录面板 */}
            <InstallHistoryPanel
                history={history}
                onClear={handleClearHistory}
            />
        </div>
    );
}
