import { useState, useEffect, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { AgentConfig } from "../lib/api";
import { Card, CardContent, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Bot, Terminal, Code2, Smartphone, Star } from "lucide-react";

const IconMap: Record<string, any> = {
    "claude": "/claude-ai-icon.svg",
    "cursor": "/cursor_light.svg",
    "windsurf": "/windsurf-light.svg",
    "github": "/copilot.svg",
    "github_copilot": "/copilot.svg",
    "gemini": "/gemini.svg",
    "trae": "/trae.svg",
    "roo": Bot,
    "code": Code2,
    "antigravity": "/antigravity.svg",
    "cline": "/cline.svg",
    "openclaw": "/clawdbot.svg",
    "goose": Bot,
    "opencode": "/opencode-wordmark-light.svg",
    "kilocode": "/kilocode-light.svg",
    "kiro": "/kiro-light.svg",
    "amp": Bot,
    "codex": "/openai.svg",
    "droid": RobotIcon,
    "mobile": Smartphone,
    "default": Terminal
}

function RobotIcon(props: any) {
    return <Bot {...props} />
}

interface AgentSelectorProps {
    agents: AgentConfig[];
    selectedAgents: string[];
    onToggleAgent: (id: string) => void;
    onBack: () => void;
    onNext: () => void;
}

export function AgentSelector({ agents, selectedAgents, onToggleAgent, onBack, onNext }: AgentSelectorProps) {
    const { t } = useTranslation();
    const [enabledCommunityAgents, setEnabledCommunityAgents] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem("enabled_community_agents");
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    const [starredAgents, setStarredAgents] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem("starred_agents");
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Failed to load starred agents", e);
            return [];
        }
    });

    // Listen for changes from SettingsDialog
    useEffect(() => {
        const handleStorageChange = () => {
            try {
                const saved = localStorage.getItem("enabled_community_agents");
                setEnabledCommunityAgents(saved ? JSON.parse(saved) : []);
            } catch (e) { }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem("starred_agents", JSON.stringify(starredAgents));
        } catch (e) {
            console.error("Failed to save starred agents", e);
        }
    }, [starredAgents]);

    const toggleStar = (e: MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent card click
        const isStarred = starredAgents.includes(id);

        if (!isStarred) {
            // If starring, also select it if not already selected
            if (!selectedAgents.includes(id)) {
                onToggleAgent(id);
            }
            setStarredAgents(prev => [...prev, id]);
        } else {
            setStarredAgents(prev => prev.filter(x => x !== id));
        }
    };

    // Filter agents: Show Core + Enabled Community
    const visibleAgents = agents.filter(agent => {
        if (agent.category === "Core" || !agent.category) return true;
        return enabledCommunityAgents.includes(agent.id);
    });

    const toggleAll = () => {
        if (selectedAgents.length === visibleAgents.length) {
            visibleAgents.filter(a => selectedAgents.includes(a.id)).forEach(a => onToggleAgent(a.id));
        } else {
            visibleAgents.forEach(a => {
                if (!selectedAgents.includes(a.id)) onToggleAgent(a.id);
            });
        }
    }

    // Sort agents: Starred first, then by original order
    const sortedAgents = [...visibleAgents].sort((a, b) => {
        const isAStarred = starredAgents.includes(a.id);
        const isBStarred = starredAgents.includes(b.id);
        if (isAStarred && !isBStarred) return -1;
        if (!isAStarred && isBStarred) return 1;
        return 0; // Keep original relative order
    });

    return (
        <div className="flex flex-col h-full p-6 max-w-5xl mx-auto w-full">
            <div className="relative mb-8">
                <h2 className="text-2xl font-bold mb-2 text-center">{t('agent_selector.title')}</h2>
                <div className="flex items-center justify-center relative min-h-[2rem]">
                    <p className="text-muted-foreground">{t('agent_selector.subtitle')}</p>
                    <div className="absolute right-0">
                        <Button
                            onClick={toggleAll}
                            style={{ height: '2rem', fontSize: '0.75rem' }}
                            className="border border-input bg-background text-foreground hover:bg-muted"
                        >
                            {selectedAgents.length === visibleAgents.length ? t('agent_selector.deselect_all') : t('agent_selector.select_all')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto min-h-0 flex-1 pr-2 pb-2">
                {sortedAgents.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center h-full text-muted-foreground p-8 border border-dashed rounded-lg">
                        <Bot className="h-10 w-10 mb-4 opacity-20" />
                        <p className="mb-2">{t('agent_selector.no_agents_visible', 'No agents visible.')}</p>
                        <p className="text-sm">{t('agent_selector.check_settings', 'Check Settings > Agents to enable more tools.')}</p>
                    </div>
                ) : sortedAgents.map(agent => {
                    const isSelected = selectedAgents.includes(agent.id);
                    const isStarred = starredAgents.includes(agent.id);
                    // Try exact match, then partial match, then fallback
                    let IconComponent = IconMap[agent.icon] || IconMap[agent.id];

                    if (!IconComponent) {
                        const key = Object.keys(IconMap).find(k =>
                            k !== "default" && (agent.id.toLowerCase().includes(k) || agent.icon.toLowerCase().includes(k))
                        );
                        if (key) IconComponent = IconMap[key];
                    }

                    if (!IconComponent) IconComponent = IconMap.default || Terminal;

                    return (
                        <Card
                            key={agent.id}
                            className={`cursor-pointer transition-all border-2 relative overflow-hidden group min-h-[130px] flex flex-col ${isSelected ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border hover:border-primary/50'}`}
                            onClick={() => onToggleAgent(agent.id)}
                        >
                            <div
                                className="absolute top-2 left-2 z-10 p-1 rounded-full hover:bg-muted/50 transition-colors"
                                onClick={(e) => toggleStar(e, agent.id)}
                                title={isStarred ? "Unstar" : "Star this agent"}
                            >
                                <Star className={`h-4 w-4 ${isStarred ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground/40 hover:text-yellow-500"}`} />
                            </div>

                            <div className="absolute top-2 right-2">
                                <Checkbox checked={isSelected} className="pointer-events-none" />
                            </div>
                            <CardContent className="flex flex-col items-center justify-center flex-1 px-4 pt-8 pb-4 text-center space-y-3">
                                <div className={`h-11 w-11 flex items-center justify-center transition-all duration-300 ${isSelected
                                    ? 'grayscale-0 opacity-100 scale-110'
                                    : 'grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105'
                                    }`}>
                                    {typeof IconComponent === 'string' ? (
                                        <img
                                            src={IconComponent}
                                            alt={agent.name}
                                            className={`h-full w-full object-contain ${agent.id.includes('opencode') || agent.id.includes('kilocode') ? 'scale-125' : ''}`}
                                            onError={(e) => {
                                                // Fallback to Lucide Bot if image fails to load
                                                e.currentTarget.style.display = 'none';
                                                const parent = e.currentTarget.parentElement;
                                                if (parent) {
                                                    parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bot h-full w-full"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>';
                                                }
                                            }}
                                        />
                                    ) : (
                                        <IconComponent className="h-full w-full" />
                                    )}
                                </div>
                                <CardTitle className={`text-sm font-medium transition-colors line-clamp-1 ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                    {agent.name}
                                </CardTitle>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <div className="flex justify-between mt-auto pt-4 border-t">
                <Button
                    className="border border-input bg-background text-foreground hover:bg-muted"
                    onClick={onBack}
                >
                    {t('common.back')}
                </Button>
                <Button
                    onClick={onNext}
                    disabled={selectedAgents.length === 0}
                    className="px-8 font-bold"
                >
                    {t('skill_market.next')}
                </Button>
            </div>
        </div>
    )
}
