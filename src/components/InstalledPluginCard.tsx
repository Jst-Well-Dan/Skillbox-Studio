import { memo, useState } from "react";
import { InstalledPlugin, openProjectFolder } from "../lib/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { FolderOpen } from "lucide-react";

interface InstalledPluginCardProps {
    plugin: InstalledPlugin;
    selectedAgent?: string | null;
    isSelected: boolean;
    onSelect: (selected: boolean) => void;
}

export const InstalledPluginCard = memo(function InstalledPluginCard({
    plugin,
    selectedAgent,
    isSelected,
    onSelect,
}: InstalledPluginCardProps) {
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

    // Check if description is long enough to need truncation
    const isLongDescription = (plugin.description?.length || 0) > 100;

    return (
        <Card
            className={`flex flex-col transition-all ${isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
                }`}
        >
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg flex-1">{plugin.name}</CardTitle>
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onSelect(!!checked)}
                        className="pointer-events-auto"
                    />
                </div>
                <div className="flex flex-wrap gap-1">
                    {plugin.agents.map(agent => (
                        <Badge key={agent} className="w-fit font-mono text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80">
                            {agent}
                        </Badge>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="flex-1">
                <div className="mb-3">
                    <p className={`text-sm text-muted-foreground ${isExpanded ? "" : "line-clamp-2"}`}>
                        {plugin.description}
                    </p>
                    {isLongDescription && (
                        <button
                            className="text-xs text-primary hover:underline mt-1 bg-transparent border-none p-0 h-auto cursor-pointer font-medium"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                        >
                            {isExpanded ? "收起" : "显示更多"}
                        </button>
                    )}
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                    <div>
                        <span className="font-medium">作用域:</span>{" "}
                        {plugin.location.scope === 'global' ? '全局' : '项目'}
                    </div>


                    <div>
                        <span className="font-medium">大小:</span>{" "}
                        {formatSize(plugin.size_bytes)}
                    </div>
                    <div>
                        <span className="font-medium">安装时间:</span>{" "}
                        {formatDate(plugin.installed_at)}
                    </div>
                </div>
            </CardContent>

            <CardFooter className="border-t p-3">
                <button
                    onClick={handleOpenFolder}
                    className="h-9 px-3 w-full bg-background border border-input text-foreground hover:bg-accent hover:text-accent-foreground rounded-md flex items-center justify-center transition-colors text-sm font-medium"
                    title="打开安装目录"
                >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    打开文件夹
                </button>
            </CardFooter>
        </Card>
    );
});
