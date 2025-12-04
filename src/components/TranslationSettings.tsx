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
          <h2 className="text-2xl font-bold">智能翻译设置</h2>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        )}
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
            <span>基本设置</span>
          </CardTitle>
          <CardDescription>
            配置智能翻译中间件，实现中英文透明翻译
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

            <div className="space-y-2">
              <Label htmlFor="cache-ttl">缓存有效期（秒）</Label>
              <Input
                id="cache-ttl"
                type="number"
                value={config.cache_ttl_seconds}
                onChange={(e) => handleConfigChange('cache_ttl_seconds', parseInt(e.target.value) || 3600)}
                min="300"
                max="86400"
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
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                用于访问智谱 AI GLM-4-Flash 翻译API的密钥
              </p>
              <p className="text-xs text-blue-600">
                💡 获取API密钥：访问 <a href="https://open.bigmodel.cn" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">https://open.bigmodel.cn</a> 注册账号并获取API密钥
              </p>
              {!config.api_key && (
                <p className="text-xs text-red-600">
                  ⚠️ 未配置API密钥时翻译功能将无法工作
                </p>
              )}
            </div>
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
          
          {!config.api_key.trim() && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>需要配置API密钥：</strong>
                <br />
                1. 访问 <a href="https://open.bigmodel.cn" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">智谱 AI 开放平台</a> 注册账号
                <br />
                2. 在控制台创建API密钥
                <br />
                3. 将密钥填写到上方输入框中
                <br />
                4. 保存配置并测试连接
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 缓存管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>缓存管理</span>
          </CardTitle>
          <CardDescription>
            管理翻译结果缓存，提高响应速度
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cacheStats ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {cacheStats.total_entries}
                  </div>
                  <div className="text-sm text-muted-foreground">总缓存条目</div>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {cacheStats.active_entries}
                  </div>
                  <div className="text-sm text-muted-foreground">有效缓存</div>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {cacheStats.expired_entries}
                  </div>
                  <div className="text-sm text-muted-foreground">过期缓存</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                无法获取缓存统计信息
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={loadData}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                刷新统计
              </Button>
              
              <Button
                variant="destructive"
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

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
          <CardDescription>
            了解智能翻译中间件的工作原理
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-2">功能特点</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>透明翻译</strong>: 用户体验与直接中文对话一致</li>
                <li><strong>智能检测</strong>: 自动识别中英文语言</li>
                <li><strong>双向翻译</strong>: 中文输入→英文发送，英文响应→中文显示</li>
                <li><strong>缓存优化</strong>: 相同翻译结果本地缓存，提高响应速度</li>
                <li><strong>降级保护</strong>: 翻译失败时自动使用原文，确保功能可用</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-2">工作流程</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>用户输入中文提示词</li>
                <li>中间件检测到中文，自动翻译为英文</li>
                <li>将英文发送给Claude API</li>
                <li>Claude返回英文响应</li>
                <li>中间件将英文响应翻译为中文</li>
                <li>用户看到中文响应</li>
              </ol>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Badge variant="secondary">版本: 1.0.0</Badge>
              <Badge variant="outline">模型: {config.model || 'GLM-4-Flash'}</Badge>
              <Badge variant={config.enabled ? "default" : "secondary"}>
                状态: {config.enabled ? "已启用" : "已禁用"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
