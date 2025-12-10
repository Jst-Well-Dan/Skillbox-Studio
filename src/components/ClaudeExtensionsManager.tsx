import React, { useState, useEffect, useMemo } from "react";
import {
  Bot,
  FolderOpen,
  Plus,
  Package,
  Sparkles,
  Loader2,
  ArrowLeft,
  Store,
  Trash2,
  RefreshCw,
  Network,
  Languages,
  Search,
  Command,
  Users,
  Zap,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { MarketplaceDetail, SkillInfo, AgentInfo, PluginMetadata } from "@/lib/api";
import { MCPManager } from "@/components/MCPManager";
import { translatePlugins } from '@/hooks/usePluginTranslation';

interface ClaudeExtensionsManagerProps {
  projectPath?: string;
  className?: string;
  onBack?: () => void;
}

interface PluginInfo {
  name: string;
  description?: string;
  version: string;
  author?: string;
  marketplace?: string;
  path: string;
  enabled: boolean;
  components: {
    commands: number;
    agents: number;
    skills: number;
    hooks: number;
    mcpServers: number;
  };
}

interface AgentFile {
  name: string;
  path: string;
  scope: 'project' | 'user';
  description?: string;
}

interface SkillFile {
  name: string;
  path: string;
  scope: 'project' | 'user';
  description?: string;
}

type AvailablePlugin = PluginMetadata & { marketplaceName?: string };

/**
 * Claude 扩展管理器
 * 
 * 根据官方文档管理：
 * - Subagents: .claude/agents/ 下的 Markdown 文件
 * - Agent Skills: .claude/skills/ 下的 SKILL.md 文件
 * - Slash Commands: 已有独立管理器
 */
export const ClaudeExtensionsManager: React.FC<ClaudeExtensionsManagerProps> = ({
  projectPath,
  className,
  onBack
}) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [originalPlugins, setOriginalPlugins] = useState<PluginInfo[]>([]);
  const [agents, setAgents] = useState<AgentFile[]>([]);
  const [originalAgents, setOriginalAgents] = useState<AgentFile[]>([]);
  const [projectAgents, setProjectAgents] = useState<AgentInfo[]>([]); // 从插件获取的代理
  const [originalProjectAgents, setOriginalProjectAgents] = useState<AgentInfo[]>([]);
  const [skills, setSkills] = useState<SkillFile[]>([]);
  const [originalSkills, setOriginalSkills] = useState<SkillFile[]>([]);
  const [projectSkills, setProjectSkills] = useState<SkillInfo[]>([]); // 从插件获取的技能
  const [originalProjectSkills, setOriginalProjectSkills] = useState<SkillInfo[]>([]);
  const [marketplaces, setMarketplaces] = useState<MarketplaceDetail[]>([]);
  const [originalMarketplaces, setOriginalMarketplaces] = useState<MarketplaceDetail[]>([]);
  const [activeTab, setActiveTab] = useState("marketplaces");
  const [loading, setLoading] = useState(false);
  const [addMarketplaceOpen, setAddMarketplaceOpen] = useState(false);
  const [newMarketplaceSource, setNewMarketplaceSource] = useState("");
  const [installPluginDialogOpen, setInstallPluginDialogOpen] = useState(false);
  const [availablePlugins, setAvailablePlugins] = useState<AvailablePlugin[]>([]);
  const [installSearchQuery, setInstallSearchQuery] = useState("");
  const [installCategory, setInstallCategory] = useState<string>("all");
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);

  // 语言切换状态
  const [language, setLanguage] = useState<'en' | 'zh'>(() => {
    const saved = localStorage.getItem('extensions-manager-language');
    return (saved === 'zh' || saved === 'en') ? saved : 'en';
  });
  const [translating, setTranslating] = useState(false);
  const installedPluginKeys = useMemo(() => {
    const keys = new Set<string>();
    plugins.forEach((plugin) => {
      const key = plugin.marketplace ? `${plugin.name}@${plugin.marketplace}` : plugin.name;
      keys.add(key);
    });
    return keys;
  }, [plugins]);

  const installCategories = useMemo(() => {
    const cats = new Set<string>();
    availablePlugins.forEach((plugin) => {
      if (plugin.category) {
        cats.add(plugin.category);
      }
    });
    return ['all', ...Array.from(cats).sort()];
  }, [availablePlugins]);

  const filteredAvailablePlugins = useMemo(() => {
    const query = installSearchQuery.toLowerCase().trim();
    return availablePlugins.filter((plugin) => {
      const displayName = plugin.displayName.toLowerCase();
      const description = (plugin.description || '').toLowerCase();
      const matchesSearch =
        !query ||
        displayName.includes(query) ||
        description.includes(query);
      const matchesCategory =
        installCategory === 'all' ||
        (plugin.category || 'other') === installCategory;
      return matchesSearch && matchesCategory;
    });
  }, [availablePlugins, installCategory, installSearchQuery]);

  // 加载插件
  const loadPlugins = async () => {
    try {
      setLoading(true);
      const result = await api.listPlugins(projectPath);
      // 保存原始数据
      setOriginalPlugins(result);
      // 如果当前是中文模式，立即翻译
      if (language === 'zh') {
        const translatedPlugins = await translatePlugins(result);
        setPlugins(translatedPlugins);
      } else {
        setPlugins(result);
      }
      console.log('[ClaudeExtensions] Loaded', result.length, 'plugins');
    } catch (error) {
      console.error('[ClaudeExtensions] Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载子代理
  const loadAgents = async () => {
    try {
      setLoading(true);
      // 加载全局/用户代理
      const globalAgents = await api.listSubagents(projectPath);
      setOriginalAgents(globalAgents);
      if (language === 'zh') {
        const translatedAgents = await translatePlugins(globalAgents);
        setAgents(translatedAgents);
      } else {
        setAgents(globalAgents);
      }
      console.log('[ClaudeExtensions] Loaded', globalAgents.length, 'global agents');

      // 加载项目级代理（来自插件）
      if (projectPath) {
        const projAgents = await api.getProjectAgents(projectPath);
        setOriginalProjectAgents(projAgents);
        if (language === 'zh') {
          const translatedProjectAgents = await translatePlugins(projAgents);
          setProjectAgents(translatedProjectAgents);
        } else {
          setProjectAgents(projAgents);
        }
        console.log('[ClaudeExtensions] Loaded', projAgents.length, 'project agents from plugins');
      }
    } catch (error) {
      console.error('[ClaudeExtensions] Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载 Agent Skills
  const loadSkills = async () => {
    try {
      setLoading(true);
      // 加载全局/用户技能
      const globalSkills = await api.listAgentSkills(projectPath);
      setOriginalSkills(globalSkills);
      if (language === 'zh') {
        const translatedSkills = await translatePlugins(globalSkills);
        setSkills(translatedSkills);
      } else {
        setSkills(globalSkills);
      }
      console.log('[ClaudeExtensions] Loaded', globalSkills.length, 'global skills');

      // 加载项目级技能（来自插件）
      if (projectPath) {
        const projSkills = await api.getProjectSkills(projectPath);
        setOriginalProjectSkills(projSkills);
        if (language === 'zh') {
          const translatedProjectSkills = await translatePlugins(projSkills);
          setProjectSkills(translatedProjectSkills);
        } else {
          setProjectSkills(projSkills);
        }
        console.log('[ClaudeExtensions] Loaded', projSkills.length, 'project skills from plugins');
      }
    } catch (error) {
      console.error('[ClaudeExtensions] Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载 Marketplaces
  const loadMarketplaces = async () => {
    try {
      setLoading(true);
      const result = await api.listKnownMarketplaces();
      setOriginalMarketplaces(result);
      if (language === 'zh') {
        const translatedMarketplaces = await translatePlugins(result);
        setMarketplaces(translatedMarketplaces);
      } else {
        setMarketplaces(result);
      }
      console.log('[ClaudeExtensions] Loaded', result.length, 'marketplaces');
    } catch (error) {
      console.error('[ClaudeExtensions] Failed to load marketplaces:', error);
    } finally {
      setLoading(false);
    }
  };

  // 添加 Marketplace
  const handleAddMarketplace = async () => {
    if (!newMarketplaceSource.trim()) return;

    try {
      setLoading(true);
      await api.addMarketplace(newMarketplaceSource.trim());
      setAddMarketplaceOpen(false);
      setNewMarketplaceSource("");
      // 重新加载列表
      await loadMarketplaces();
    } catch (error) {
      console.error('Failed to add marketplace:', error);
      alert('添加失败：' + error);
    } finally {
      setLoading(false);
    }
  };

  // 删除 Marketplace
  const handleRemoveMarketplace = async (name: string) => {
    if (!confirm(`确定要删除 marketplace "${name}" 吗？`)) return;

    try {
      setLoading(true);
      await api.removeMarketplace(name);
      // 重新加载列表
      await loadMarketplaces();
    } catch (error) {
      console.error('Failed to remove marketplace:', error);
      alert('删除失败：' + error);
    } finally {
      setLoading(false);
    }
  };

  // 刷新 Marketplace
  const handleRefreshMarketplace = async (name: string) => {
    try {
      setLoading(true);
      await api.refreshMarketplace(name);
      // 重新加载列表
      await loadMarketplaces();
    } catch (error) {
      console.error('Failed to refresh marketplace:', error);
      alert('刷新失败：' + error);
    } finally {
      setLoading(false);
    }
  };

  // 语言切换函数
  const toggleLanguage = async () => {
    const newLanguage = language === 'en' ? 'zh' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('extensions-manager-language', newLanguage);

    if (newLanguage === 'zh') {
      // 切换到中文：翻译所有数据
      setTranslating(true);
      try {
        const [
          translatedPlugins,
          translatedAgents,
          translatedProjectAgents,
          translatedSkills,
          translatedProjectSkills,
          translatedMarketplaces
        ] = await Promise.all([
          translatePlugins(originalPlugins),
          translatePlugins(originalAgents),
          translatePlugins(originalProjectAgents),
          translatePlugins(originalSkills),
          translatePlugins(originalProjectSkills),
          translatePlugins(originalMarketplaces)
        ]);

        setPlugins(translatedPlugins);
        setAgents(translatedAgents);
        setProjectAgents(translatedProjectAgents);
        setSkills(translatedSkills);
        setProjectSkills(translatedProjectSkills);
        setMarketplaces(translatedMarketplaces);
      } catch (error) {
        console.error('[Translation] Translation failed:', error);
      } finally {
        setTranslating(false);
      }
    } else {
      // 切换到英文：显示原始数据
      setPlugins(originalPlugins);
      setAgents(originalAgents);
      setProjectAgents(originalProjectAgents);
      setSkills(originalSkills);
      setProjectSkills(originalProjectSkills);
      setMarketplaces(originalMarketplaces);
    }
  };

  // 打开目录
  const handleOpenPluginsDir = async () => {
    try {
      const dirPath = await api.openPluginsDirectory(projectPath);
      await api.openDirectoryInExplorer(dirPath);
    } catch (error) {
      console.error('Failed to open plugins directory:', error);
    }
  };

  const handleOpenAgentsDir = async () => {
    try {
      const dirPath = await api.openAgentsDirectory(projectPath);
      await api.openDirectoryInExplorer(dirPath);
    } catch (error) {
      console.error('Failed to open agents directory:', error);
    }
  };

  const handleOpenSkillsDir = async () => {
    try {
      const dirPath = await api.openSkillsDirectory(projectPath);
      await api.openDirectoryInExplorer(dirPath);
    } catch (error) {
      console.error('Failed to open skills directory:', error);
    }
  };

  const getPluginIdentifier = (plugin: AvailablePlugin) => {
    const marketplace = plugin.marketplace || plugin.marketplaceName;
    return marketplace ? `${plugin.name}@${marketplace}` : plugin.name;
  };

  // 打开安装插件对话框
  const handleOpenInstallDialog = async () => {
    try {
      setLoading(true);
      // 获取所有marketplace中的可用插件
      const allPlugins: AvailablePlugin[] = [];
      for (const marketplace of marketplaces) {
        try {
          const plugins = await api.listMarketplacePlugins(marketplace.name);
          allPlugins.push(...plugins.map((p) => ({
            ...p,
            marketplaceName: marketplace.name
          })));
        } catch (error) {
          console.error(`Failed to load plugins from ${marketplace.name}:`, error);
        }
      }
      setAvailablePlugins(allPlugins);
      setInstallSearchQuery("");
      setInstallCategory("all");
      setInstallPluginDialogOpen(true);
    } catch (error) {
      console.error('Failed to load available plugins:', error);
      alert('加载可用插件失败：' + error);
    } finally {
      setLoading(false);
    }
  };

  // 安装插件
  const handleInstallPlugin = async (plugin: AvailablePlugin) => {
    const pluginIdentifier = getPluginIdentifier(plugin);
    const pluginLabel = plugin.displayName || pluginIdentifier;
    try {
      setInstallingPlugin(pluginIdentifier);
      await api.installPluginGlobally(pluginIdentifier);
      alert(`插件 "${pluginLabel}" 安装成功！`);
      setInstallPluginDialogOpen(false);
      // 重新加载插件列表
      await loadPlugins();
    } catch (error) {
      console.error('Failed to install plugin:', error);
      alert(`安装失败（命令: /plugin install ${pluginIdentifier}）：` + error);
    } finally {
      setInstallingPlugin(null);
    }
  };

  useEffect(() => {
    loadPlugins();
    loadAgents();
    loadSkills();
    loadMarketplaces();
  }, [projectPath]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* 返回按钮和语言切换 */}
      {onBack && (
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回主页
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">系统扩展管理器（全局）</h2>
            <p className="text-sm text-muted-foreground">管理所有项目共用的扩展能力</p>
          </div>
          {/* 语言切换按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            disabled={translating}
            className="gap-2"
            title={language === 'zh' ? '切换到英文' : '切换到中文'}
          >
            {translating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Languages className="w-4 h-4" />
            )}
            <span className="text-xs">{language === 'zh' ? '中' : 'EN'}</span>
          </Button>
        </div>
      )}

      {/* 系统级说明提示 */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <div className="p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5">
              💡
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                关于系统级扩展
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                这里的配置会<strong>影响所有项目</strong>。若需为单个项目定制能力，请在项目页面使用"项目能力管理"。
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="marketplaces">
            <Store className="h-4 w-4 mr-2" />
            Marketplaces
          </TabsTrigger>
          <TabsTrigger value="plugins">
            <Package className="h-4 w-4 mr-2" />
            Plugins
          </TabsTrigger>
          <TabsTrigger value="agents">
            <Bot className="h-4 w-4 mr-2" />
            Subagents
          </TabsTrigger>
          <TabsTrigger value="skills">
            <Sparkles className="h-4 w-4 mr-2" />
            Skills
          </TabsTrigger>
          <TabsTrigger value="mcp">
            <Network className="h-4 w-4 mr-2" />
            MCP
          </TabsTrigger>
        </TabsList>

        {/* Marketplaces Tab */}
        <TabsContent value="marketplaces" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Marketplace 源管理</h3>
              <p className="text-sm text-muted-foreground">
                从不同的来源发现和安装插件
              </p>
            </div>
            <Button onClick={() => setAddMarketplaceOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              添加源
            </Button>
          </div>

          {/* Marketplace 列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : marketplaces.length > 0 ? (
            <div className="space-y-3">
              {marketplaces.map((marketplace) => (
                <Card key={marketplace.name} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Store className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{marketplace.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {marketplace.source.includes('/') && !marketplace.source.startsWith('/') ? 'GitHub' : 'Local'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {marketplace.source}
                        </p>
                        {marketplace.lastUpdated && (
                          <p className="text-xs text-muted-foreground mt-1">
                            最后更新: {new Date(marketplace.lastUpdated).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshMarketplace(marketplace.name)}
                        disabled={loading}
                        title="更新"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMarketplace(marketplace.name)}
                        disabled={loading}
                        title="移除"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="font-medium mb-2">暂无配置的 Marketplace 源</h4>
              <p className="text-sm text-muted-foreground mb-4">
                添加 Marketplace 源可以访问更多插件和 Skills
              </p>
              <Button onClick={() => setAddMarketplaceOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                添加第一个源
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* Plugins Tab */}
        <TabsContent value="plugins" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Plugins</h3>
              <p className="text-sm text-muted-foreground">
                已安装的插件（可包含 commands、agents、skills、hooks、MCP servers）
              </p>
            </div>
            <Button onClick={handleOpenInstallDialog} size="sm" disabled={marketplaces.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              安装插件
            </Button>
          </div>

          {/* 插件列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : plugins.length > 0 ? (
            <div className="space-y-2">
              {plugins.map((plugin) => (
                <Card key={plugin.path} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{plugin.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            v{plugin.version}
                          </Badge>
                          {plugin.enabled && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              已启用
                            </Badge>
                          )}
                        </div>
                        {plugin.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {plugin.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {plugin.components.commands > 0 && <span>📝 {plugin.components.commands} 命令</span>}
                          {plugin.components.agents > 0 && <span>🤖 {plugin.components.agents} 代理</span>}
                          {plugin.components.skills > 0 && <span>✨ {plugin.components.skills} 技能</span>}
                          {plugin.components.hooks > 0 && <span>🪝 钩子</span>}
                          {plugin.components.mcpServers > 0 && <span>🔌 MCP</span>}
                        </div>
                        {plugin.author && (
                          <p className="text-xs text-muted-foreground mt-1">作者: {plugin.author}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenPluginsDir}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="font-medium mb-2">暂无已安装的 Plugins</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Plugins 存储在 .claude/plugins/ 目录下
              </p>
              <div className="text-xs text-muted-foreground mb-4">
                使用 <code className="bg-muted px-1 py-0.5 rounded">/plugin</code> 命令管理插件
              </div>
              <Button variant="outline" size="sm" onClick={handleOpenPluginsDir}>
                <FolderOpen className="h-4 w-4 mr-2" />
                打开目录
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* Subagents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">子代理</h3>
              <p className="text-sm text-muted-foreground">
                存储在 <code className="text-xs bg-muted px-1 py-0.5 rounded">.claude/agents/</code> 的专用代理
              </p>
            </div>
            <Button size="sm" onClick={handleOpenAgentsDir}>
              <Plus className="h-4 w-4 mr-2" />
              新建子代理
            </Button>
          </div>

          {/* 子代理列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length > 0 || projectAgents.length > 0 ? (
            <div className="space-y-4">
              {/* 全局/用户代理 */}
              {agents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">全局代理</h4>
                  {agents.map((agent) => (
                    <Card
                      key={agent.path}
                      className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => api.openFileWithDefaultApp(agent.path)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <Bot className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{agent.name}</h4>
                              <Badge variant={agent.scope === 'project' ? 'default' : 'outline'} className="text-xs">
                                {agent.scope}
                              </Badge>
                            </div>
                            {agent.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {agent.description}
                              </p>
                            )}
                            <code className="text-xs text-muted-foreground mt-2 block truncate">
                              {agent.path}
                            </code>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* 项目代理（来自插件）*/}
              {projectAgents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">项目代理（来自插件）</h4>
                  {projectAgents.map((agent) => (
                    <Card
                      key={agent.filePath}
                      className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => api.openFileWithDefaultApp(agent.filePath)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <Bot className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{agent.displayName || agent.name}</h4>
                              <Badge variant="default" className="text-xs">
                                {agent.source}
                              </Badge>
                            </div>
                            {agent.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {agent.description}
                              </p>
                            )}
                            {agent.trigger && (
                              <p className="text-xs text-muted-foreground mt-1">
                                触发场景: {agent.trigger}
                              </p>
                            )}
                            <code className="text-xs text-muted-foreground mt-2 block truncate">
                              {agent.filePath}
                            </code>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* 打开目录按钮 */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleOpenAgentsDir}
              >
                <FolderOpen className="h-3.5 w-3.5 mr-2" />
                打开子代理目录
              </Button>
            </div>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="font-medium mb-2">暂无子代理</h4>
              <p className="text-sm text-muted-foreground mb-4">
                子代理存储在 .claude/agents/ 目录下<br />
                或通过插件安装项目级代理
              </p>
              <Button variant="outline" size="sm" onClick={handleOpenAgentsDir}>
                <FolderOpen className="h-4 w-4 mr-2" />
                打开目录
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* Agent Skills Tab */}
        <TabsContent value="skills" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Agent Skills</h3>
              <p className="text-sm text-muted-foreground">
                存储在 <code className="text-xs bg-muted px-1 py-0.5 rounded">.claude/skills/</code> 的专用技能
              </p>
            </div>
            <Button size="sm" onClick={handleOpenSkillsDir}>
              <Plus className="h-4 w-4 mr-2" />
              新建 Skill
            </Button>
          </div>

          {/* Agent Skills 列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : skills.length > 0 || projectSkills.length > 0 ? (
            <div className="space-y-4">
              {/* 全局/用户技能 */}
              {skills.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">全局技能</h4>
                  {skills.map((skill) => (
                    <Card
                      key={skill.path}
                      className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => api.openFileWithDefaultApp(skill.path)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{skill.name}</h4>
                              <Badge variant={skill.scope === 'project' ? 'default' : 'outline'} className="text-xs">
                                {skill.scope}
                              </Badge>
                            </div>
                            {skill.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {skill.description}
                              </p>
                            )}
                            <code className="text-xs text-muted-foreground mt-2 block truncate">
                              {skill.path}
                            </code>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* 项目技能（来自插件）*/}
              {projectSkills.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">项目技能（来自插件）</h4>
                  {projectSkills.map((skill) => (
                    <Card
                      key={skill.filePath}
                      className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => api.openFileWithDefaultApp(skill.filePath)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <Sparkles className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{skill.displayName || skill.name}</h4>
                              <Badge variant="default" className="text-xs">
                                {skill.source}
                              </Badge>
                            </div>
                            {skill.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {skill.description}
                              </p>
                            )}
                            <code className="text-xs text-muted-foreground mt-2 block truncate">
                              {skill.filePath}
                            </code>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* 打开目录按钮 */}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleOpenSkillsDir}
              >
                <FolderOpen className="h-3.5 w-3.5 mr-2" />
                打开 Skills 目录
              </Button>
            </div>
          ) : (
            <Card className="p-6 text-center border-dashed">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h4 className="font-medium mb-2">暂无 Agent Skills</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Agent Skills 存储在 .claude/skills/ 目录下（文件名格式：NAME.SKILL.md）<br />
                或通过插件安装项目级技能
              </p>
              <Button variant="outline" size="sm" onClick={handleOpenSkillsDir}>
                <FolderOpen className="h-4 w-4 mr-2" />
                打开目录
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* MCP Management */}
        <TabsContent value="mcp" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">MCP 管理</h3>
            <p className="text-sm text-muted-foreground">
              配置和复用系统级 Model Context Protocol 服务器
            </p>
          </div>
          <Card className="overflow-hidden">
            <div className="h-[560px]">
              <MCPManager language={language} />
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 添加 Marketplace 对话框 */}
      <Dialog open={addMarketplaceOpen} onOpenChange={setAddMarketplaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加 Plugin Marketplace</DialogTitle>
            <DialogDescription>
              输入 GitHub 仓库地址或本地路径
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Input
                placeholder="例如: anthropics/anthropic-agent-skills"
                value={newMarketplaceSource}
                onChange={(e) => setNewMarketplaceSource(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMarketplace();
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                支持格式：
                <br />• GitHub 仓库: <code>owner/repo</code>
                <br />• 本地路径: <code>/path/to/marketplace</code>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMarketplaceOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddMarketplace} disabled={!newMarketplaceSource.trim() || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 安装插件对话框 */}
      <Dialog open={installPluginDialogOpen} onOpenChange={setInstallPluginDialogOpen}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>安装插件</DialogTitle>
            <DialogDescription>
              从已配置的 Marketplace 中选择插件进行安装
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 flex-1 min-h-0">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索插件..."
                  value={installSearchQuery}
                  onChange={(e) => setInstallSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={installCategory} onValueChange={setInstallCategory}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {installCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? '所有分类' : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAvailablePlugins.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAvailablePlugins.map((plugin) => {
                    const pluginKey = getPluginIdentifier(plugin);
                    const isInstalled =
                      installedPluginKeys.has(pluginKey) ||
                      installedPluginKeys.has(plugin.name);
                    const isInstalling = installingPlugin === pluginKey;

                    return (
                      <Card key={pluginKey} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <Package className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{plugin.displayName || plugin.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  v{plugin.version}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {plugin.marketplaceName || plugin.marketplace}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {plugin.category || 'general'}
                                </Badge>
                              </div>
                              {plugin.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {plugin.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {plugin.components.commands > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Command className="h-3 w-3" />
                                    {plugin.components.commands} 命令
                                  </span>
                                )}
                                {plugin.components.agents > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {plugin.components.agents} 代理
                                  </span>
                                )}
                                {plugin.components.skills > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Zap className="h-3 w-3" />
                                    {plugin.components.skills} 技能
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isInstalled ? "outline" : "default"}
                            onClick={() => {
                              if (!isInstalled && !isInstalling) {
                                handleInstallPlugin(plugin);
                              }
                            }}
                            disabled={isInstalled || isInstalling}
                          >
                            {isInstalling ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isInstalled ? (
                              "已安装"
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-1" />
                                安装
                              </>
                            )}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    暂无可用插件
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    请先在 Marketplaces 标签页中添加 Marketplace 源
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallPluginDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 文档引导 */}
      <div className="text-xs text-muted-foreground border-t pt-4 text-center">
        <p>
          需要帮助？查看{' '}
          <a
            href="https://docs.claude.com/en/docs/claude-code/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            Claude Code 官方文档
          </a>
          {' '}了解更多扩展使用方法
        </p>
      </div>
    </div>
  );
};
