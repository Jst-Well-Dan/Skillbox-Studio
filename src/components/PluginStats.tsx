import { Card } from "./ui/card";

interface PluginStatsProps {
    total: number;
    global: number;
    project: number;
    byAgent: Record<string, number>;
}

export function PluginStats({
    total,
    global,
    project,
    byAgent,
}: PluginStatsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
                <div className="text-2xl font-bold text-primary">{total}</div>
                <div className="text-xs text-muted-foreground">
                    Total Plugins
                </div>
            </Card>
            <Card className="p-4">
                <div className="text-2xl font-bold text-primary">{global}</div>
                <div className="text-xs text-muted-foreground">Global</div>
            </Card>
            <Card className="p-4">
                <div className="text-2xl font-bold text-primary">{project}</div>
                <div className="text-xs text-muted-foreground">Project</div>
            </Card>
            <Card className="p-4">
                <div className="text-2xl font-bold text-primary">
                    {Object.keys(byAgent).length}
                </div>
                <div className="text-xs text-muted-foreground">
                    Agents w/ Plugins
                </div>
            </Card>
        </div>
    );
}
