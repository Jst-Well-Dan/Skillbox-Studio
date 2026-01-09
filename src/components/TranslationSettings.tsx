import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { api, type TranslationConfig, type TranslationCacheStats } from '@/lib/api';
import { translationMiddleware } from '@/lib/translationMiddleware';
import { Loader2, RefreshCw, Settings, Languages, Database, AlertTriangle } from 'lucide-react';

interface TranslationSettingsProps {
  onClose?: () => void;
}

export const TranslationSettings: React.FC<TranslationSettingsProps> = ({ onClose }) => {
  const [config, setConfig] = useState<TranslationConfig | null>(null);
  const [cacheStats, setCacheStats] = useState<TranslationCacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 加载初始数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [configData, statsData] = await Promise.all([
        api.getTranslationConfig(),
        api.getTranslationCacheStats().catch(() => null) // 缓存统计可能失败
      ]);
      
      setConfig(configData);
      setCacheStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载翻译设置失败');
      console.error('Failed to load translation settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      await api.updateTranslationConfig(config);
      await translationMiddleware.updateConfig(config);
      
      setSuccess('翻译配置保存成功！');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败');
      console.error('Failed to save translation config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config) return;

    // 检查API密钥是否已配置
    if (!config.api_key.trim()) {
      setError('请先填写API密钥');
      return;
    }

    try {
      setTestingConnection(true);
      setError(null);
      
      // 测试翻译功能
      await api.translateText('Hello', 'zh');
      
      setSuccess('翻译服务连接测试成功！');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '连接测试失败';
      setError(`连接测试失败: ${errorMessage}`);
      console.error('Translation connection test failed:', err);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setClearingCache(true);
      setError(null);
      
      await api.clearTranslationCache();
      await loadData(); // 重新加载缓存统计
      
      setSuccess('翻译缓存清空成功！');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空缓存失败');
      console.error('Failed to clear translation cache:', err);
    } finally {
      setClearingCache(false);
    }
  };

  const handleConfigChange = (key: keyof TranslationConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>加载翻译设置中...</span>
      </div>
    );
  }

  if (!config) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>无法加载翻译配置</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Languages className="h-6 w-6" />
          <h2 className="text-2xl font-bold">智能翻译</h2>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        )}
      </div>

      {/* 简洁功能说明 */}
      <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 mt-3">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          🌐 <span className="font-medium">自动翻译界面英文内容</span> — 插件描述、技能说明等英文内容自动显示为中文
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
          💬 <span className="font-medium">对话翻译</span> — Claude 的英文回复自动翻译为中文（可选）
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {/* 基本设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>翻译服务配置</span>
          </CardTitle>
          <CardDescription>
            使用智谱 AI 免费翻译 API（GLM-4-Flash）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="translation-enabled" className="text-sm font-medium">
              启用智能翻译
            </Label>
            <Switch
              id="translation-enabled"
              checked={config.enabled}
              onCheckedChange={(enabled) => handleConfigChange('enabled', enabled)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="response-translation-enabled" className="text-sm font-medium">
                启用对话翻译
              </Label>
              <p className="text-xs text-muted-foreground">
                自动将 Claude 的英文回复翻译为中文
              </p>
            </div>
            <Switch
              id="response-translation-enabled"
              checked={config.enable_response_translation}
              onCheckedChange={(enabled) => handleConfigChange('enable_response_translation', enabled)}
              disabled={!config.enabled}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api-base-url">API 基础URL</Label>
              <Input
                id="api-base-url"
                value={config.api_base_url}
                onChange={(e) => handleConfigChange('api_base_url', e.target.value)}
                placeholder="https://open.bigmodel.cn/api/paas/v4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">翻译模型</Label>
              <Input
                id="model"
                value={config.model}
                onChange={(e) => handleConfigChange('model', e.target.value)}
                placeholder="GLM-4-Flash"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout">请求超时（秒）</Label>
              <Input
                id="timeout"
                type="number"
                value={config.timeout_seconds}
                onChange={(e) => handleConfigChange('timeout_seconds', parseInt(e.target.value) || 30)}
                min="5"
                max="300"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key" className="flex items-center space-x-2">
              <span>API 密钥</span>
              {!config.api_key && (
                <Badge variant="destructive" className="text-xs">必填</Badge>
              )}
            </Label>
            <Input
              id="api-key"
              type="password"
              value={config.api_key}
              onChange={(e) => handleConfigChange('api_key', e.target.value)}
              placeholder="请输入您的智谱 AI API 密钥"
              className={!config.api_key ? "border-red-300" : ""}
            />
            <p className="text-xs text-muted-foreground">
              免费获取：<a href="https://open.bigmodel.cn" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">open.bigmodel.cn</a> 注册后即可获得 API 密钥
            </p>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存配置
            </Button>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection || !config.enabled || !config.api_key.trim()}
            >
              {testingConnection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              测试连接
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 缓存管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>翻译缓存</span>
          </CardTitle>
          <CardDescription>
            已翻译内容永久缓存，加速响应
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cacheStats ? (
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {cacheStats.total_entries}
                  </div>
                  <div className="text-sm text-muted-foreground">已缓存条目</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                无法获取缓存统计
              </div>
            )}

            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                刷新
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearCache}
                disabled={clearingCache}
              >
                {clearingCache && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                清空缓存
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 状态指示 */}
      <div className="flex items-center justify-center space-x-3 text-xs text-muted-foreground">
        <Badge variant="outline">模型: {config.model || 'GLM-4-Flash'}</Badge>
        <Badge variant={config.enabled ? "default" : "secondary"}>
          {config.enabled ? "✓ 已启用" : "未启用"}
        </Badge>
      </div>
    </div>
  );
};
