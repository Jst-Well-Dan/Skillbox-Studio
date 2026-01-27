import { useState } from "react";
import { ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { HistoryRecord } from "../lib/api";


interface InstallHistoryPanelProps {
    history: HistoryRecord[];
    onClear?: () => void;
}

export function InstallHistoryPanel({ history, onClear }: InstallHistoryPanelProps) {
    const [isOpen, setIsOpen] = useState(false);

    // 按操作类型分组统计
    const stats = {
        installs: history.filter(r => r.operation === "install").length,
        uninstalls: history.filter(r => r.operation === "uninstall").length,
        successes: history.filter(r => r.status === "success").length,
        failures: history.filter(r => r.status === "failed").length,
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "刚刚";
        if (diffMins < 60) return `${diffMins} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        if (diffDays < 7) return `${diffDays} 天前`;

        return date.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const getOperationIcon = (operation: string) => {
        return operation === "install" ? "📥" : "🗑️";
    };

    const getStatusBadge = (status: string) => {
        if (status === "success") {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    成功
                </span>
            );
        } else {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    <XCircle className="h-3 w-3" />
                    失败
                </span>
            );
        }
    };

    return (
        <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                >
                    {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                    <Clock className="h-4 w-4" />
                    <span>安装历史</span>
                    <span className="text-sm text-muted-foreground">
                        ({history.length} 条记录)
                    </span>
                </button>

                {history.length > 0 && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>✓ {stats.successes}</span>
                        <span>✗ {stats.failures}</span>
                        {onClear && (
                            <button
                                onClick={onClear}
                                className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                                title="清除历史记录"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">暂无历史记录</p>
                        </div>
                    ) : (
                        history.map((record) => (
                            <div
                                key={record.id}
                                className="border rounded-lg p-3 bg-card hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">{getOperationIcon(record.operation)}</span>
                                            <span className="font-medium truncate">
                                                {record.plugin_name}
                                            </span>
                                            {getStatusBadge(record.status)}
                                        </div>

                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <span className="font-medium">Agents:</span>
                                                    {record.agents.join(", ")}
                                                </span>
                                                <span>•</span>
                                                <span className="capitalize">{record.scope}</span>
                                            </div>

                                            {record.error_message && (
                                                <div className="text-xs text-destructive bg-destructive/10 rounded p-2 mt-1">
                                                    错误: {record.error_message}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDate(record.installed_at)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* 统计信息 */}
            {isOpen && history.length > 0 && (
                <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-muted/50">
                        <div className="font-medium text-muted-foreground">总计</div>
                        <div className="text-lg font-bold">{history.length}</div>
                    </div>
                    <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30">
                        <div className="font-medium text-blue-600 dark:text-blue-400">安装</div>
                        <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{stats.installs}</div>
                    </div>
                    <div className="p-2 rounded bg-orange-50 dark:bg-orange-950/30">
                        <div className="font-medium text-orange-600 dark:text-orange-400">卸载</div>
                        <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{stats.uninstalls}</div>
                    </div>
                    <div className="p-2 rounded bg-green-50 dark:bg-green-950/30">
                        <div className="font-medium text-green-600 dark:text-green-400">成功率</div>
                        <div className="text-lg font-bold text-green-700 dark:text-green-300">
                            {history.length > 0 ? Math.round((stats.successes / history.length) * 100) : 0}%
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
