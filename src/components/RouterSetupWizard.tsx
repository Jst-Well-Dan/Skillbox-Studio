import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Terminal, RefreshCw, AlertTriangle } from 'lucide-react';
import { api, type DependencyStatus } from '@/lib/api';
import { listen } from '@tauri-apps/api/event';

interface RouterSetupWizardProps {
  onSetupComplete: () => void;
  onGoToEnvironment?: () => void;
}

export default function RouterSetupWizard({ onSetupComplete, onGoToEnvironment }: RouterSetupWizardProps) {
  const [status, setStatus] = useState<DependencyStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkDependencies = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const result = await api.checkRouterDependencies();
      setStatus(result);

      // 如果所有依赖都已安装，自动跳转到配置界面
      if (result.node_installed && result.ccr_installed) {
        setTimeout(() => onSetupComplete(), 1000);
      }
    } catch (err) {
      console.error('检测依赖失败:', err);
      setError('检测依赖失败，请稍后重试');
    } finally {
      setChecking(false);
    }
  }, [onSetupComplete]);

  useEffect(() => {
    checkDependencies();
  }, [checkDependencies]);

  // Listen for Node.js installation completion to auto-refresh
  useEffect(() => {
    const unlisten = listen('nodejs-installed', () => {
      console.log('Node.js installed, refreshing dependencies...');
      checkDependencies();
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [checkDependencies]);

  if (checking) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-4">
          <RefreshCw className="w-12 h-12 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">正在检测依赖...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={checkDependencies} className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  const allInstalled = status?.node_installed && status?.ccr_installed;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">CCR 服务设置</h2>
        <p className="text-sm text-muted-foreground mt-1">Claude Code Router</p>
        <p className="text-muted-foreground mt-2">
          CCR 可以让您使用免费的 Gemini 模型来运行 Claude Code，大幅降低使用成本。首次使用需要安装必要的环境。
        </p>
        {/* 省钱提示 */}
        <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800/50 mt-3">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            💰 <span className="font-medium">省钱方案：</span>使用 Google Gemini 等免费 API 替代付费的 Claude API
          </p>
        </div>
      </div>

      {/* Node.js 状态 */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          {status?.node_installed ? (
            <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h3 className="font-medium">Node.js</h3>
            {status?.node_installed ? (
              <>
                <p className="text-sm text-muted-foreground mt-1">
                  已安装 (版本 {status.node_version})
                </p>
                {status.node_path && (
                  <p className="text-xs text-muted-foreground mt-1">
                    路径: {status.node_path}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mt-1">
                  未安装 - 请先在"环境检测"页面安装 Node.js
                </p>
                {onGoToEnvironment && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={onGoToEnvironment}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                    前往环境检测
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* CCR 状态 */}
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {status?.ccr_installed ? (
              <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className="font-medium">Claude Code Router</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {status?.ccr_installed
                  ? `已安装 (版本 ${status.ccr_version})`
                  : '未安装 - 需要通过 npm 安装'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 安装说明 - 仅当 Node.js 已安装但 CCR 未安装时显示 */}
      {status?.node_installed && !status?.ccr_installed && (
        <Alert>
          <Terminal className="w-4 h-4" />
          <AlertDescription>
            <h4 className="font-medium mb-2">安装步骤：</h4>
            <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded font-mono">
              {status.install_instructions}
            </pre>
          </AlertDescription>
        </Alert>
      )}

      {/* Node.js 未安装时的提示 */}
      {!status?.node_installed && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <div className="font-medium mb-1">需要先安装 Node.js</div>
            <p className="text-sm">
              CCR 依赖 Node.js 运行环境。请先前往"环境检测"页面安装 Node.js。
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <Button
          onClick={checkDependencies}
          variant="outline"
          className="flex-1"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          重新检测
        </Button>
        {allInstalled && (
          <Button
            onClick={onSetupComplete}
            className="flex-1"
          >
            继续配置 CCR 服务
          </Button>
        )}
      </div>

      {/* 完成提示 */}
      {allInstalled && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            ✅ 所有依赖已安装完成！您现在可以配置 CCR 服务了。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
