import React, { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Loader2, Package, Languages, Download, Trash2, Search, FolderOpen, ChevronDown, Plus, Filter } from 'lucide-react';
import { loadInstalledPlugins, type PluginCard as PluginCardType } from '../lib/pluginReader';
import { api, type PluginMetadata, type MarketplaceDetail, type Project } from '../lib/api';
import { applyPreTranslations, getTranslatedCategory } from '@/hooks/useSkillTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover } from '@/components/ui/popover';
import { open, ask } from '@tauri-apps/plugin-dialog';

interface PluginLibraryProps {
  onBack: () => void;
  onNavigateToProject?: (projectPath: string) => void;
}

/**
 * PluginLibrary组件 - 系统级插件管理中心
 * 管理全局可用的系统插件，支持安装、卸载和查看功能
 */
export const PluginLibrary: React.FC<PluginLibraryProps> = ({ onBack, onNavigateToProject }) => {
  const [plugins, setPlugins] = useState<PluginCardType[]>([]);
  const [originalPlugins, setOriginalPlugins] = useState<PluginCardType[]>([]);
  const [loading, setLoading] = useState(true);

  // Marketplace state
  const [marketplaces, setMarketplaces] = useState<MarketplaceDetail[]>([]);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [availablePlugins, setAvailablePlugins] = useState<PluginMetadata[]>([]);
  const [originalAvailablePlugins, setOriginalAvailablePlugins] = useState<PluginMetadata[]>([]);
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed'>('marketplace');

  // 项目列表状态
  const [projects, setProjects] = useState<Project[]>([]);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  // 语言切换状态
  const [language, setLanguage] = useState<'en' | 'zh'>(() => {
    const saved = localStorage.getItem('plugin-library-language');
    return (saved === 'zh' || saved === 'en') ? saved : 'zh';  // 默认中文
  });

  // Skill-Box 安装状态
  const [installingSkillBox, setInstallingSkillBox] = useState(false);

  // 加载已安装的Plugins
  useEffect(() => {
    loadPlugins();
    loadMarketplaces();
    loadProjects();
  }, []);

  // Load marketplace plugins when marketplace changes
  useEffect(() => {
    if (selectedMarketplace) {
      loadAvailablePlugins(selectedMarketplace);
    }
  }, [selectedMarketplace]);

  const loadProjects = async () => {
    try {
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadMarketplaces = async () => {
    try {
      const markets = await api.listKnownMarketplaces();
      setMarketplaces(markets);
      if (markets.length > 0 && !selectedMarketplace) {
        setSelectedMarketplace(markets[0].name);
      }
    } catch (error) {
      console.error('Failed to load marketplaces:', error);
    }
  };

  const loadAvailablePlugins = async (marketplaceName: string) => {
    try {
      setLoading(true);
      const plugins = await api.listMarketplacePlugins(marketplaceName);
      setOriginalAvailablePlugins(plugins);
      // 使用预翻译，无需调用 API
      const translatedPlugins = applyPreTranslations(plugins, language);
      setAvailablePlugins(translatedPlugins);
    } catch (error) {
      console.error('Failed to load marketplace plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const installedPlugins = await loadInstalledPlugins();
      // 保存原始数据
      setOriginalPlugins(installedPlugins);
      // 使用预翻译，无需调用 API
      const translatedPlugins = applyPreTranslations(installedPlugins, language);
      setPlugins(translatedPlugins);
    } catch (err) {
      console.error('Failed to load plugins:', err);
      // Show error via alert instead of error state
      alert('加载插件列表失败，请检查是否已安装Claude Code插件');
    } finally {
      setLoading(false);
    }
  };

  // 语言切换函数
  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'zh' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('plugin-library-language', newLanguage);

    // 使用预翻译，即时切换，无需调用 API
    const translatedAvailable = applyPreTranslations(originalAvailablePlugins, newLanguage);
    const translatedInstalled = applyPreTranslations(originalPlugins, newLanguage);
    setAvailablePlugins(translatedAvailable);
    setPlugins(translatedInstalled);
  };

  // 一键安装 Skill-Box 函数
  const handleInstallSkillBox = async () => {
    setInstallingSkillBox(true);
    try {
      const plugins = await api.forceReinstallBundledPlugins();
      await loadMarketplaces(); // 刷新 marketplace 列表
      if (plugins.length > 0) {
        alert(`Skill-Box 安装成功！\n已安装 ${plugins.length} 个插件`);
      } else {
        alert('Skill-Box 安装完成');
      }
    } catch (error) {
      console.error('Failed to install Skill-Box:', error);
      alert(`安装失败: ${error}`);
    } finally {
      setInstallingSkillBox(false);
    }
  };

  // 从可用插件中提取所有分类
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    availablePlugins.forEach(plugin => {
      if (plugin.category) {
        categories.add(plugin.category);
      }
    });
    return Array.from(categories).sort();
  }, [availablePlugins]);

  // 当 marketplace 改变时重置分类选择
  useEffect(() => {
    setSelectedCategory('all');
  }, [selectedMarketplace]);

  /**
   * 安装插件到系统级（所有项目共享）
   */
  const handleInstall = async (plugin: PluginMetadata) => {
    const pluginKey = `${plugin.marketplace}:${plugin.name}`;
    setInstalling(prev => new Set(prev).add(pluginKey));

    try {
      // 安装到系统级（projectPath 为空字符串）
      await api.installPluginToProject('', plugin.marketplace, plugin.name);
      await loadPlugins(); // 刷新已安装列表
      setActiveTab('installed');
      alert(`插件 "${plugin.displayName}" 已安装到系统\n\n现在所有项目都可以使用此插件了！`);
    } catch (error) {
      console.error('Failed to install plugin:', error);
      alert(`安装失败: ${error}`);
    } finally {
      setInstalling(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginKey);
        return newSet;
      });
    }
  };

  /**
   * 卸载系统级插件（从市场插件列表调用）
   */
  const handleUninstall = async (plugin: PluginMetadata) => {
    // 使用 Tauri 的 ask 对话框，确保是真正的异步等待
    const confirmed = await ask(
      `卸载后，所有项目都将无法使用此插件。`,
      {
        title: `确定要卸载系统插件"${plugin.displayName}"吗？`,
        kind: 'warning',
        okLabel: '确定',
        cancelLabel: '取消',
      }
    );

    if (!confirmed) {
      return;
    }

    const pluginKey = `${plugin.marketplace}:${plugin.name}`;
    setInstalling(prev => new Set(prev).add(pluginKey));

    try {
      await api.uninstallPluginFromProject('', plugin.marketplace, plugin.name);
      await loadPlugins(); // 刷新已安装列表
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      alert(`卸载失败: ${error}`);
    } finally {
      setInstalling(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginKey);
        return newSet;
      });
    }
  };

  /**
   * 卸载已安装的插件（从已安装列表调用）
   * plugin.id 格式为 "plugin-name@marketplace-name"
   */
  const handleUninstallInstalled = async (plugin: PluginCardType) => {
    // 使用 Tauri 的 ask 对话框，确保是真正的异步等待
    const confirmed = await ask(
      `卸载后，所有项目都将无法使用此插件。`,
      {
        title: `确定要卸载系统插件"${plugin.name}"吗？`,
        kind: 'warning',
        okLabel: '确定',
        cancelLabel: '取消',
      }
    );

    if (!confirmed) {
      return;
    }

    // 从 id 解析 pluginName 和 marketplaceName
    // id 格式: "plugin-name@marketplace-name"
    const parts = plugin.id.split('@');
    const pluginName = parts[0];
    const marketplaceName = parts[1] || '';

    const pluginKey = plugin.id;
    setInstalling(prev => new Set(prev).add(pluginKey));

    try {
      await api.uninstallPluginFromProject('', marketplaceName, pluginName);
      await loadPlugins(); // 刷新已安装列表
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      alert(`卸载失败: ${error}`);
    } finally {
      setInstalling(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginKey);
        return newSet;
      });
    }
  };

  /**
   * 检查插件是否已安装
   */
  const isInstalled = (plugin: PluginMetadata): boolean => {
    return plugins.some(
      p => p.name === plugin.name ||
           (plugin.marketplace && p.id.includes(`${plugin.marketplace}:${plugin.name}`))
    );
  };

  const isInstalling = (plugin: PluginMetadata): boolean => {
    const pluginKey = `${plugin.marketplace}:${plugin.name}`;
    return installing.has(pluginKey);
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto">
      <div className="container mx-auto p-6">
        {/* 返回按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回欢迎页
        </Button>

        {/* 标题区域 */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">系统插件库</h1>
            <p className="text-sm text-muted-foreground mt-1">管理全局可用的系统级插件，适用于所有项目</p>
          </div>
          {/* Skill-Box 一键安装按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstallSkillBox}
            disabled={installingSkillBox}
            className="gap-2 font-medium shadow-lg shadow-primary/20 px-4 flex-shrink-0 bg-[#d97757] hover:bg-[#FE6F00]/90 text-white"
            title="一键安装内置 Skill-Box 插件市场"
          >
            {installingSkillBox ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            安装 Skill-Box
          </Button>
          {/* 语言切换按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="gap-2 flex-shrink-0"
            title={language === 'zh' ? '切换到英文' : '切换到中文'}
          >
            <Languages className="w-4 h-4" />
            <span className="text-xs">{language === 'zh' ? '中' : 'EN'}</span>
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'marketplace' | 'installed')} className="h-full flex flex-col">
          <TabsList className="mx-6 mt-4 grid w-auto grid-cols-2">
            <TabsTrigger value="marketplace">插件市场</TabsTrigger>
            <TabsTrigger value="installed">已安装</TabsTrigger>
          </TabsList>

          {/* 插件市场 Tab */}
          <TabsContent value="marketplace" className="flex-1 flex flex-col px-6 min-h-0">
            {/* Marketplace Selector, Search and Category Filter */}
            <div className="flex gap-4 py-4">
              <Select
                value={marketplaces.length > 0 ? selectedMarketplace : undefined}
                onValueChange={setSelectedMarketplace}
                disabled={marketplaces.length === 0}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={marketplaces.length > 0 ? '选择插件市场' : '未检测到插件市场'} />
                </SelectTrigger>
                <SelectContent>
                  {marketplaces.length > 0 ? (
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

              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索插件..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Category Filter */}
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                disabled={availableCategories.length === 0}
              >
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="选择分类" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {availableCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {language === 'zh' ? getTranslatedCategory(category) : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plugin Grid */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : availablePlugins.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Package className="w-16 h-16 mb-4 opacity-50" />
                  <p className="mb-2">该市场暂无可用插件</p>
                  <p className="text-sm text-center max-w-md">
                    {marketplaces.length === 0
                      ? '请先运行 claude plugins install 安装官方插件市场'
                      : '请尝试选择其他插件市场或检查网络连接'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                  {availablePlugins
                    .filter(plugin => {
                      // 分类过滤
                      if (selectedCategory !== 'all' && plugin.category !== selectedCategory) {
                        return false;
                      }
                      // 搜索过滤
                      if (searchQuery !== '' &&
                          !plugin.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
                          !plugin.description.toLowerCase().includes(searchQuery.toLowerCase())) {
                        return false;
                      }
                      return true;
                    })
                    .map((plugin) => {
                      const installed = isInstalled(plugin);
                      const installing = isInstalling(plugin);

                      return (
                        <div
                          key={`${plugin.marketplace}:${plugin.name}`}
                          className="border rounded-lg p-4 hover:border-gray-400 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-base mb-1">{plugin.displayName}</h3>
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {language === 'zh' ? getTranslatedCategory(plugin.category || '') : plugin.category}
                                </Badge>
                                {installed && <Badge variant="default" className="text-xs">已安装</Badge>}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={installed ? 'destructive' : 'default'}
                              onClick={() => installed ? handleUninstall(plugin) : handleInstall(plugin)}
                              disabled={installing}
                            >
                              {installing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : installed ? (
                                <>
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  卸载
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-1" />
                                  安装
                                </>
                              )}
                            </Button>
                          </div>

                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{plugin.description}</p>

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {plugin.components?.commands > 0 && (
                              <span>📜 {plugin.components.commands} 命令</span>
                            )}
                            {plugin.components?.agents > 0 && (
                              <span>🤖 {plugin.components.agents} 代理</span>
                            )}
                            {plugin.components?.skills > 0 && (
                              <span>⚡ {plugin.components.skills} 技能</span>
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

          {/* 已安装 Tab */}
          <TabsContent value="installed" className="flex-1 flex flex-col px-6 py-4 min-h-0">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                系统级插件在所有项目中全局可用，无需单独配置
              </p>
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : plugins.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Package className="w-16 h-16 mb-4 opacity-50" />
                  <p className="mb-2">暂无已安装插件</p>
                  <p className="text-sm text-center max-w-md">
                    前往"插件市场"选择并安装所需插件
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                  {plugins.map((plugin) => {
                    const isUninstalling = installing.has(plugin.id);
                    return (
                    <div
                      key={plugin.id}
                      className="border rounded-lg p-4 flex flex-col"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">
                            {plugin.name || '未知插件'}
                          </h3>
                        </div>
                        {/* 卸载按钮 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 -mr-2 -mt-1"
                          onClick={() => handleUninstallInstalled(plugin)}
                          disabled={isUninstalling}
                          title="卸载插件"
                        >
                          {isUninstalling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      <p className="text-sm text-gray-600 mb-3 line-clamp-2 flex-1">
                        {plugin.description || '暂无描述'}
                      </p>

                      <div className="mt-2 text-xs text-gray-400 truncate mb-3" title={plugin.installPath}>
                        路径: {plugin.installPath}
                      </div>

                      {/* 在项目中使用 按钮 */}
                      {onNavigateToProject && (
                        <Popover
                          open={openPopoverId === plugin.id}
                          onOpenChange={(open) => setOpenPopoverId(open ? plugin.id : null)}
                          align="start"
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2 justify-between"
                            >
                              <span className="flex items-center gap-2">
                                <FolderOpen className="w-4 h-4" />
                                在项目中使用
                              </span>
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          }
                          content={
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground px-2 py-1">选择项目</p>
                              {projects.length > 0 ? (
                                <div className="max-h-48 overflow-y-auto">
                                  {projects.slice(0, 10).map((project) => {
                                    const projectName = project.path.split(/[\\/]/).pop() || project.path;
                                    return (
                                      <button
                                        key={project.id}
                                        className="w-full text-left px-2 py-2 text-sm rounded hover:bg-accent flex items-center gap-2 truncate"
                                        onClick={() => {
                                          setOpenPopoverId(null);
                                          onNavigateToProject(project.path);
                                        }}
                                      >
                                        <FolderOpen className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                        <span className="truncate" title={project.path}>{projectName}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground px-2 py-2">暂无项目</p>
                              )}
                              <div className="border-t border-border mt-1 pt-1">
                                <button
                                  className="w-full text-left px-2 py-2 text-sm rounded hover:bg-accent flex items-center gap-2 text-primary"
                                  onClick={async () => {
                                    setOpenPopoverId(null);
                                    try {
                                      const selected = await open({
                                        directory: true,
                                        multiple: false,
                                        title: '选择项目目录'
                                      });
                                      if (selected && typeof selected === 'string') {
                                        onNavigateToProject(selected);
                                      }
                                    } catch (error) {
                                      console.error('Failed to select directory:', error);
                                    }
                                  }}
                                >
                                  <Plus className="w-4 h-4 flex-shrink-0" />
                                  选择其他目录...
                                </button>
                              </div>
                            </div>
                          }
                          className="w-64 p-2"
                        />
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* 底部统计信息 */}
      {!loading && (activeTab === 'installed' ? plugins.length > 0 : availablePlugins.length > 0) && (
        <div className="border-t border-border px-6 py-3">
          <p className="text-xs text-muted-foreground text-center">
            {activeTab === 'installed'
              ? `共 ${plugins.length} 个已安装插件`
              : (() => {
                  const filteredCount = availablePlugins.filter(plugin => {
                    if (selectedCategory !== 'all' && plugin.category !== selectedCategory) return false;
                    if (searchQuery !== '' &&
                        !plugin.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
                        !plugin.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                    return true;
                  }).length;
                  return selectedCategory === 'all' && searchQuery === ''
                    ? `共 ${availablePlugins.length} 个可用插件`
                    : `显示 ${filteredCount} / ${availablePlugins.length} 个插件`;
                })()}
          </p>
        </div>
      )}
    </div>
  );
};
