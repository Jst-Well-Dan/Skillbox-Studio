import { useState, useEffect } from "react";
import { X, Info, ExternalLink } from "lucide-react";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { getVersion } from "@tauri-apps/api/app";

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  onCheckUpdate?: () => void; // 保留以保持向后兼容，但不再使用
}

export function AboutDialog({ open, onClose, onCheckUpdate: _onCheckUpdate }: AboutDialogProps) {
  const [appVersion, setAppVersion] = useState<string>("加载中...");
  const PLUGIN_LIBRARY_URL = "https://skill-box.zwtj.site/"; // 蹊涯插件库地址

  // 动态获取应用版本号
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (err) {
        console.error("获取版本号失败:", err);
        setAppVersion("未知");
      }
    };

    if (open) {
      fetchVersion();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleOpenPluginLibrary = async () => {
    try {
      await openUrl(PLUGIN_LIBRARY_URL);
    } catch (err) {
      console.error("打开插件库失败:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              关于 Xiya Claude Studio
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Version Info */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Info className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Xiya Claude Studio
            </h3>
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">版本:</span>
              <span className="text-base font-mono font-semibold text-primary">
                v{appVersion}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Xiya Claude Studio 是一个专业的 AI 工作平台，
              整合海量社区技能，助您高效完成工作与学习中的各类任务。
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleOpenPluginLibrary}
              className="w-full px-4 py-2.5 text-sm font-medium text-primary hover:text-primary/80 border border-border hover:border-primary/30 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              访问蹊涯插件库
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/50 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © 2025 北京知微探界科技有限公司
          </p>
        </div>
      </div>
    </div>
  );
}
