import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { AgentConfig, getAgents } from "../../lib/api";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";

export function AgentSettings() {
    const { t } = useTranslation();
    const [agents, setAgents] = useState<AgentConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Store array of ENABLED agent IDs
    const [enabledAgents, setEnabledAgents] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem("enabled_community_agents");
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        loadAgents();
    }, []);

    useEffect(() => {
        localStorage.setItem("enabled_community_agents", JSON.stringify(enabledAgents));
        // Dispath storage event to notify other tabs/components if needed
        window.dispatchEvent(new Event("storage"));
    }, [enabledAgents]);

    const loadAgents = async () => {
        setLoading(true);
        try {
            const list = await getAgents();
            setAgents(list);
        } catch (e) {
            console.error("Failed to load agents", e);
        } finally {
            setLoading(false);
        }
    };

    const toggleAgent = (id: string) => {
        setEnabledAgents(prev =>
            prev.includes(id)
                ? prev.filter(a => a !== id)
                : [...prev, id]
        );
    };

    const communityAgents = agents.filter(a => a.category !== "Core");
    const filteredAgents = communityAgents.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-medium">{t('settings.agents.title', 'Agent Visibility')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.agents.subtitle', 'Enable additional agents to appear in the installation selector.')}</p>
            </div>

            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={t('settings.agents.search_placeholder', 'Search community agents...')}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="border rounded-md flex-1 overflow-hidden flex flex-col">
                <div className="bg-muted/50 p-3 border-b text-xs font-semibold text-muted-foreground flex justify-between">
                    <span>{t('settings.agents.community_agents', 'Community Agents')}</span>
                    <span>{filteredAgents.length}</span>
                </div>
                <div className="overflow-y-auto p-2">
                    {loading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">{t('common.loading')}...</div>
                    ) : filteredAgents.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            {searchQuery ? t('settings.agents.no_results', 'No agents found matching your search.') : t('settings.agents.empty', 'No community agents available.')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1">
                            {filteredAgents.map(agent => (
                                <label
                                    key={agent.id}
                                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                >
                                    <Checkbox
                                        checked={enabledAgents.includes(agent.id)}
                                        onCheckedChange={() => toggleAgent(agent.id)}
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm flex items-center gap-2">
                                            {agent.name}
                                            <span className="text-xs text-muted-foreground font-normal px-1.5 py-0.5 bg-muted rounded">
                                                {agent.id}
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                                            {agent.global_path}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="text-xs text-muted-foreground">
                <p>{t('settings.agents.core_note', '* Core agents (Claude, Cursor, etc.) are always visible.')}</p>
            </div>
        </div>
    );
}
