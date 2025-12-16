import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Download, Terminal, ExternalLink, Box } from 'lucide-react';

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

  // Claude Code installation state
  const [isInstallingCli, setIsInstallingCli] = useState(false);
  const [cliInstallMessage, setCliInstallMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-check on mount
  useEffect(() => {
    checkEnvironment();
  }, []);

  const checkEnvironment = useCallback(async () => {
    setIsChecking(true);
    setResult(null);
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
          disabled={isChecking || isInstallingCli}
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
                          请按照下方步骤手动安装
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Node.js Manual Install Guide */}
                {!nodeInstalled && (
                  <>
                    {/* 手动安装指导 */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50 space-y-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                        📋 安装步骤：
                      </p>
                      <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-decimal list-inside">
                        <li>点击下方按钮打开 Node.js 官网下载页面</li>
                        <li>下载 <strong>Windows Installer (.msi)</strong> 版本（推荐 LTS 长期支持版）</li>
                        <li>双击下载的 .msi 文件，按照提示完成安装</li>
                        <li>安装完成后，点击上方"刷新状态"按钮检测</li>
                      </ol>
                    </div>

                    <Button
                      onClick={openNodePage}
                      className="w-full"
                      size="lg"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      打开 Node.js 官网下载
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      💡 提示：安装完成后可能需要重启本应用才能检测到
                    </p>
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
