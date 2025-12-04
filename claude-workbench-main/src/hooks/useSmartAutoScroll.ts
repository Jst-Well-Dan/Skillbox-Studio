/**
 * 智能自动滚动 Hook
 *
 * 从 ClaudeCodeSession 提取（原 166-170 状态，305-435 逻辑）
 * 提供智能滚动管理：用户手动滚动检测、自动滚动到底部、流式输出滚动
 */

import { useRef, useState, useEffect } from 'react';
import type { ClaudeStreamMessage } from '@/types/claude';

interface SmartAutoScrollConfig {
  /** 可显示的消息列表（用于触发滚动） */
  displayableMessages: ClaudeStreamMessage[];
  /** 是否正在加载（流式输出时） */
  isLoading: boolean;
}

interface SmartAutoScrollReturn {
  /** 滚动容器 ref */
  parentRef: React.RefObject<HTMLDivElement>;
  /** 用户是否手动滚动离开底部 */
  userScrolled: boolean;
  /** 设置用户滚动状态 */
  setUserScrolled: (scrolled: boolean) => void;
  /** 设置自动滚动状态 */
  setShouldAutoScroll: (should: boolean) => void;
}

/**
 * 智能自动滚动 Hook
 *
 * @param config - 配置对象
 * @returns 滚动管理对象
 *
 * @example
 * const { parentRef, userScrolled, setUserScrolled, shouldAutoScroll, setShouldAutoScroll } =
 *   useSmartAutoScroll({
 *     displayableMessages,
 *     isLoading
 *   });
 */
export function useSmartAutoScroll(config: SmartAutoScrollConfig): SmartAutoScrollReturn {
  const { displayableMessages, isLoading } = config;

  // Scroll state
  const [userScrolled, setUserScrolled] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Refs
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollPositionRef = useRef(0);
  const shouldAutoScrollRef = useRef(shouldAutoScroll);

  // Keep ref in sync with state
  useEffect(() => {
    shouldAutoScrollRef.current = shouldAutoScroll;
  }, [shouldAutoScroll]);

  // Smart scroll detection - detect when user manually scrolls
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const currentScrollPosition = scrollTop;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold

      // Detect if this was a user-initiated scroll
      const scrollDifference = Math.abs(currentScrollPosition - lastScrollPositionRef.current);
      if (scrollDifference > 5) { // Only count significant scroll movements
        const wasUserScroll = !shouldAutoScrollRef.current || scrollDifference > 100;

        if (wasUserScroll) {
          setUserScrolled(!isAtBottom);
          setShouldAutoScroll(isAtBottom);
        }
      }

      lastScrollPositionRef.current = currentScrollPosition;

      // Reset user scroll state after inactivity
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        if (isAtBottom) {
          setUserScrolled(false);
          setShouldAutoScroll(true);
        }
      }, 2000);
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []); // Empty deps - event listener only needs to be registered once

  // Smart auto-scroll for new messages
  useEffect(() => {
    if (displayableMessages.length > 0 && shouldAutoScroll && !userScrolled) {
      const timeoutId = setTimeout(() => {
        if (parentRef.current) {
          const scrollElement = parentRef.current;
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [displayableMessages.length, shouldAutoScroll, userScrolled]);

  // Enhanced streaming scroll - only when user hasn't manually scrolled away
  useEffect(() => {
    if (isLoading && displayableMessages.length > 0 && shouldAutoScroll && !userScrolled) {
      const scrollToBottom = () => {
        if (parentRef.current) {
          const scrollElement = parentRef.current;
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }
      };

      // More frequent updates during streaming for better UX
      const intervalId = setInterval(scrollToBottom, 300);

      return () => clearInterval(intervalId);
    }
  }, [isLoading, displayableMessages.length, shouldAutoScroll, userScrolled]);

  return {
    parentRef,
    userScrolled,
    setUserScrolled,
    setShouldAutoScroll
  };
}
