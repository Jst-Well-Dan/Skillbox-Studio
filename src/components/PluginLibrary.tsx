import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Package, Languages, Download, Trash2, Search } from 'lucide-react';
import { loadInstalledPlugins, type PluginCard as PluginCardType } from '../lib/pluginReader';
import { api, type PluginMetadata, type MarketplaceDetail } from '../lib/api';
import { translatePlugins } from '@/hooks/usePluginTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PluginLibraryProps {
  onBack: () => void;
}

/**
 * PluginLibrary组件 - 系统级插件管理中心
 * 管理全局可用的系统插件，支持安装、卸载和查看功能
 */
export const PluginLibrary: React.FC<PluginLibraryProps> = ({ onBack }) => {
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
  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed'>('marketplace');

  // 语言切换状态
  const [language, setLanguage] = useState<'en' | 'zh'>(() => {
    const saved = localStorage.getItem('plugin-library-language');
    return (saved === 'zh' || saved === 'en') ? saved : 'en';
  });
  const [translating, setTranslating] = useState(false);

  // 加载已安装的Plugins
  useEffect(() => {
    loadPlugins();
    loadMarketplaces();
  }, []);

  // Load marketplace plugins when marketplace changes
  useEffect(() => {
    if (selectedMarketplace) {
      loadAvailablePlugins(selectedMarketplace);
    }
  }, [selectedMarketplace]);

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
      if (language === 'zh') {
        const translatedPlugins = await translatePlugins(plugins);
        setAvailablePlugins(translatedPlugins);
      } else {
        setAvailablePlugins(plugins);
      }
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
      // 如果当前是中文模式，立即翻译
      if (language === 'zh') {
        const translatedPlugins = await translatePlugins(installedPlugins);
        setPlugins(translatedPlugins);
      } else {
        setPlugins(installedPlugins);
      }
    } catch (err) {
      console.error('Failed to load plugins:', err);
      // Show error via alert instead of error state
      alert('加载插件列表失败，请检查是否已安装Claude Code插件');
    } finally {
      setLoading(false);
    }
  };

  // 语言切换函数
  const toggleLanguage = async () => {
    const newLanguage = language === 'en' ? 'zh' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('plugin-library-language', newLanguage);

    if (newLanguage === 'zh') {
      // 切换到中文：翻译所有插件
      setTranslating(true);
      try {
        const [translatedAvailable, translatedInstalled] = await Promise.all([
          translatePlugins(originalAvailablePlugins),
          translatePlugins(originalPlugins)
        ]);
        setAvailablePlugins(translatedAvailable);
        setPlugins(translatedInstalled);
      } catch (error) {
        console.error('Translation failed:', error);
      } finally {
        setTranslating(false);
      }
    } else {
      // 切换到英文：显示原始数据
      setAvailablePlugins(originalAvailablePlugins);
      setPlugins(originalPlugins);
    }
  };

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
   * 卸载系统级插件
   */
  const handleUninstall = async (plugin: PluginMetadata) => {
    if (!confirm(`确定要卸载系统插件"${plugin.displayName}"吗？\n\n卸载后，所有项目都将无法使用此插件。`)) {
      return;
    }

    const pluginKey = `${plugin.marketplace}:${plugin.name}`;
    setInstalling(prev => new Set(prev).add(pluginKey));

    try {
      await api.uninstallPluginFromProject('', plugin.marketplace, plugin.name);
      await loadPlugins(); // 刷新已安装列表
      alert(`插件 "${plugin.displayName}" 已从系统卸载`);
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
    <div className="flex-1 flex flex-col bg-background">
      {/* 顶部导航栏 */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">系统插件库</h1>
            <p className="text-sm text-muted-foreground">管理全局可用的系统级插件，适用于所有项目</p>
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
            {/* Marketplace Selector and Search */}
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
                    .filter(plugin =>
                      searchQuery === '' ||
                      plugin.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      plugin.description.toLowerCase().includes(searchQuery.toLowerCase())
                    )
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
                                <Badge variant="secondary" className="text-xs">{plugin.category}</Badge>
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
                  {plugins.map((plugin) => (
                    <div
                      key={plugin.id}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base mb-1">
                            {plugin.name || '未知插件'}
                          </h3>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {plugin.description || '暂无描述'}
                      </p>

                      <div className="mt-2 text-xs text-gray-400 truncate" title={plugin.installPath}>
                        路径: {plugin.installPath}
                      </div>
                    </div>
                  ))}
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
              : `共 ${availablePlugins.length} 个可用插件`}
          </p>
        </div>
      )}
    </div>
  );
};
