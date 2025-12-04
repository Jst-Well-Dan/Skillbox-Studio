/**
 * 会话成本计算 Hook
 *
 * 优化：支持多模型定价，符合官方 Claude Code 规范
 * 参考：https://docs.claude.com/en/docs/claude-code/costs
 */

import { useMemo } from 'react';
import { aggregateSessionCost } from '@/lib/sessionCost';
import { formatCost as formatCostUtil, formatDuration } from '@/lib/pricing';
import type { ClaudeStreamMessage } from '@/types/claude';

export interface SessionCostStats {
  /** 总成本（美元） */
  totalCost: number;
  /** 总 tokens */
  totalTokens: number;
  /** 输入 tokens */
  inputTokens: number;
  /** 输出 tokens */
  outputTokens: number;
  /** Cache 读取 tokens */
  cacheReadTokens: number;
  /** Cache 写入 tokens */
  cacheWriteTokens: number;
  /** 会话时长（秒） - wall time */
  durationSeconds: number;
  /** API 执行时长（秒） - 累计所有 API 调用时间 */
  apiDurationSeconds: number;
}

interface SessionCostResult {
  /** 成本统计 */
  stats: SessionCostStats;
  /** 格式化成本字符串 */
  formatCost: (amount: number) => string;
  /** 格式化时长字符串 */
  formatDuration: (seconds: number) => string;
}

/**
 * 计算会话的 Token 成本和统计
 *
 * @param messages - 会话消息列表
 * @returns 成本统计对象
 *
 * @example
 * const { stats, formatCost } = useSessionCostCalculation(messages);
 * console.log(formatCost(stats.totalCost)); // "$0.0123"
 */
export function useSessionCostCalculation(messages: ClaudeStreamMessage[]): SessionCostResult {
  // 计算总成本和统计
  const stats = useMemo(() => {
    if (messages.length === 0) {
      return {
        totalCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        durationSeconds: 0,
        apiDurationSeconds: 0
      };
    }

    const {
      totals,
      events,
      firstEventTimestampMs,
      lastEventTimestampMs,
    } = aggregateSessionCost(messages);

    const durationSeconds = calculateSessionDuration(messages, firstEventTimestampMs, lastEventTimestampMs);

    // 计算 API 执行时长（TODO: 需要从消息中提取实际 API 响应时间）
    // 目前使用简化估算：每条唯一 assistant 消息平均 2-10 秒
    const apiDurationSeconds = events.length * 5; // 粗略估算

    return {
      totalCost: totals.totalCost,
      totalTokens: totals.totalTokens,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      cacheReadTokens: totals.cacheReadTokens,
      cacheWriteTokens: totals.cacheWriteTokens,
      durationSeconds,
      apiDurationSeconds
    };
  }, [messages]);

  return { 
    stats, 
    formatCost: formatCostUtil,
    formatDuration
  };
}

function calculateSessionDuration(
  messages: ClaudeStreamMessage[],
  fallbackFirstEventMs?: number,
  fallbackLastEventMs?: number
): number {
  const timestamps = messages
    .map(extractTimestampMs)
    .filter((value): value is number => typeof value === 'number');

  if (timestamps.length >= 2) {
    const first = Math.min(...timestamps);
    const last = Math.max(...timestamps);
    if (last >= first) {
      return (last - first) / 1000;
    }
  }

  if (
    typeof fallbackFirstEventMs === 'number' &&
    typeof fallbackLastEventMs === 'number' &&
    fallbackLastEventMs >= fallbackFirstEventMs
  ) {
    return (fallbackLastEventMs - fallbackFirstEventMs) / 1000;
  }

  return 0;
}

function extractTimestampMs(message: ClaudeStreamMessage): number | undefined {
  const candidates = [
    (message as any).timestamp,
    (message as any).receivedAt,
    (message as any).sentAt,
    (message as any)?.message?.timestamp,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim() === '') {
      continue;
    }

    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}
