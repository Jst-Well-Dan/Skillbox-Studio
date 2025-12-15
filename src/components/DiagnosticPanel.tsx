import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Download, Terminal, ExternalLink, Box } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import type { NodejsInstallProgress } from '@/lib/api';

interface DiagnosticResult {
  // Node.js
  nodeInstalled: boolean;
  nodeVersion: string | null;
  // Claude Code CLI
  cliFound: boolean;
  cliVersion: string | null;
  cliExecutable: boolean;
  error: string | null;
}

export const DiagnosticPanel: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  // Node.js installation state
  const [isInstallingNode, setIsInstallingNode] = useState(false);
  const [nodeProgress, setNodeProgress] = useState<NodejsInstallProgress | null>(null);
  const [nodeInstallError, setNodeInstallError] = useState<string | null>(null);

  // Claude Code installation state
  const [isInstallingCli, setIsInstallingCli] = useState(false);
  const [cliInstallMessage, setCliInstallMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Listen for Node.js installation progress
  useEffect(() => {
    const unlisten = listen<NodejsInstallProgress>('nodejs-install-progress', (event) => {
      setNodeProgress(event.payload);

      if (event.payload.stage === 'Completed') {
        setIsInstallingNode(false);
        // Refresh after successful installation
        setTimeout(() => checkEnvironment(), 1000);
      } else if (event.payload.stage === 'Failed') {
        setNodeInstallError(event.payload.message);
        setIsInstallingNode(false);
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // Auto-check on mount
  useEffect(() => {
    checkEnvironment();
  }, []);

  const checkEnvironment = useCallback(async () => {
    setIsChecking(true);
    setResult(null);
    setNodeInstallError(null);
    setCliInstallMessage(null);

    try {
      // Check Node.js and Claude CLI in parallel
      const [nodeVersion, cliStatus] = await Promise.all([
        api.checkNodejsInstalled().catch(() => null),
        api.checkClaudeVersion().catch(() => ({ is_installed: false, version: null })),
      ]);

      setResult({
        nodeInstalled: !!nodeVersion,
        nodeVersion: nodeVersion,
        cliFound: cliStatus.is_installed,
        cliVersion: cliStatus.version || null,
        cliExecutable: cliStatus.is_installed,
        error: null,
      });
    } catch (err) {
      setResult({
        nodeInstalled: false,
        nodeVersion: null,
        cliFound: false,
        cliVersion: null,
        cliExecutable: false,
        error: `检测失败: ${err}`,
      });
    } finally {
      setIsChecking(false);
    }
  }, []);

  const handleInstallNode = async () => {
    setIsInstallingNode(true);
    setNodeInstallError(null);
    setNodeProgress(null);

    try {
      await api.installNodejsComplete();
      // Success is handled by event listener
    } catch (err: any) {
      const errorMessage = typeof err === 'string' ? err : err?.message || '未知错误';
      setNodeInstallError(`安装失败：${errorMessage}`);
      setNodeProgress({
        stage: 'Failed',
        percentage: 0,
        message: errorMessage,
      });
      setIsInstallingNode(false);
    }
  };

  const handleInstallCli = async () => {
    setIsInstallingCli(true);
    setCliInstallMessage(null);

    try {
      const result = await api.installClaudeCode();
      setCliInstallMessage({ type: 'success', text: result });
      // Refresh
      await checkEnvironment();
    } catch (err: any) {
      setCliInstallMessage({ type: 'error', text: `安装失败: ${err}` });
    } finally {
      setIsInstallingCli(false);
    }
  };

  const openNodePage = () => {
    import('@tauri-apps/plugin-shell').then(({ open }) => {
      open('https://nodejs.org/zh-cn/download/');
    });
  };

  const openNpmPage = () => {
    import('@tauri-apps/plugin-shell').then(({ open }) => {
      open('https://www.npmjs.com/package/@anthropic-ai/claude-code');
    });
  };

  const getStageText = (stage: string): string => {
    const stageMap: Record<string, string> = {
      FetchingVersion: '正在获取版本信息...',
      Downloading: '正在下载 Node.js 安装包...',
      Verifying: '正在验证安装包完整性...',
      Installing: '正在安装 Node.js（请在弹出的授权窗口中确认）...',
      Completed: '安装完成！',
      Failed: '安装失败',
    };
    return stageMap[stage] || stage;
  };

  const nodeInstalled = result?.nodeInstalled;
  const cliInstalled = result?.cliFound && result?.cliExecutable;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 mt-3">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          🔧 <span className="font-medium">运行环境检测</span> — 本应用需要以下环境才能正常工作
        </p>
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={checkEnvironment}
          disabled={isChecking || isInstallingNode || isInstallingCli}
        >
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          刷新状态
        </Button>
      </div>

      {isChecking ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-muted-foreground">正在检测环境...</span>
        </div>
      ) : result ? (
        <div className="space-y-4">
          {/* Node.js Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Box className="h-5 w-5 text-green-600" />
                    Node.js
                  </CardTitle>
                  <CardDescription>
                    JavaScript 运行时环境，Claude Code CLI 的基础依赖
                  </CardDescription>
                </div>
                {nodeInstalled ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    已安装
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    未安装
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  {nodeInstalled ? (
                    <>
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div className="flex-1">
                        <div className="font-medium text-green-700 dark:text-green-400">
                          已安装
                        </div>
                        {result.nodeVersion && (
                          <div className="text-sm text-muted-foreground">
                            版本: {result.nodeVersion}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-8 w-8 text-red-500" />
                      <div className="flex-1">
                        <div className="font-medium text-red-700 dark:text-red-400">
                          未安装
                        </div>
                        <div className="text-sm text-muted-foreground">
                          点击下方按钮一键自动安装
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Node.js Installation Progress */}
                {nodeProgress && nodeProgress.stage !== 'Failed' && nodeProgress.stage !== 'Completed' && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="font-medium">{getStageText(nodeProgress.stage)}</span>
                    </div>
                    <Progress value={nodeProgress.percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{nodeProgress.message}</span>
                      <span>{Math.round(nodeProgress.percentage)}%</span>
                    </div>
                  </div>
                )}

                {/* Node.js Installation Error */}
                {nodeInstallError && (
                  <Alert variant="destructive">
                    <XCircle className="w-4 h-4" />
                    <AlertDescription className="ml-2">
                      <div className="font-medium mb-1">安装失败</div>
                      <div className="text-sm">{nodeInstallError}</div>
                      <div className="mt-2 text-xs opacity-80">
                        如果问题持续存在，请尝试
                        <a onClick={openNodePage} className="ml-1 underline hover:no-underline cursor-pointer">
                          手动安装
                        </a>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Node.js Install Button */}
                {!nodeInstalled && (
                  <>
                    <Button
                      onClick={handleInstallNode}
                      disabled={isInstallingNode || isChecking}
                      className="w-full"
                      size="lg"
                    >
                      {isInstallingNode ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          安装中...
                        </>
                      ) : nodeInstallError ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          重试安装
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          自动安装 Node.js (LTS)
                        </>
                      )}
                    </Button>

                    {/* Permission notice */}
                    {!nodeInstallError && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/50">
                        <p className="text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                          <span className="text-base">🔐</span>
                          <span>
                            安装过程中系统可能会弹出授权窗口，请点击"是"或输入密码以允许安装。
                          </span>
                        </p>
                      </div>
                    )}

                    {/* Manual install link */}
                    <div className="text-center">
                      <a
                        onClick={openNodePage}
                        className="text-xs text-muted-foreground hover:text-primary cursor-pointer inline-flex items-center gap-1"
                      >
                        或者手动下载安装
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </>
                )}

                {/* Node.js installed - show update option */}
                {nodeInstalled && (
                  <div className="text-sm text-muted-foreground">
                    ✨ Node.js 环境已就绪
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Claude Code CLI Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Claude Code CLI
                  </CardTitle>
                  <CardDescription>
                    Anthropic 官方命令行工具
                  </CardDescription>
                </div>
                {cliInstalled ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    已安装
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    未安装
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  {cliInstalled ? (
                    <>
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div className="flex-1">
                        <div className="font-medium text-green-700 dark:text-green-400">
                          已安装
                        </div>
                        {result.cliVersion && (
                          <div className="text-sm text-muted-foreground">
                            版本: {result.cliVersion}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-8 w-8 text-red-500" />
                      <div className="flex-1">
                        <div className="font-medium text-red-700 dark:text-red-400">
                          未安装
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {nodeInstalled
                            ? '点击下方按钮一键安装'
                            : '请先安装 Node.js'}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* CLI Installation Message */}
                {cliInstallMessage && (
                  <Alert variant={cliInstallMessage.type === 'error' ? 'destructive' : 'default'}>
                    <AlertDescription className={cliInstallMessage.type === 'success' ? 'text-green-600' : ''}>
                      {cliInstallMessage.text}
                    </AlertDescription>
                  </Alert>
                )}

                {/* CLI Install Button */}
                <Button
                  onClick={handleInstallCli}
                  disabled={isInstallingCli || isChecking || !nodeInstalled}
                  className="w-full"
                  variant={cliInstalled ? "outline" : "default"}
                >
                  {isInstallingCli ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {cliInstalled ? '更新中...' : '安装中...'}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      {cliInstalled ? '更新 Claude Code' : '安装 Claude Code'}
                    </>
                  )}
                </Button>

                {/* Dependency hint */}
                {!nodeInstalled && !cliInstalled && (
                  <div className="text-xs text-muted-foreground text-center">
                    💡 Claude Code CLI 依赖 Node.js，请先完成上方的 Node.js 安装
                  </div>
                )}

                {/* CLI installed message */}
                {cliInstalled && (
                  <div className="text-sm text-muted-foreground">
                    ✨ Claude Code CLI 已就绪，您可以开始使用 AI 助手功能
                  </div>
                )}

                {/* Help link */}
                <div className="flex items-center justify-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openNpmPage}
                    className="text-xs text-muted-foreground"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    查看 npm 包
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Ready Message */}
          {nodeInstalled && cliInstalled && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/50">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                ✅ 所有运行环境已就绪！您可以正常使用所有功能。
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}
    </div>
  );
};
