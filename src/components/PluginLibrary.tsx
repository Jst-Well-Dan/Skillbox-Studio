import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Package, Languages } from 'lucide-react';
import { PluginCard } from './PluginCard';
import { loadInstalledPlugins, type PluginCard as PluginCardType } from '../lib/pluginReader';
import { api } from '../lib/api';
import { translatePlugins } from '@/hooks/usePluginTranslation';
import { Button } from '@/components/ui/button';

interface PluginLibraryProps {
  onBack: () => void;
  onStartSession: (workspacePath: string) => void;
}

/**
 * PluginLibrary组件 - 显示所有已安装Plugin的库
 * 选择Plugin后会创建/确保工作空间存在，然后启动对话
 */
export const PluginLibrary: React.FC<PluginLibraryProps> = ({ onBack, onStartSession }) => {
  const [plugins, setPlugins] = useState<PluginCardType[]>([]);
  const [originalPlugins, setOriginalPlugins] = useState<PluginCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPlugin, setProcessingPlugin] = useState<string | null>(null);

  // 语言切换状态
  const [language, setLanguage] = useState<'en' | 'zh'>(() => {
    const saved = localStorage.getItem('plugin-library-language');
    return (saved === 'zh' || saved === 'en') ? saved : 'en';
  });
  const [translating, setTranslating] = useState(false);

  // 加载已安装的Plugins
  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
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
      setError('加载插件列表失败，请检查是否已安装Claude Code插件');
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
        const translatedPlugins = await translatePlugins(originalPlugins);
        setPlugins(translatedPlugins);
      } catch (error) {
        console.error('Translation failed:', error);
      } finally {
        setTranslating(false);
      }
    } else {
      // 切换到英文：显示原始数据
      setPlugins(originalPlugins);
    }
  };

  /**
   * 处理Plugin选择：创建工作空间 + 启动对话
   */
  const handleStartConversation = async (plugin: PluginCardType) => {
    try {
      setProcessingPlugin(plugin.id);

      // 1. 确保工作空间目录存在
      await api.ensurePluginWorkspace(plugin.name);

      // 2. 在工作空间中设置Plugin（创建符号链接等）
      await api.setupPluginInWorkspace(plugin.installPath, plugin.workspacePath);

      // 3. 启动会话（导航到该工作空间）
      onStartSession(plugin.workspacePath);
    } catch (err) {
      console.error('Failed to start conversation with plugin:', err);
      alert(`启动对话失败: ${err}`);
    } finally {
      setProcessingPlugin(null);
    }
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
            <h1 className="text-xl font-semibold">智能助手</h1>
            <p className="text-sm text-muted-foreground">选择一个插件开启专属 AI 对话</p>
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
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* 加载状态 */}
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">加载插件列表中...</p>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <Package className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">加载失败</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <button
                onClick={loadPlugins}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !error && plugins.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">暂无已安装插件</h3>
                <p className="text-sm text-muted-foreground">
                  请先使用 Claude Code CLI 安装插件
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  claude plugins install [plugin-name]
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Plugin网格 */}
        {!loading && !error && plugins.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="relative">
                <PluginCard
                  plugin={plugin}
                  onStartConversation={handleStartConversation}
                />
                {/* 处理中的遮罩 */}
                {processingPlugin === plugin.id && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">准备工作空间...</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部统计信息 */}
      {!loading && !error && plugins.length > 0 && (
        <div className="border-t border-border px-6 py-3">
          <p className="text-xs text-muted-foreground text-center">
            共找到 {plugins.length} 个已安装插件
          </p>
        </div>
      )}
    </div>
  );
};
