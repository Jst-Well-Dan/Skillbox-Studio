import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Play, AlertCircle } from 'lucide-react';

export const DiagnosticPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setError(null);
    setReport('');

    try {
      const result = await api.diagnosticClaudeCli();
      setReport(result);
    } catch (err) {
      setError(`诊断失败: ${err}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Claude CLI 诊断工具</h2>
        <p className="text-sm text-muted-foreground">
          运行诊断来检查 Claude CLI 是否正确安装和配置
        </p>
      </div>

      <Button
        onClick={runDiagnostic}
        disabled={isRunning}
        className="w-full"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            运行诊断中...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            运行诊断
          </>
        )}
      </Button>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {report && (
        <div className="bg-gray-50 rounded-md p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-96">
            {report}
          </pre>
        </div>
      )}
    </Card>
  );
};
