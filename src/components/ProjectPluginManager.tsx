import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import type { MarketplaceDetail, PluginMetadata, CommandInfo, SkillInfo, AgentInfo } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Download, Trash2, Search, Package, Command, Users, Zap, Settings, Copy, Bot, Languages } from 'lucide-react';
import { translatePlugins } from '@/hooks/usePluginTranslation';

interface ProjectPluginManagerProps {
  projectPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type InstalledScope = 'project' | 'system';

type InstalledPlugin = PluginMetadata & { scope: InstalledScope };

type PluginInfoLike = {
  name: string;
  description?: string | null;
  version?: string;
  author?: string;
  marketplace?: string | null;
  path?: string;
  components?: {
    commands?: number;
    agents?: number;
    skills?: number;
    hooks?: number | boolean;
    mcp?: boolean;
    mcpServers?: number;
    mcp_servers?: number;
  };
};

export const ProjectPluginManager: React.FC<ProjectPluginManagerProps> = ({
  projectPath,
  open,
  onOpenChange,
}) => {
  const [marketplaces, setMarketplaces] = useState<MarketplaceDetail[]>([]);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [availablePlugins, setAvailablePlugins] = useState<PluginMetadata[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed' | 'capabilities'>('marketplace');
  const [capabilityTab, setCapabilityTab] = useState<'commands' | 'skills' | 'agents'>('commands');
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const hasMarketplaces = marketplaces.length > 0;
  const normalizedProjectPath = useMemo(
    () => projectPath.replace(/\\/g, '/').toLowerCase(),
    [projectPath]
  );

  const getPluginKey = (plugin: { name: string; marketplace?: string }) =>
    `${plugin.marketplace || 'local'}:${plugin.name}`;

  const detectScopeFromPath = (path?: string): InstalledScope => {
    if (!path) return 'system';
    const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
    return normalizedPath.includes(normalizedProjectPath) ? 'project' : 'system';
  };

  const normalizePluginInfo = (plugin: PluginInfoLike, scope: InstalledScope): InstalledPlugin => ({
    name: plugin.name,
    displayName: plugin.name,
    version: plugin.version || 'unknown',
    description: plugin.description || '已安装的插件',
    author: plugin.author ? { name: plugin.author } : undefined,
    category: 'general',
    marketplace: plugin.marketplace || (plugin.name.includes('@') ? plugin.name.split('@').slice(1).join('@') : 'local'),
    sourcePath: plugin.path || '',
    components: {
      commands: plugin.components?.commands ?? 0,
      agents: plugin.components?.agents ?? 0,
      skills: plugin.components?.skills ?? 0,
      hooks: Boolean(plugin.components?.hooks),
      mcp: Boolean(plugin.components?.mcp || plugin.components?.mcpServers || plugin.components?.mcp_servers),
    },
    scope,
  });

  // 语言切换状态
  const [language, setLanguage] = useState<'en' | 'zh'>(() => {
    const saved = localStorage.getItem('plugin-manager-language');
    return (saved === 'zh' || saved === 'en') ? saved : 'en';
  });
  const [translating, setTranslating] = useState(false);
  const [originalAvailablePlugins, setOriginalAvailablePlugins] = useState<PluginMetadata[]>([]);
  const [originalInstalledPlugins, setOriginalInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // 首次使用引导状态
  const [showWelcome, setShowWelcome] = useState(false);
  const WELCOME_DISMISSED_KEY = 'claude-workbench-project-plugin-welcome-dismissed';

  // 检查是否需要显示首次使用引导
  useEffect(() => {
    if (open) {
      const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY);
      if (!dismissed) {
        setShowWelcome(true);
      }
    }
  }, [open]);

  const handleWelcomeDismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    }
    setShowWelcome(false);
  };

  // 语言切换函数
  const toggleLanguage = async () => {
    const newLanguage = language === 'en' ? 'zh' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('plugin-manager-language', newLanguage);

    if (newLanguage === 'zh') {
      // 切换到中文：翻译所有插件
      setTranslating(true);
      try {
        const [translatedAvailable, translatedInstalled] = await Promise.all([
          translatePlugins(originalAvailablePlugins),
          translatePlugins(originalInstalledPlugins)
        ]);
        setAvailablePlugins(translatedAvailable);
        setInstalledPlugins(
          translatedInstalled.map((plugin, idx) => ({
            ...plugin,
            scope: originalInstalledPlugins[idx]?.scope || 'project'
          }))
        );
      } catch (error) {
        console.error('[Translation] Translation failed:', error);
      } finally {
        setTranslating(false);
      }
    } else {
      // 切换到英文：显示原始数据
      setAvailablePlugins(originalAvailablePlugins);
      setInstalledPlugins(originalInstalledPlugins);
    }
  };

  const handleTabChange = (value: string) => {
    if (value === 'marketplace' || value === 'installed' || value === 'capabilities') {
      setActiveTab(value);
    }
  };

  // Load commands
  const loadCommands = async () => {
    try {
      setCommandsLoading(true);
      const cmds = await api.getProjectCommands(projectPath);
      setCommands(cmds);
    } catch (error) {
      console.error('Failed to load commands:', error);
    } finally {
      setCommandsLoading(false);
    }
  };

  // Copy command to clipboard
  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
  };

  // Load skills
  const loadSkills = async () => {
    try {
      setSkillsLoading(true);
      const skls = await api.getProjectSkills(projectPath);
      setSkills(skls);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setSkillsLoading(false);
    }
  };

  // Load agents
  const loadAgents = async () => {
    try {
      setAgentsLoading(true);
      const agts = await api.getProjectAgents(projectPath);
      setAgents(agts);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setAgentsLoading(false);
    }
  };

  // Load marketplaces on mount
  useEffect(() => {
    if (open) {
      setActionMessage(null);
      loadMarketplaces();
      loadInstalledPlugins();
      loadCommands();
      loadSkills();
      loadAgents();
    }
  }, [open]);

  // Load plugins when marketplace changes
  useEffect(() => {
    if (selectedMarketplace) {
      loadAvailablePlugins(selectedMarketplace);
    }
  }, [selectedMarketplace]);

  // Ensure we always have a selected marketplace when data arrives
  useEffect(() => {
    if (!selectedMarketplace && marketplaces.length > 0) {
      setSelectedMarketplace(marketplaces[0].name);
    }
  }, [marketplaces, selectedMarketplace]);

  const loadMarketplaces = async () => {
    try {
      setLoading(true);
      const markets = await api.listKnownMarketplaces();
      setMarketplaces(markets);

      // Select first marketplace by default
      if (markets.length > 0 && !selectedMarketplace) {
        setSelectedMarketplace(markets[0].name);
      }
    } catch (error) {
      console.error('Failed to load marketplaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePlugins = async (marketplaceName: string) => {
    try {
      setLoading(true);
      const plugins = await api.listMarketplacePlugins(marketplaceName);
      // 保存原始数据
      setOriginalAvailablePlugins(plugins);
      // 如果当前是中文模式，立即翻译
      if (language === 'zh') {
        const translatedPlugins = await translatePlugins(plugins);
        setAvailablePlugins(translatedPlugins);
      } else {
        setAvailablePlugins(plugins);
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInstalledPlugins = async () => {
    try {
      // Only use listPlugins API - it now handles both system and project level plugins
      const scopedPlugins = await api.listPlugins(projectPath);

      // Backend returns "project" or "user", map "user" to "system"
      const normalizedPlugins = scopedPlugins.map((plugin: PluginInfoLike & { scope?: string }) => {
        const scope = plugin.scope === 'project' ? 'project' : 'system';
        return normalizePluginInfo(plugin, scope as InstalledScope);
      });

      // 保存原始数据
      setOriginalInstalledPlugins(normalizedPlugins);
      // 如果当前是中文模式，立即翻译
      if (language === 'zh') {
        const translatedPlugins = await translatePlugins(normalizedPlugins);
        setInstalledPlugins(
          translatedPlugins.map((plugin, idx) => ({
            ...plugin,
            scope: normalizedPlugins[idx]?.scope || 'system',
          }))
        );
      } else {
        setInstalledPlugins(normalizedPlugins);
      }
    } catch (error) {
      console.error('Failed to load installed plugins:', error);
    }
  };

  const handleInstall = async (plugin: PluginMetadata) => {
    const pluginKey = `${plugin.marketplace}:${plugin.name}`;
    setInstalling(prev => new Set(prev).add(pluginKey));

    try {
      await api.installPluginToProject(projectPath, plugin.marketplace, plugin.name);
      await loadInstalledPlugins(); // Refresh installed plugins
      setActiveTab('installed');
      setActionMessage({ type: 'success', text: `插件 "${plugin.displayName}" 安装完成` });
    } catch (error) {
      console.error('Failed to install plugin:', error);
      setActionMessage({ type: 'error', text: `安装失败: ${error}` });
      alert(`安装失败: ${error}`);
    } finally {
      setInstalling(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginKey);
        return newSet;
      });
    }
  };

  const handleUninstall = async (plugin: PluginMetadata) => {
    if (!confirm(`确定要卸载插件"${plugin.displayName}"吗？`)) {
      return;
    }

    const pluginKey = `${plugin.marketplace}:${plugin.name}`;
    setInstalling(prev => new Set(prev).add(pluginKey));

    try {
      await api.uninstallPluginFromProject(projectPath, plugin.marketplace, plugin.name);
      await loadInstalledPlugins(); // Refresh installed plugins
      setActionMessage({ type: 'success', text: `已卸载插件 "${plugin.displayName}"` });
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      setActionMessage({ type: 'error', text: `卸载失败: ${error}` });
      alert(`卸载失败: ${error}`);
    } finally {
      setInstalling(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginKey);
        return newSet;
      });
    }
  };

  // Check if plugin is installed and return scope
  const getInstalledScope = (plugin: PluginMetadata): InstalledScope | null => {
    const key = getPluginKey(plugin);
    const match = installedPlugins.find(
      p =>
        getPluginKey(p) === key ||
        (p.name === plugin.name && p.marketplace === plugin.marketplace)
    );
    return match?.scope || null;
  };

  const isInstalled = (plugin: PluginMetadata) => Boolean(getInstalledScope(plugin));

  const isInstalling = (plugin: PluginMetadata) => {
    const pluginKey = `${plugin.marketplace}:${plugin.name}`;
    return installing.has(pluginKey);
  };

  // Get all unique categories
  const categories = useMemo(() => {
    const cats = new Set(availablePlugins.map(p => p.category));
    return ['all', ...Array.from(cats).sort()];
  }, [availablePlugins]);

  const installedBreakdown = useMemo(() => {
    const projectCount = installedPlugins.filter(p => p.scope === 'project').length;
    const systemCount = installedPlugins.filter(p => p.scope === 'system').length;
    return {
      total: projectCount + systemCount,
      project: projectCount,
      system: systemCount,
    };
  }, [installedPlugins]);

  // Filter plugins
  const filteredPlugins = useMemo(() => {
    return availablePlugins.filter(plugin => {
      const matchesSearch =
        plugin.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [availablePlugins, searchQuery, selectedCategory]);

  return (
    <>
      {/* 首次使用引导对话框 */}
      <Dialog open={showWelcome} onOpenChange={() => handleWelcomeDismiss(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">欢迎使用项目能力管理！</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              这里可以为当前项目添加专属能力：
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Command className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">📜 斜杠命令</p>
                  <p className="text-xs text-muted-foreground">快捷操作，提升开发效率</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Bot className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">🤖 专用代理</p>
                  <p className="text-xs text-muted-foreground">自动化工作流，减少重复劳动</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">⚡ 技能</p>
                  <p className="text-xs text-muted-foreground">扩展 Claude 能力，应对专业场景</p>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium">💡 提示：</p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                <li>这些能力仅在当前项目生效</li>
                <li>不同项目可以有不同的能力组合</li>
                <li>安装后在"能力总览"查看详情</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleWelcomeDismiss(true)}>
              不再显示
            </Button>
            <Button onClick={() => handleWelcomeDismiss(false)}>
              开始探索
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 主对话框 */}
      <Dialog open={open && !showWelcome} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
          {/* 语言切换按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            disabled={translating}
            className="absolute top-4 right-12 z-50 gap-2"
            title={language === 'zh' ? '切换到英文' : '切换到中文'}
          >
            {translating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Languages className="w-4 h-4" />
            )}
            <span className="text-xs">{language === 'zh' ? '中' : 'EN'}</span>
          </Button>

          <DialogHeader>
            <DialogTitle>项目能力管理</DialogTitle>
            <DialogDescription>
              为当前项目添加插件，获得专属能力
              <span className="block mt-1 text-xs">
                📌 这些插件仅在当前项目生效，不影响其他项目
              </span>
            </DialogDescription>
          </DialogHeader>

        {actionMessage && (
          <div
            className={`mb-3 rounded-md border px-3 py-2 text-sm ${
              actionMessage.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : actionMessage.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {actionMessage.text}
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="marketplace">插件市场</TabsTrigger>
            <TabsTrigger value="installed">
              已安装 ({installedBreakdown.total})
            </TabsTrigger>
            <TabsTrigger value="capabilities">能力总览</TabsTrigger>
          </TabsList>

          {/* Marketplace Tab */}
          <TabsContent value="marketplace" className="flex-1 flex flex-col space-y-4 min-h-0">
            {/* Marketplace Selector and Filters */}
            <div className="flex gap-4">
              <Select
                value={hasMarketplaces ? selectedMarketplace : undefined}
                onValueChange={setSelectedMarketplace}
                disabled={!hasMarketplaces}
              >
                <SelectTrigger className="w-[200px]" disabled={!hasMarketplaces}>
                  <SelectValue
                    placeholder={hasMarketplaces ? '选择插件市场' : '未检测到插件市场'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {hasMarketplaces ? (
                    marketplaces.map(market => (
                      <SelectItem key={market.name} value={market.name}>
                        {market.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__no_market" disabled>
                      尚未发现可用的插件市场
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {!hasMarketplaces && (
                <p className="text-xs text-muted-foreground self-center">
                  尚未检测到市场，请先运行 `/plugin marketplace install` 安装官方市场
                </p>
              )}

              <div className="flex-1 relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索插件..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? '所有分类' : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plugin Grid */}
            <ScrollArea className="flex-1 min-h-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
                  {filteredPlugins.map(plugin => {
                    const installedScope = getInstalledScope(plugin);
                    const installed = Boolean(installedScope);
                    const installing = isInstalling(plugin);
                    const disableAction = installing || installedScope === 'system';

                    return (
                      <div
                        key={`${plugin.marketplace}:${plugin.name}`}
                        className="border rounded-lg p-4 hover:border-gray-400 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{plugin.displayName}</h3>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="secondary">{plugin.category}</Badge>
                              {installedScope && (
                                <Badge variant={installedScope === 'project' ? 'default' : 'outline'} className="text-xs">
                                  {installedScope === 'project' ? '项目级' : '系统级'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={installed && installedScope === 'project' ? 'destructive' : 'default'}
                            onClick={() => {
                              if (installedScope === 'project') {
                                handleUninstall(plugin);
                              } else if (!installed) {
                                handleInstall(plugin);
                              }
                            }}
                            disabled={disableAction}
                          >
                            {installing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : installedScope === 'project' ? (
                              <>
                                <Trash2 className="w-4 h-4 mr-1" />
                                卸载
                              </>
                            ) : installedScope === 'system' ? (
                              '系统已安装'
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-1" />
                                安装
                              </>
                            )}
                          </Button>
                        </div>

                        <p className="text-sm text-gray-600 mb-3">{plugin.description}</p>

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {plugin.components.commands > 0 && (
                            <span className="flex items-center gap-1">
                              <Command className="w-3 h-3" />
                              {plugin.components.commands} 命令
                            </span>
                          )}
                          {plugin.components.agents > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {plugin.components.agents} 代理
                            </span>
                          )}
                          {plugin.components.skills > 0 && (
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {plugin.components.skills} 技能
                            </span>
                          )}
                          {plugin.components.hooks && (
                            <span className="flex items-center gap-1">
                              <Settings className="w-3 h-3" />
                              Hooks
                            </span>
                          )}
                        </div>

                        {plugin.author && (
                          <div className="mt-2 text-xs text-gray-400">
                            作者: {plugin.author.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Installed Tab */}
          <TabsContent value="installed" className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 py-2">
              <span>项目级: {installedBreakdown.project}</span>
              <span>系统级: {installedBreakdown.system}</span>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              {installedPlugins.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Package className="w-16 h-16 mb-4 opacity-50" />
                  <p>尚未安装任何插件</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
                  {installedPlugins.map(plugin => {
                    const installing = isInstalling(plugin);

                    return (
                      <div
                        key={`${plugin.marketplace}:${plugin.name}`}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{plugin.displayName}</h3>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="secondary">{plugin.category}</Badge>
                              <Badge variant="outline">{plugin.marketplace}</Badge>
                              <Badge variant={plugin.scope === 'project' ? 'default' : 'outline'} className="text-xs">
                                {plugin.scope === 'project' ? '项目级' : '系统级'}
                              </Badge>
                            </div>
                          </div>
                          {plugin.scope === 'project' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUninstall(plugin)}
                              disabled={installing}
                              className="text-red-600 hover:text-red-700 hover:border-red-300"
                            >
                              {installing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  卸载
                                </>
                              )}
                            </Button>
                          ) : null}
                        </div>

                        <p className="text-sm text-gray-600 mb-3">{plugin.description}</p>

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {plugin.components.commands > 0 && (
                            <span className="flex items-center gap-1">
                              <Command className="w-3 h-3" />
                              {plugin.components.commands} 命令
                            </span>
                          )}
                          {plugin.components.agents > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {plugin.components.agents} 代理
                            </span>
                          )}
                          {plugin.components.skills > 0 && (
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {plugin.components.skills} 技能
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-gray-400">
                          版本: {plugin.version}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Capabilities Overview Tab */}
          <TabsContent value="capabilities" className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col space-y-4 min-h-0">
              {/* Sub-tabs for Commands, Skills, Agents */}
              <Tabs value={capabilityTab} onValueChange={(v) => setCapabilityTab(v as 'commands' | 'skills' | 'agents')} className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="commands">
                    📜 斜杠命令
                  </TabsTrigger>
                  <TabsTrigger value="skills">
                    ⚡ 技能
                  </TabsTrigger>
                  <TabsTrigger value="agents">
                    🤖 Agents
                  </TabsTrigger>
                </TabsList>

                {/* Commands Sub-tab */}
                <TabsContent value="commands" className="flex-1 flex flex-col min-h-0">
                  <ScrollArea className="flex-1 min-h-0">
                    {commandsLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin" />
                      </div>
                    ) : commands.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <Command className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="mb-2">暂无可用命令</p>
                        <p className="text-sm">安装插件后，这里将显示所有可用的斜杠命令</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 p-4">
                        {commands.map((cmd, index) => (
                          <div
                            key={`${cmd.source}-${cmd.name}-${index}`}
                            className="border rounded-lg p-4 hover:border-gray-400 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-base">/{cmd.name}</h4>
                                  <Badge variant={cmd.source === '项目级' ? 'default' : 'outline'} className="text-xs">
                                    {cmd.source}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{cmd.description}</p>
                                <div className="bg-gray-50 dark:bg-gray-900 rounded px-3 py-2 font-mono text-sm text-gray-700 dark:text-gray-300">
                                  {cmd.usageExample}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyCommand(cmd.usageExample)}
                                className="ml-3"
                                title="复制命令"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Skills Sub-tab */}
                <TabsContent value="skills" className="flex-1 flex flex-col min-h-0">
                  <ScrollArea className="flex-1 min-h-0">
                    {skillsLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin" />
                      </div>
                    ) : skills.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="mb-2">暂无可用技能</p>
                        <p className="text-sm">安装插件后，这里将显示所有可用的技能</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 p-4">
                        {skills.map((skill, index) => (
                          <div
                            key={`${skill.source}-${skill.name}-${index}`}
                            className="border rounded-lg p-4 hover:border-gray-400 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-base">{skill.displayName || skill.name}</h4>
                                  <Badge variant={skill.source === '项目级' ? 'default' : 'outline'} className="text-xs">
                                    {skill.source}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{skill.description}</p>
                                {skill.trigger && (
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="font-medium">触发条件:</span>
                                    <span className="bg-gray-50 dark:bg-gray-900 rounded px-2 py-1">
                                      {skill.trigger}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Agents Sub-tab */}
                <TabsContent value="agents" className="flex-1 flex flex-col min-h-0">
                  <ScrollArea className="flex-1 min-h-0">
                    {agentsLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin" />
                      </div>
                    ) : agents.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="mb-2">暂无可用 Agents</p>
                        <p className="text-sm">安装插件后，这里将显示所有可用的 Agents</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 p-4">
                        {agents.map((agent, index) => (
                          <div
                            key={`${agent.source}-${agent.name}-${index}`}
                            className="border rounded-lg p-4 hover:border-gray-400 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-base">{agent.displayName || agent.name}</h4>
                                  <Badge variant={agent.source === '项目级' ? 'default' : 'outline'} className="text-xs">
                                    {agent.source}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{agent.description}</p>
                                {agent.trigger && (
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="font-medium">触发场景:</span>
                                    <span className="bg-gray-50 dark:bg-gray-900 rounded px-2 py-1">
                                      {agent.trigger}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    </>
  );
};
