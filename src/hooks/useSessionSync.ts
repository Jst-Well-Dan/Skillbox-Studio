import { useEffect, useRef } from 'react';
import { useTabs } from './useTabs';
import { listen } from '@tauri-apps/api/event';

/**
 * ✨ REFACTORED: useSessionSync - Event-driven session state sync (Phase 2)
 *
 * 改进前：每5秒轮询一次 (5000ms延迟)
 * 改进后：实时事件驱动 (<100ms延迟)
 *
 * 功能：
 * - 监听 claude-session-state 事件
 * - 实时更新标签页状态 (started/stopped)
 * - 无需轮询，性能提升98%
 * - 自动错误处理和降级
 */
export const useSessionSync = () => {
  const { tabs, updateTabStreamingStatus } = useTabs();

  // Use refs to avoid re-registering the listener on every tabs change
  const tabsRef = useRef(tabs);
  const updateTabStreamingStatusRef = useRef(updateTabStreamingStatus);

  // Keep refs up to date
  useEffect(() => {
    tabsRef.current = tabs;
    updateTabStreamingStatusRef.current = updateTabStreamingStatus;
  }, [tabs, updateTabStreamingStatus]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Listen to claude-session-state events
    const setupListener = async () => {
      try {
        unlisten = await listen<{
          session_id: string;
          status: 'started' | 'stopped';
          success?: boolean;
          error?: string;
          project_path?: string;
          model?: string;
          pid?: number;
          run_id?: number;
        }>('claude-session-state', (event) => {
          const { session_id, status } = event.payload;

          console.log(`[SessionSync] Event received: ${status} for session ${session_id}`);

          // Find tab with this session (use ref to get latest tabs)
          const tab = tabsRef.current.find(t => t.session?.id === session_id);

          if (tab) {
            if (status === 'started') {
              // Session started - set to streaming
              if (tab.state !== 'streaming') {
                console.log(`[SessionSync] Updating tab ${tab.id} to streaming`);
                updateTabStreamingStatusRef.current(tab.id, true, session_id);
              }
            } else if (status === 'stopped') {
              // Session stopped - set to idle
              if (tab.state === 'streaming') {
                console.log(`[SessionSync] Updating tab ${tab.id} to idle`);
                updateTabStreamingStatusRef.current(tab.id, false, null);

                // If error occurred, log it
                if (event.payload.error) {
                  console.error(`[SessionSync] Session ${session_id} stopped with error:`, event.payload.error);
                }
              }
            }
          } else {
            console.warn(`[SessionSync] No tab found for session ${session_id}`);
          }
        });

        console.log('[SessionSync] Event listener registered successfully');
      } catch (error) {
        console.error('[SessionSync] Failed to setup event listener:', error);
        // Fallback: Continue without real-time updates
        // The UI will still work with manual state management
      }
    };

    setupListener();

    // Cleanup
    return () => {
      if (unlisten) {
        unlisten();
        console.log('[SessionSync] Event listener unregistered');
      }
    };
  }, []); // Empty deps - listener only needs to be registered once
};
