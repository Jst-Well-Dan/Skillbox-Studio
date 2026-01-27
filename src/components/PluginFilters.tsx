import { Input } from "./ui/input";
import { Search } from "lucide-react";

interface PluginFiltersProps {
    filters: {
        search: string;
        scope: "all" | "global" | "project";
        agent: string | null;
    };
    onFilterChange: (filters: any) => void;
    agents: string[];
}

export function PluginFilters({
    filters,
    onFilterChange,
    agents,
}: PluginFiltersProps) {
    return (
        <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search plugins..."
                    className="pl-8"
                    value={filters.search}
                    onChange={(e) =>
                        onFilterChange({
                            ...filters,
                            search: e.target.value,
                        })
                    }
                />
            </div>

            <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filters.scope}
                onChange={(e) =>
                    onFilterChange({
                        ...filters,
                        scope: e.target.value as any,
                    })
                }
            >
                <option value="all">All Scopes</option>
                <option value="global">Global</option>
                <option value="project">Project</option>
            </select>

            <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filters.agent || "all"}
                onChange={(e) =>
                    onFilterChange({
                        ...filters,
                        agent: e.target.value === "all" ? null : e.target.value,
                    })
                }
            >
                <option value="all">All Agents</option>
                {agents.map((agent) => (
                    <option key={agent} value={agent}>
                        {agent}
                    </option>
                ))}
            </select>
        </div>
    );
}
