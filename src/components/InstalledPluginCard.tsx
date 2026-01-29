import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { InstalledPlugin, openProjectFolder } from "../lib/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { FolderOpen, ChevronDown } from "lucide-react";

interface InstalledPluginCardProps {
    plugin: InstalledPlugin;
    selectedAgent?: string | null;
    translatedName?: string;
    translatedDesc?: string;
    showTranslated?: boolean;
}

export const InstalledPluginCard = memo(function InstalledPluginCard({
    plugin,
    selectedAgent,
    translatedName,
    translatedDesc,
    showTranslated = false,
}: InstalledPluginCardProps) {
    const { t } = useTranslation();
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString();
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleOpenFolder = async () => {
        let path = "";

        // Strategy: 
        // 1. If agent is selected, look for that agent's path
        // 2. Fallback to first available path
        if (selectedAgent && plugin.paths_by_agent && plugin.paths_by_agent[selectedAgent]) {
            path = plugin.paths_by_agent[selectedAgent];
        } else if (plugin.location.paths.length > 0) {
            path = plugin.location.paths[0];
        }

        if (path) {
            try {
                await openProjectFolder(path);
            } catch (e) {
                console.error("Failed to open folder:", e);
            }
        }
    };

    const [isExpanded, setIsExpanded] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const displayName = showTranslated ? (translatedName || plugin.name) : plugin.name;
    const displayDesc = showTranslated ? (translatedDesc || plugin.description) : plugin.description;

    // Check if description is long enough to need truncation
    const isLongDescription = (displayDesc?.length || 0) > 100;

    return (
        <Card
            className="flex flex-col transition-all border-border hover:border-primary/50"
        >
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg flex-1">{displayName}</CardTitle>
                </div>
                <div className="flex flex-wrap gap-1">
                    {plugin.agents.map(agent => (
                        <Badge key={agent} className="w-fit font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/80">
                            {agent}
                        </Badge>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="flex-1">
                <div className="mb-3">
                    <p className={`text-sm text-muted-foreground ${isExpanded ? "" : "line-clamp-2"}`}>
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
                            {isExpanded ? t('common.show_less') : t('common.show_more')}
                        </button>
                    )}
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                    <div>
                        <span className="font-medium">{t('plugin_card.scope')}:</span>{" "}
                        {plugin.location.scope === 'global' ? t('install_scope.global') : t('install_scope.project')}
                    </div>


                    <div>
                        <span className="font-medium">{t('plugin_card.size')}:</span>{" "}
                        {formatSize(plugin.size_bytes)}
                    </div>
                    <div>
                        <span className="font-medium">{t('plugin_card.installed_at')}:</span>{" "}
                        {formatDate(plugin.installed_at)}
                    </div>

                </div>
            </CardContent>

            <CardFooter className="border-t p-3 relative">
                {(() => {
                    const availableAgents = plugin.paths_by_agent ? Object.keys(plugin.paths_by_agent) : [];
                    const isMultiAgent = availableAgents.length > 1;

                    return (
                        <>
                            {showMenu && isMultiAgent && (
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowMenu(false)}
                                />
                            )}

                            <div className="w-full relative">
                                <button
                                    onClick={() => {
                                        if (isMultiAgent) {
                                            setShowMenu(!showMenu);
                                        } else {
                                            handleOpenFolder();
                                        }
                                    }}
                                    className="h-9 px-3 w-full bg-background border border-input text-foreground hover:bg-accent hover:text-accent-foreground rounded-md flex items-center justify-center transition-colors text-sm font-medium"
                                    title={t('plugin_card.open_folder')}
                                >
                                    <FolderOpen className="h-4 w-4 mr-2" />
                                    {t('plugin_card.open_folder')}
                                    {isMultiAgent && <ChevronDown className="h-4 w-4 ml-2 opacity-50" />}
                                </button>

                                {showMenu && isMultiAgent && (
                                    <div className="absolute bottom-full left-0 w-full mb-1 bg-popover text-popover-foreground border rounded-md shadow-lg z-50 overflow-hidden flex flex-col p-1 min-w-[200px]">
                                        {availableAgents.map(agent => (
                                            <button
                                                key={agent}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm flex items-center justify-between transition-colors cursor-pointer"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const path = plugin.paths_by_agent[agent];
                                                    if (path) {
                                                        try {
                                                            await openProjectFolder(path);
                                                        } catch (e) {
                                                            console.error("Failed to open folder:", e);
                                                        }
                                                    }
                                                    setShowMenu(false);
                                                }}
                                            >
                                                <span className="font-medium capitalize">{agent}</span>
                                                <span className="inline-flex items-center rounded-sm border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                                                    {t('plugin_card.open_folder')}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    );
                })()}
            </CardFooter>
        </Card>
    );
});
