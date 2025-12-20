import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  Square,
  RotateCcw,
  ExternalLink,
  Download,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Settings2
} from 'lucide-react';
import { api, type RouterStatus, type DependencyStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function RouterSettings() {
  const [status, setStatus] = useState<RouterStatus | null>(null);
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // 当前正在进行的操作
  const [initialLoading, setInitialLoading] = useState(true); // 初始加载状态
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [configDir, setConfigDir] = useState<string>('');

  // 加载依赖状态和 Router 状态
  const loadStatus = useCallback(async () => {
    try {
      const [statusResult, depsResult, configDirResult] = await Promise.all([
        api.getRouterStatus(),
        api.checkRouterDependencies(),
        api.getCcrConfigDir().catch(() => ''),
      ]);
      setStatus(statusResult);
      setDeps(depsResult);
      setConfigDir(configDirResult);
    } catch (err) {
      console.error('加载状态失败:', err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // 清除提示信息
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // 启动 CCR
  const handleStart = async () => {
    setLoading('start');
    clearMessages();

    try {
      const result = await api.startCcrNative();
      setStatus(result);
      setSuccess(`CCR 已启动，监听端口 ${result.port}`);
    } catch (err: any) {
      setError(`启动失败: ${err}`);
    } finally {
      setLoading(null);
    }
  };

  // 停止 CCR
  const handleStop = async () => {
    setLoading('stop');
    clearMessages();

    try {
      await api.stopRouter();
      setStatus({ running: false, port: 0, session_id: '', health: false });
      setSuccess('CCR 已停止');
    } catch (err: any) {
      setError(`停止失败: ${err}`);
    } finally {
      setLoading(null);
    }
  };

  // 重启 CCR
  const handleRestart = async () => {
    setLoading('restart');
    clearMessages();

    try {
      const result = await api.restartRouter();
      setStatus(result);
      setSuccess(`CCR 已重启，监听端口 ${result.port}`);
    } catch (err: any) {
      setError(`重启失败: ${err}`);
    } finally {
      setLoading(null);
    }
  };

  // 打开 CCR UI
  const handleOpenUI = async () => {
    setLoading('ui');
    clearMessages();

    try {
      await api.openCcrUi();
      setSuccess('CCR UI 已在浏览器中打开');
    } catch (err: any) {
      setError(`打开 UI 失败: ${err}`);
    } finally {
      setLoading(null);
    }
  };

  // 安装/更新 CCR
  const handleInstall = async () => {
    setLoading('install');
    clearMessages();

    try {
      const result = await api.installCcr(true);
      setSuccess(result);
      // 重新检测依赖
      await loadStatus();
    } catch (err: any) {
      setError(`安装失败: ${err}`);
    } finally {
      setLoading(null);
    }
  };

  // 打开配置目录
  const handleOpenConfigDir = async () => {
    try {
      await api.openCcrConfigDir();
    } catch (err: any) {
      setError(`打开目录失败: ${err}`);
    }
  };

  // 刷新状态
  const handleRefresh = async () => {
    setLoading('refresh');
    clearMessages();
    await loadStatus();
    setLoading(null);
  };

  const isRunning = status?.running && status?.health;
  const isExternal = status?.session_id === 'external';
  const hasNode = deps?.node_installed;
  const hasCcr = deps?.ccr_installed;
  const canStart = hasNode && hasCcr && !isRunning;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* 标题 */}
      <div>
        <h2 className="text-2xl font-bold">CCR 服务</h2>
        <p className="text-sm text-muted-foreground mt-1">Claude Code Router</p>
        <p className="text-muted-foreground mt-2">
          通过 CCR 使用免费的 Gemini 等模型替代 Claude API，节省费用。配置通过 <code className="text-xs bg-muted px-1 rounded">ccr ui</code> 进行管理
        </p>
        {/* 省钱提示 */}
        <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 mt-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            💰 <span className="font-medium">省钱方案：</span>使用 Google Gemini 等免费 API 替代付费的 Claude API
          </p>
        </div>
      </div>

      {/* 状态卡片 */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-4 h-4 rounded-full transition-all",
                isRunning
                  ? "bg-green-500 animate-pulse shadow-lg shadow-green-500/50"
                  : "bg-gray-400"
              )}
            />
            <div>
              <h3 className="font-semibold text-lg">服务状态</h3>
              <p className="text-sm text-muted-foreground">
                {isRunning
                  ? `运行中 · 端口 ${status?.port}${isExternal ? ' (外部启动)' : ''}`
                  : '已停止'}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={loading === 'refresh'}
          >
            <RefreshCw className={cn("w-4 h-4", loading === 'refresh' && "animate-spin")} />
          </Button>
        </div>
      </Card>

      {/* 错误/成功提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* 依赖状态 */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">环境检测</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading === 'refresh' || initialLoading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-1", (loading === 'refresh' || initialLoading) && "animate-spin")} />
            {initialLoading ? '检测中' : '重新检测'}
          </Button>
        </div>

        {initialLoading ? (
          // 初始加载状态
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Node.js</span>
              </div>
              <span className="text-sm text-muted-foreground">检测中...</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">claude-code-router</span>
              </div>
              <span className="text-sm text-muted-foreground">检测中...</span>
            </div>
            <Alert className="mt-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                正在检测系统环境，请稍候...
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          // 检测完成状态
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hasNode ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>Node.js</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {deps?.node_version || '未安装'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hasCcr ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>claude-code-router</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {deps?.ccr_version || '未安装'}
                </span>
              </div>
            </div>

            {/* 安装/更新按钮 */}
            {hasNode && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={handleInstall}
                disabled={loading === 'install'}
              >
                {loading === 'install' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {hasCcr ? '更新 CCR' : '安装 CCR'}
                {loading === 'install' && ' (安装中...)'}
              </Button>
            )}

            {!hasNode && (
              <Alert className="mt-4">
                <AlertDescription className="text-sm">
                  请先安装 Node.js (v18+)：
                  <a
                    href="https://nodejs.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-primary hover:underline"
                  >
                    https://nodejs.org/
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </Card>

      {/* 控制按钮 */}
      <Card className="p-5">
        <h3 className="font-medium mb-4">服务控制</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* 启动/停止 */}
          {isRunning ? (
            <Button
              variant="outline"
              onClick={handleStop}
              disabled={!!loading}
              className="h-12"
            >
              {loading === 'stop' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Square className="w-4 h-4 mr-2" />
              )}
              停止
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              disabled={!canStart || !!loading}
              className="h-12"
            >
              {loading === 'start' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              启动
            </Button>
          )}

          {/* 重启 */}
          <Button
            variant="outline"
            onClick={handleRestart}
            disabled={!isRunning || !!loading}
            className="h-12"
          >
            {loading === 'restart' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            重启
          </Button>

          {/* 打开 CCR UI */}
          <Button
            variant="outline"
            onClick={handleOpenUI}
            disabled={!hasCcr || !!loading}
            className="h-12"
          >
            {loading === 'ui' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Settings2 className="w-4 h-4 mr-2" />
            )}
            配置 (ccr ui)
          </Button>

          {/* 打开配置目录 */}
          <Button
            variant="outline"
            onClick={handleOpenConfigDir}
            className="h-12"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            配置目录
          </Button>
        </div>
      </Card>

      {/* 配置文件路径 */}
      {configDir && (
        <div className="text-xs text-muted-foreground text-center">
          配置文件: <code className="bg-muted px-1 rounded">{configDir}/config.json</code>
        </div>
      )}

      {/* 使用说明 */}
      <Alert>
        <AlertDescription className="text-sm space-y-2">
          <p><strong>使用流程：</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>点击「配置 (ccr ui)」在浏览器中打开配置界面</li>
            <li>在 CCR UI 中添加 API Provider（如 Gemini、ModelScope 等）</li>
            <li>配置完成后回到此处，点击「启动」</li>
            <li>CCR 会自动接管 Claude CLI 的 API 请求</li>
          </ol>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
            <ExternalLink className="w-3 h-3" />
            <a
              href="https://github.com/musistudio/claude-code-router"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              查看 claude-code-router 文档
            </a>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
