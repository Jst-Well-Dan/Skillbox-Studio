/**
 * 键盘快捷键 Hook
 *
 * 从 ClaudeCodeSession 提取（原 405-462 行）
 * 处理双击 ESC 和 Shift+Tab 的快捷键检测
 */

import { useEffect, useState } from 'react';

interface KeyboardShortcutsConfig {
  /** 是否激活（用于多标签管理） */
  isActive: boolean;
  /** 切换 Plan Mode */
  onTogglePlanMode: () => void;
  /** 显示撤回提示词选择器（双击 ESC） */
  onShowRevertDialog?: () => void;
  /** 是否有对话框打开（如果有，则不处理 ESC） */
  hasDialogOpen?: boolean;
}

/**
 * 键盘快捷键 Hook
 *
 * @param config - 配置对象
 *
 * @example
 * useKeyboardShortcuts({
 *   isActive: true,
 *   onTogglePlanMode: () => setIsPlanMode(prev => !prev),
 *   onShowRevertDialog: () => setShowRevertPicker(true)
 * });
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig): void {
  const { isActive, onTogglePlanMode, onShowRevertDialog, hasDialogOpen = false } = config;

  const [lastEscapeTime, setLastEscapeTime] = useState(0);

  // Double ESC key detection for revert dialog
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      // Don't handle ESC if a dialog is open (let the dialog handle it)
      if (event.key === 'Escape' && isActive && !hasDialogOpen) {
        const now = Date.now();

        // Check if this is a double ESC within 300ms
        if (now - lastEscapeTime < 300) {
          event.preventDefault();
          event.stopPropagation();

          // Show revert dialog
          if (onShowRevertDialog) {
            console.log('[KeyboardShortcuts] Double ESC detected - showing revert dialog');
            onShowRevertDialog();
          } else {
            console.log('[KeyboardShortcuts] Double ESC detected - no handler registered');
          }
        }

        setLastEscapeTime(now);
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handleEscapeKey, { capture: true });
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey, { capture: true });
    };
  }, [lastEscapeTime, isActive, onShowRevertDialog, hasDialogOpen]);

  // Shift+Tab for Plan Mode toggle (single press, consistent with Claude Code official)
  useEffect(() => {
    const handlePlanModeToggle = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && event.shiftKey && isActive) {
          event.preventDefault();
          event.stopPropagation();

        // Toggle Plan Mode (single press, as per official Claude Code)
          onTogglePlanMode();
          console.log('[KeyboardShortcuts] Shift+Tab detected - toggling Plan Mode');
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handlePlanModeToggle, { capture: true });
    }

    return () => {
      document.removeEventListener('keydown', handlePlanModeToggle, { capture: true });
    };
  }, [isActive, onTogglePlanMode]);
}
