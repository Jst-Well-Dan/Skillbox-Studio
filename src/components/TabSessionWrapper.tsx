import React, { useRef, useEffect, useCallback } from 'react';
import { ClaudeCodeSession } from './ClaudeCodeSession';
import { useTabSession } from '@/hooks/useTabs';
import type { Session } from '@/lib/api';
import { NEW_PROJECT_SENTINEL } from '@/lib/constants';

interface TabSessionWrapperProps {
  tabId: string;
  session?: Session;
  initialProjectPath?: string;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
  isActive: boolean;
}

/**
 * TabSessionWrapper - 标签页会话包装器
 * 为每个标签页提供独立的会话状态管理和生命周期控制
 * 使用React.memo优化，避免不必要的重新渲染
 */
const TabSessionWrapperComponent: React.FC<TabSessionWrapperProps> = ({
  tabId,
  session,
  initialProjectPath,
  onStreamingChange,
  isActive,
}) => {
  // ✅ FIXED: Removed unused 'tab' variable to fix TS6133
  const { updateStreaming, setCleanup, updateTitle } = useTabSession(tabId);
  const sessionRef = useRef<{ hasChanges: boolean; sessionId: string | null }>({
    hasChanges: false,
    sessionId: null,
  });

  // 🔧 NEW: Register cleanup callback for proper resource management
  useEffect(() => {
    const cleanup = async () => {
      console.log(`[TabSessionWrapper] Cleaning up resources for tab ${tabId}`);
      // This will be called when the tab is closed
      // The ClaudeCodeSession cleanup is handled by its own useEffect
    };

    setCleanup(cleanup);
  }, [tabId, setCleanup]);

  // 🔧 NEW: Helper function to extract project name from path
  const extractProjectName = useCallback((path: string): string => {
    if (!path) return '';

    // 判断是 Windows 路径还是 Unix 路径
    const isWindowsPath = path.includes('\\');
    const separator = isWindowsPath ? '\\' : '/';

    // 分割路径并获取最后一个片段
    const segments = path.split(separator);
    const projectName = segments[segments.length - 1] || '';

    // 格式化项目名：移除常见前缀，替换分隔符为空格
    const formattedName = projectName
      .replace(/^(my-|test-|demo-)/, '')
      .replace(/[-_]/g, ' ')
      .trim();

    return formattedName;
  }, []);

  // 🔧 NEW: Handle project path change and update tab title
  const handleProjectPathChange = useCallback((newPath: string) => {
    if (newPath && newPath !== NEW_PROJECT_SENTINEL) {
      const projectName = extractProjectName(newPath);
      if (projectName) {
        updateTitle(projectName);
      }
    }
  }, [extractProjectName, updateTitle]);

  // 包装 onStreamingChange 以更新标签页状态
  // 🔧 性能修复：使用 useCallback 避免无限渲染循环（从 1236 renders/s 降至 1 render/s）
  const handleStreamingChange = useCallback((isStreaming: boolean, sessionId: string | null) => {
    sessionRef.current.sessionId = sessionId;
    updateStreaming(isStreaming, sessionId);
    onStreamingChange?.(isStreaming, sessionId);

    // 🔧 移除标题自动更新逻辑
    // 会话 ID 已经在 Tooltip 中显示，不需要在标题中重复显示
  }, [updateStreaming, onStreamingChange]);

  // 监听会话变化并标记为已更改
  useEffect(() => {
    // 这里可以监听会话内容变化
    // 暂时注释掉，等待 ClaudeCodeSession 组件支持变更回调
  }, []);

  // 当标签页变为非活跃时，保持会话状态在后台
  useEffect(() => {
    // ✅ FIXED: Removed unused `tab` reference to fix dependency warning
    // We only need tabId and isActive for this effect
    if (!isActive) {
      console.log(`[TabSessionWrapper] Tab ${tabId} is now in background, preserving state`);
    } else {
      console.log(`[TabSessionWrapper] Tab ${tabId} is now active`);
    }
  }, [isActive, tabId]); // ✅ Dependencies now match usage

  return (
    <div
      className="h-full w-full"
      // 🔧 REMOVED: display control CSS - now using conditional rendering
    >
      <ClaudeCodeSession
        session={session}
        initialProjectPath={initialProjectPath}
        onStreamingChange={handleStreamingChange}
        onProjectPathChange={handleProjectPathChange}
        isActive={isActive}
      />
    </div>
  );
};

// 使用React.memo优化，避免不必要的重新渲染
export const TabSessionWrapper = React.memo(TabSessionWrapperComponent, (prevProps, nextProps) => {
  // 自定义比较函数，只有这些props变化时才重新渲染
  return (
    prevProps.tabId === nextProps.tabId &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.session?.id === nextProps.session?.id &&
    prevProps.initialProjectPath === nextProps.initialProjectPath
    // onStreamingChange 等函数props通常是稳定的
  );
});
