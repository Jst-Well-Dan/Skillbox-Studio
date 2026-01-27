import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { message } from '@tauri-apps/plugin-dialog';
import { Plugin, LocalSkill, addMarketplaceRepository, addRepositoryToConfig } from "../lib/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Search, Globe, FolderOpen, Plus, Loader2, X } from "lucide-react";
import { LocalSkillsPanel } from "./LocalSkillsPanel";
import { cn } from "../lib/utils";

interface SkillMarketProps {
    plugins: Plugin[];
    selectedPlugins: string[];
    onTogglePlugin: (name: string) => void;
    onNext: () => void;
    onLocalInstall?: (skills: LocalSkill[]) => void;
    onRefresh?: () => void;
}

interface MarketplaceCardProps {
    plugin: Plugin;
    isSelected: boolean;
    onToggle: (name: string) => void;
    t: any;
}

function MarketplaceCard({ plugin: p, isSelected, onToggle, t }: MarketplaceCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Try to get translation, fallback to original
    const displayName = t(`skills.${p.name}.name`, { ns: 'marketplace', defaultValue: p.name });
    const displayDesc = t(`skills.${p.name}.description`, { ns: 'marketplace', defaultValue: p.description });

    // Get GitHub owner from URL
    const getGithubOwner = (url?: string) => {
        if (!url) return null;
        try {
            const match = url.match(/(?:github\.com|gitee\.com)\/([^\/]+)/);
            if (match && match[1]) return match[1];
        } catch (e) { }
        return null;
    };

    const cat = p.category || "Uncategorized";
    const displayCategory = (p.source_repo !== "Skillbox" && cat === "Uncategorized" && p.source_url)
        ? (getGithubOwner(p.source_url) || cat)
        : cat;

    const isLongDescription = (displayDesc?.length || 0) > 100;

    return (
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
                <span>{p.source_repo ? `${p.source_repo} • ` : ""}{p.skills.length} {t('skill_market.skills', 'skills')}</span>
                <span className="truncate max-w-[50%] text-right">{p.author?.name || (p.authors ? p.authors[0].name : "Unknown")}</span>
            </CardFooter>
        </Card>
    );
}

export function SkillMarket({ plugins, selectedPlugins, onTogglePlugin, onNext, onLocalInstall, onRefresh }: SkillMarketProps) {
    const { t } = useTranslation();
    const [view, setView] = useState<'marketplace' | 'local'>('marketplace');
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string>("all");
    const [source, setSource] = useState<string>("all");

    // Add Repo State
    const [isAddingRepo, setIsAddingRepo] = useState(false);
    const [newRepoUrl, setNewRepoUrl] = useState("");
    const [isAddingLoading, setIsAddingLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    const handleAddRepo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRepoUrl) return;

        setIsAddingLoading(true);
        setAddError(null);

        try {
            // 1. Validate & Clone
            const repoInfo = await addMarketplaceRepository(newRepoUrl, "Custom Repo", "public"); // allow backend to name it or user? using simplified flow for now
            // 2. Add to config
            await addRepositoryToConfig(repoInfo);
            // 3. Refresh
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
        const srcs = new Set(plugins.map(p => p.source_repo || "Unknown"));
        return ["all", ...Array.from(srcs)].sort();
    }, [plugins]);

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

                            {sources.filter(s => s !== "all").map(s => (
                                <div
                                    key={s}
                                    className={cn(
                                        "group flex items-center justify-between p-2 rounded-md text-sm cursor-pointer transition-colors",
                                        source === s ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                    )}
                                    onClick={() => setSource(s)}
                                >
                                    <div className="truncate flex-1 font-medium" title={s}>
                                        {s}
                                    </div>
                                </div>
                            ))}
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
