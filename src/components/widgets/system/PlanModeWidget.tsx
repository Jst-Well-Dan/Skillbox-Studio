import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';

export interface PlanModeWidgetProps {
  mode: 'enter' | 'exit';
  reason?: string;
  resultMessage?: string;
  status?: 'success' | 'error' | 'pending';
}

const statusConfig = {
  success: {
    label: '成功',
    icon: ShieldCheck,
    badgeClass: 'bg-green-100 text-green-700 border border-green-200',
    textClass: 'text-green-700'
  },
  error: {
    label: '失败',
    icon: ShieldAlert,
    badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    textClass: 'text-red-700'
  },
  pending: {
    label: '等待响应',
    icon: RefreshCw,
    badgeClass: 'bg-muted text-muted-foreground border border-border/60',
    textClass: 'text-muted-foreground'
  }
} as const;

export const PlanModeWidget: React.FC<PlanModeWidgetProps> = ({
  mode,
  reason,
  resultMessage,
  status = 'pending'
}) => {
  const modeLabel = mode === 'enter' ? '进入 Plan Mode' : '退出 Plan Mode';
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="border border-blue-500/20 bg-blue-500/5">
      <CardHeader className="flex flex-col gap-2 space-y-0 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-blue-500/10 p-2 text-blue-500">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">{modeLabel}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Claude 的只读规划模式切换
            </CardDescription>
          </div>
        </div>

        <Badge className={`flex items-center gap-1 px-2 py-1 text-xs font-medium ${statusInfo.badgeClass}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusInfo.label}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {reason && (
          <div className="rounded-lg border border-dashed border-border/50 bg-background/60 p-3">
            <p className="text-xs font-medium text-muted-foreground/80">请求原因</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{reason}</p>
          </div>
        )}

        {resultMessage && (
          <div
            className={`rounded-lg border bg-background/70 p-3 text-sm ${statusInfo.textClass} border-border/60`}
          >
            <p className="text-xs font-medium uppercase tracking-wide">系统反馈</p>
            <p className="mt-1 whitespace-pre-wrap">{resultMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

PlanModeWidget.displayName = 'PlanModeWidget';
