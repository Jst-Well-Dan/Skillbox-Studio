import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plugin } from "../lib/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Search } from "lucide-react";

interface SkillMarketProps {
    plugins: Plugin[];
    selectedPlugins: string[];
    onTogglePlugin: (name: string) => void;
    onNext: () => void;
}

export function SkillMarket({ plugins, selectedPlugins, onTogglePlugin, onNext }: SkillMarketProps) {
    const { t } = useTranslation();
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<string>("all");
    const [source, setSource] = useState<string>("all");

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

    return (
        <div className="flex flex-col h-full gap-4 p-6">
            <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('skill_market.search_placeholder', "Search plugins...")}
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
                    {categories.map(c => <option key={c} value={c}>{c === "all" ? t('skill_market.all_categories', "All Categories") : c}</option>)}
                </select>
                <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-48"
                    value={source}
                    onChange={e => setSource(e.target.value)}
                >
                    {sources.map(s => <option key={s} value={s}>{s === "all" ? t('skill_market.all_sources', "All Sources") : s}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto min-h-0 flex-1 pr-2 pb-2">
                {filtered.map(p => {
                    const isSelected = selectedPlugins.includes(p.name);
                    // Try to get translation, fallback to original
                    const displayName = t(`skills.${p.name}.name`, { ns: 'marketplace', defaultValue: p.name });
                    const displayDesc = t(`skills.${p.name}.description`, { ns: 'marketplace', defaultValue: p.description });

                    return (
                        <Card key={p.name}
                            className={`flex flex-col transition-all cursor-pointer border h-full ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                            onClick={() => onTogglePlugin(p.name)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="text-lg leading-tight break-words">{displayName}</CardTitle>
                                    <div className="pt-1">
                                        <Checkbox checked={isSelected} className="pointer-events-none" />
                                    </div>
                                </div>
                                <Badge className="w-fit mt-2 capitalize">{(p.category || "Uncategorized").replace("-", " ")}</Badge>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <p className="text-sm text-muted-foreground line-clamp-3">{displayDesc}</p>
                            </CardContent>
                            <CardFooter className="text-xs text-muted-foreground justify-between border-t p-4 mt-auto bg-muted/20">
                                <span>{p.source_repo ? `${p.source_repo} • ` : ""}{p.skills.length} skills</span>
                                <span className="truncate max-w-[50%] text-right">{p.author?.name || (p.authors ? p.authors[0].name : "Unknown")}</span>
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>

            <div className="border-t pt-4 flex justify-between items-center mt-auto">
                <span className="text-sm text-muted-foreground">Selected: <span className="font-medium text-foreground">{selectedPlugins.length}</span> plugins</span>
                <Button onClick={onNext} disabled={selectedPlugins.length === 0} className="px-8">
                    {t('skill_market.next')}
                </Button>
            </div>
        </div>
    );
}
