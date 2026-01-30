import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { message, ask } from '@tauri-apps/plugin-dialog';
import { Plugin, LocalSkill, addMarketplaceRepository, addRepositoryToConfig, removeRepositoryFromConfig, updateRepositoryInConfig, getAppConfig, getPluginSkillsDetails, SkillMetadata, translateBatch } from "../lib/api";
import { RepositoryInfo } from "../lib/types_config";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Search, Globe, FolderOpen, Plus, Loader2, X, Pencil, Trash2, Check } from "lucide-react";
import { LocalSkillsPanel } from "./LocalSkillsPanel";
import { SkillsDetailModal } from "./SkillsDetailModal";
import { cn, extractNameFromUrl } from "../lib/utils";

interface SkillMarketProps {
    plugins: Plugin[];
    selectedPlugins: string[];
    onTogglePlugin: (name: string) => void;
    onNext: () => void;
    onLocalInstall?: (skills: LocalSkill[]) => void;
    onRefresh?: () => void;
    // Smart Translation Props (Controlled Component Pattern)
    showTranslated?: boolean;
    onTranslationStatusChange?: (status: 'idle' | 'translating' | 'translated' | 'error') => void;
    translationConfig?: {
        enabled: boolean;
        api_key: string;
    } | null;
    onTranslationError?: (message: string) => void;
}

interface MarketplaceCardProps {
    plugin: Plugin;
    isSelected: boolean;
    onToggle: (name: string) => void;
    t: any;
    translatedName?: string;
    translatedDesc?: string;
    showTranslated: boolean;
    translationConfig?: {
        enabled: boolean;
        api_key: string;
    } | null;
    onTranslationError?: (message: string) => void;
}

function MarketplaceCard({ plugin: p, isSelected, onToggle, t, translatedName, translatedDesc, showTranslated, translationConfig, onTranslationError }: MarketplaceCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [skillsData, setSkillsData] = useState<SkillMetadata[]>([]);
    const [isLoadingSkills, setIsLoadingSkills] = useState(false);

    // Dynamic display logic
    // 1. Try static i18n key
    // 2. If showTranslated is true, use translated prop
    // 3. Fallback to original

    // Check if static translation exists (heuristic: returned string != key/defaultValue)
    const nameKey = `skills.${p.name}.name`;
    const staticName = t(nameKey, { ns: 'marketplace', defaultValue: p.name });
    const hasStaticName = staticName !== p.name && staticName !== nameKey;

    const descKey = `skills.${p.name}.description`;
    const staticDesc = t(descKey, { ns: 'marketplace', defaultValue: p.description });
    const hasStaticDesc = staticDesc !== p.description && staticDesc !== descKey;

    const displayName = hasStaticName ? staticName : (showTranslated ? (translatedName || p.name) : p.name);
    const displayDesc = hasStaticDesc ? staticDesc : (showTranslated ? (translatedDesc || p.description) : p.description);


    const cat = p.category || "Uncategorized";
    const displayCategory = (p.source_repo !== "Skillbox" && cat === "Uncategorized" && p.source_url)
        ? (extractNameFromUrl(p.source_url) || cat)
        : cat;

    const isLongDescription = (displayDesc?.length || 0) > 100;

    const handleOpenSkillsModal = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsModalOpen(true);

        // Load skills details if not already loaded
        if (skillsData.length === 0 && !isLoadingSkills) {
            setIsLoadingSkills(true);
            try {
                const details = await getPluginSkillsDetails(p.name, p.skills);
                setSkillsData(details.skills);
            } catch (error) {
                console.error("Failed to load skills details:", error);
                // Fallback: create basic skill metadata from paths
                setSkillsData(
                    p.skills.map(skillPath => ({
                        name: skillPath.split('/').pop() || skillPath,
                        description: `Skill from ${skillPath}`
                    }))
                );
            } finally {
                setIsLoadingSkills(false);
            }
        }
    };

    return (
        <>
            <Card
                className={`flex flex-col transition-all cursor-pointer border h-full ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                onClick={() => onToggle(p.name)}
            >
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-lg leading-tight break-words">{displayName}</CardTitle>
                        <div className="pt-1">
                            <Checkbox checked={isSelected} className="pointer-events-none" />
                        </div>
                    </div>
                    <Badge className="w-fit mt-2 capitalize">{displayCategory.replace("-", " ")}</Badge>
                </CardHeader>
                <CardContent className="flex-1">
                    <p className={`text-sm text-muted-foreground ${isExpanded ? "" : "line-clamp-3"}`} title={!isExpanded ? displayDesc : undefined}>
                        {displayDesc}
                    </p>
                    {isLongDescription && (
                        <button
                            className="text-xs text-primary hover:underline mt-1 bg-transparent border-none p-0 h-auto cursor-pointer font-medium"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                        >
                            {isExpanded ? t('common.show_less', '收起') : t('common.show_more', '显示更多')}
                        </button>
                    )}
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground justify-between border-t p-4 mt-auto bg-muted/20">
                    <button
                        className="hover:text-primary hover:bg-muted transition-colors font-medium cursor-pointer bg-transparent border-none px-2 py-1 -ml-2 rounded-md h-auto"
                        onClick={handleOpenSkillsModal}
                        title="点击查看该插件包含的所有技能"
                    >
                        {p.source_repo ? `${p.source_repo} • ` : ""}{p.skills.length} {t('skill_market.skills', 'skills')}
                    </button>
                    <span className="truncate max-w-[50%] text-right">{p.author?.name || (p.authors ? p.authors[0].name : "Unknown")}</span>
                </CardFooter>
            </Card>

            {/* Skills Detail Modal */}
            <SkillsDetailModal
                isOpen={isModalOpen}
                pluginName={displayName}
                skills={skillsData}
                onClose={() => setIsModalOpen(false)}
                isLoading={isLoadingSkills}
                translationConfig={translationConfig}
                onTranslationError={onTranslationError}
            />
        </>
    );
}

export function SkillMarket({ plugins, selectedPlugins, onTogglePlugin, onNext, onLocalInstall, onRefresh, showTranslated = false, onTranslationStatusChange, translationConfig, onTranslationError }: SkillMarketProps) {
    const { t, i18n } = useTranslation();
    const [view, setView] = useState<'marketplace' | 'local'>('marketplace');
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string>("all");
    const [source, setSource] = useState<string>("all");

    // Translation State - Cache only, status controlled by prop
    const [translationCache, setTranslationCache] = useState<Record<string, { name: string, description: string }>>({});

    // Add Repo State
    const [isAddingRepo, setIsAddingRepo] = useState(false);
    const [newRepoUrl, setNewRepoUrl] = useState("");
    const [isAddingLoading, setIsAddingLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // Repository Management State
    const [repositories, setRepositories] = useState<RepositoryInfo[]>([]);
    const [editingRepoId, setEditingRepoId] = useState<string | null>(null);
    const [editRepoName, setEditRepoName] = useState("");
    const [editRepoUrl, setEditRepoUrl] = useState("");

    // Load repositories
    useEffect(() => {
        loadRepositories();
    }, []);

    const loadRepositories = async () => {
        try {
            const config = await getAppConfig();
            setRepositories(config.marketplace.repositories);
        } catch (e) {
            console.error("Failed to load repo config", e);
        }
    };

    const handleStartEdit = (e: React.MouseEvent, repo: RepositoryInfo) => {
        e.stopPropagation();
        setEditingRepoId(repo.id);
        setEditRepoName(repo.name);
        setEditRepoUrl(repo.url);
    };

    const handleCancelEdit = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingRepoId(null);
        setEditRepoName("");
        setEditRepoUrl("");
    };

    const handleUpdateRepo = async (e: React.MouseEvent | React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!editingRepoId) return;

        try {
            await updateRepositoryInConfig(editingRepoId, editRepoName, editRepoUrl);
            await loadRepositories();
            setEditingRepoId(null);
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error("Failed to update repo", err);
            // Optionally set an error state here
        }
    };

    const handleRemoveRepo = async (e: React.MouseEvent, repoId: string) => {
        e.stopPropagation();
        const confirmed = await ask(t('dialogs.confirm_remove_repository'), {
            title: t('dialogs.titles.confirm_remove'),
            kind: 'warning',
        });
        if (!confirmed) return;

        try {
            await removeRepositoryFromConfig(repoId);
            await loadRepositories();
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error("Failed to remove repo", err);
        }
    };

    const handleAddRepo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRepoUrl) return;

        setIsAddingLoading(true);
        setAddError(null);

        try {
            // 1. Validate & Clone
            const repoInfo = await addMarketplaceRepository(newRepoUrl, extractNameFromUrl(newRepoUrl), "public"); // Automatically extract name from URL
            // 2. Add to config
            await addRepositoryToConfig(repoInfo);
            // 3. Refresh
            await loadRepositories();
            if (onRefresh) onRefresh();

            setIsAddingRepo(false);
            setNewRepoUrl("");
        } catch (err: any) {
            setAddError(err.toString());
        } finally {
            setIsAddingLoading(false);
        }
    };

    const categories = useMemo(() => {
        const cats = new Set(plugins.map(p => p.category || "Uncategorized"));
        return ["all", ...Array.from(cats)].sort();
    }, [plugins]);

    const sources = useMemo(() => {
        const srcs = new Set([
            ...plugins.map(p => p.source_repo || "Unknown"),
            ...repositories.map(r => r.name)
        ]);
        return ["all", ...Array.from(srcs)].sort();
    }, [plugins, repositories]);

    const filtered = useMemo(() => {
        return plugins.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.description.toLowerCase().includes(search.toLowerCase());
            const cat = p.category || "Uncategorized";
            const matchCat = category === "all" || cat === category;
            const src = p.source_repo || "Unknown";
            const matchSource = source === "all" || src === source;
            return matchSearch && matchCat && matchSource;
        });
    }, [plugins, search, category, source]);

    const handleLocalInstall = async (skills: LocalSkill[]) => {
        if (onLocalInstall) {
            onLocalInstall(skills);
        } else {
            // Fallback if not provided
            await message(t('dialogs.local_install_handler_missing', { count: skills.length }), {
                title: t('dialogs.titles.warning'),
                kind: "warning"
            });
        }
    };

    // Smart Translation Logic
    useEffect(() => {
        if (showTranslated) {
            handleTranslateFiltered();
        }
    }, [showTranslated, plugins, search, category, source]);

    const handleTranslateFiltered = async () => {
        // Only translate if showTranslated is ON
        if (!showTranslated) return;
        if (!translationConfig || !translationConfig.enabled) {
            onTranslationError?.("翻译功能未启用，请在设置中开启并配置 API Key。");
            if (onTranslationStatusChange) onTranslationStatusChange('idle');
            return;
        }
        if (!translationConfig.api_key) {
            onTranslationError?.("未配置翻译 API Key，请在设置中填写后重试。");
            if (onTranslationStatusChange) onTranslationStatusChange('idle');
            return;
        }

        const itemsToTranslate = filtered.filter(p => !translationCache[p.name]);

        if (itemsToTranslate.length === 0) {
            // Already cached/translated
            if (onTranslationStatusChange) onTranslationStatusChange('translated');
            return;
        }

        if (onTranslationStatusChange) onTranslationStatusChange('translating');

        try {
            // Translate names and descriptions
            const texts: string[] = [];
            itemsToTranslate.forEach(p => {
                texts.push(p.name);
                texts.push(p.description);
            });

            const targetLang = i18n.language.startsWith('zh') ? 'zh' : 'en';

            const results = await translateBatch(texts, targetLang);

            setTranslationCache(prev => {
                const newCache = { ...prev };
                itemsToTranslate.forEach((p, index) => {
                    const nameIdx = index * 2;
                    const descIdx = index * 2 + 1;

                    const tName = results[nameIdx];
                    const tDesc = results[descIdx];

                    newCache[p.name] = {
                        name: tName || p.name,
                        description: tDesc || p.description
                    };
                });
                return newCache;
            });

            if (onTranslationStatusChange) onTranslationStatusChange('translated');
        } catch (error) {
            console.error("Batch translation failed:", error);
            if (onTranslationStatusChange) onTranslationStatusChange('error');
            onTranslationError?.(error?.toString?.() || "Translation failed");
            setTimeout(() => {
                if (onTranslationStatusChange) onTranslationStatusChange('idle');
            }, 3000);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex items-center px-6 pt-6 pb-2 border-b">
                <div className="flex space-x-1 bg-muted p-1 rounded-lg">
                    <button
                        onClick={() => setView('marketplace')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                            view === 'marketplace'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        <Globe className="h-4 w-4" />
                        {t('skill_market.marketplace')}
                    </button>
                    <button
                        onClick={() => setView('local')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                            view === 'local'
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        <FolderOpen className="h-4 w-4" />
                        {t('skill_market.local_skills')}
                    </button>
                </div>
            </div>

            {view === 'marketplace' ? (
                <div className="flex h-full gap-6 p-6 min-h-0">
                    {/* Sidebar: Sources */}
                    <div className="w-64 flex flex-col gap-4 border-r border-border/40 pr-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-foreground">{t('skill_market.sources')}</h3>
                            <Button
                                onClick={() => setIsAddingRepo(!isAddingRepo)}
                                title={t('skill_market.add_source')}
                                className="h-8 w-8 border border-input bg-muted/60 text-foreground hover:bg-accent hover:text-accent-foreground p-0 transition-all hover:scale-105 active:scale-95 shadow-sm"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {isAddingRepo && (
                            <div className="p-3 border rounded-md bg-muted/30 text-sm space-y-2 mb-2">
                                <form onSubmit={handleAddRepo}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-medium">{t('skill_market.add_repository')}</span>
                                        <button type="button" onClick={() => setIsAddingRepo(false)}><X className="h-3 w-3" /></button>
                                    </div>
                                    <Input
                                        placeholder="https://github.com/..."
                                        className="h-8 text-xs mb-2"
                                        value={newRepoUrl}
                                        onChange={e => setNewRepoUrl(e.target.value)}
                                        disabled={isAddingLoading}
                                    />
                                    {addError && <p className="text-red-500 text-xs mb-2 truncate" title={addError}>{addError}</p>}
                                    <Button className="w-full h-7 text-xs" disabled={isAddingLoading}>
                                        {isAddingLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                        {t('skill_market.add')}
                                    </Button>
                                </form>
                            </div>
                        )}

                        <div className="flex flex-col gap-2 overflow-y-auto pr-2">
                            <div
                                className={cn(
                                    "group flex items-center justify-between p-2 rounded-md text-sm cursor-pointer transition-colors",
                                    source === "all" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                )}
                                onClick={() => setSource("all")}
                            >
                                <div className="truncate flex-1 font-medium">
                                    {t('skill_market.all_sources')}
                                </div>
                            </div>

                            {sources.filter(s => s !== "all").map(s => {
                                // Find matching repository config
                                const repo = repositories.find(r => r.name === s);
                                const isCustom = repo && repo.type !== 'official';
                                const isEditing = repo && editingRepoId === repo.id;

                                return (
                                    <div
                                        key={s}
                                        className={cn(
                                            "group flex items-center justify-between p-2 rounded-md text-sm cursor-pointer transition-colors min-h-[36px]",
                                            source === s ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                        )}
                                        onClick={() => !isEditing && setSource(s)}
                                    >
                                        {isEditing ? (
                                            <div className="flex items-center gap-2 flex-1 w-full" onClick={e => e.stopPropagation()}>
                                                <Input
                                                    value={editRepoName}
                                                    onChange={e => setEditRepoName(e.target.value)}
                                                    className="h-7 text-xs flex-1 px-2"
                                                    autoFocus
                                                />
                                                <div className="flex items-center">
                                                    <button
                                                        onClick={handleUpdateRepo}
                                                        className="p-1 hover:text-green-600 transition-colors"
                                                        title={t('common.save')}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="p-1 hover:text-red-600 transition-colors"
                                                        title={t('common.cancel')}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="truncate flex-1 font-medium" title={s}>
                                                    {s}
                                                </div>
                                                {isCustom && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => handleStartEdit(e, repo!)}
                                                            className="p-1 text-muted-foreground hover:text-primary rounded-md hover:bg-background/80 transition-colors"
                                                            title={t('settings.marketplace.edit_repository')}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRemoveRepo(e, repo!.id)}
                                                            className="p-1 text-muted-foreground hover:text-destructive rounded-md hover:bg-background/80 transition-colors"
                                                            title={t('settings.marketplace.remove_repository')}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Content: Plugins */}
                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                        <div className="flex gap-4 items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('skill_market.search_placeholder')}
                                    className="pl-8"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Translation Toggle */}


                            <select
                                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-48"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            >
                                {categories.map(c => <option key={c} value={c}>{c === "all" ? t('skill_market.all_categories') : c}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center justify-between pb-2 border-b border-border/40">
                            <div>
                                <h3 className="font-semibold text-lg text-foreground">
                                    {source === "all" ? t('skill_market.all_sources') : source}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {t('skill_market.plugins_found', { count: filtered.length })}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto min-h-0 flex-1 pr-2 pb-2">
                            {filtered.map(p => (
                                <MarketplaceCard
                                    key={p.name}
                                    plugin={p}
                                    isSelected={selectedPlugins.includes(p.name)}
                                    onToggle={onTogglePlugin}
                                    t={t}
                                    translatedName={translationCache[p.name]?.name}
                                    translatedDesc={translationCache[p.name]?.description}
                                    showTranslated={showTranslated}
                                    translationConfig={translationConfig}
                                    onTranslationError={onTranslationError}
                                />
                            ))}
                        </div>

                        <div className="border-t pt-4 flex justify-between items-center mt-auto">
                            <span className="text-sm text-muted-foreground">{t('skill_market.selected_plugins', { count: selectedPlugins.length })}</span>
                            <Button onClick={onNext} disabled={selectedPlugins.length === 0} className="px-8">
                                {t('skill_market.next')}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 p-6 min-h-0 overflow-hidden">
                    <LocalSkillsPanel onInstall={handleLocalInstall} />
                </div>
            )}
        </div>
    );
}
