/**
 * 消息过滤模块 - 统一消息过滤逻辑
 *
 * 将 ClaudeCodeSession 中分散的消息过滤规则集中管理
 * 提供可配置的过滤选项，易于测试和维护
 */

import type { ClaudeStreamMessage } from '@/types/claude';

/**
 * 过滤选项配置
 */
export interface FilterOptions {
  /** 是否隐藏 meta 消息（没有 leafUuid 和 summary 的消息） */
  hideMeta?: boolean;

  /** 是否隐藏空内容的用户消息 */
  hideEmptyUser?: boolean;

  /** 是否去重工具结果（避免显示已有 widget 的工具结果） */
  deduplicateToolResults?: boolean;

  /** 已经有 widget 的工具列表（用于去重） */
  toolsWithWidgets?: string[];

  /** 自定义过滤函数 */
  customFilter?: (message: ClaudeStreamMessage) => boolean;
}

/**
 * 检查消息是否为 meta 消息
 */
export function isMeta(message: ClaudeStreamMessage): boolean {
  return !!(message as any).isMeta;
}

/**
 * 检查消息是否有 leafUuid
 */
export function hasLeafUuid(message: ClaudeStreamMessage): boolean {
  return !!(message as any).leafUuid;
}

/**
 * 检查消息是否有 summary
 */
export function hasSummary(message: ClaudeStreamMessage): boolean {
  return !!(message as any).summary;
}

/**
 * 检查用户消息是否为空
 */
export function isEmptyUserMessage(message: ClaudeStreamMessage): boolean {
  if (message.type !== 'user') {
    return false;
  }

  const content = message.message?.content;

  // 没有内容
  if (!content) {
    return true;
  }

  // 数组内容为空
  if (Array.isArray(content)) {
    return content.length === 0;
  }

  // 字符串内容为空或只有空白字符
  if (typeof content === 'string') {
    const strContent = content as string;
    return strContent.trim() === '';
  }

  return false;
}

/**
 * 检查消息是否为工具结果
 */
export function isToolResultMessage(message: ClaudeStreamMessage): boolean {
  if (message.type !== 'user') {
    return false;
  }

  const content = message.message?.content;
  if (!Array.isArray(content)) {
    return false;
  }

  // 检查是否包含 tool_result 类型的内容
  return content.some((item: any) => item.type === 'tool_result');
}

/**
 * 从消息中提取工具结果的 tool_use_id 列表
 */
export function extractToolUseIds(message: ClaudeStreamMessage): string[] {
  if (!isToolResultMessage(message)) {
    return [];
  }

  const content = message.message?.content as any[];
  return content
    .filter((item: any) => item.type === 'tool_result' && item.tool_use_id)
    .map((item: any) => item.tool_use_id);
}

/**
 * 检查工具结果是否应该被去重
 * @param message 消息对象
 * @param toolsWithWidgets 已经有 widget 的工具 ID 列表
 */
export function shouldDeduplicateToolResult(message: ClaudeStreamMessage, toolsWithWidgets: string[]): boolean {
  if (!isToolResultMessage(message)) {
    return false;
  }

  const toolUseIds = extractToolUseIds(message);

  // 如果消息中的所有工具结果都已经有 widget，则去重
  return toolUseIds.length > 0 && toolUseIds.every(id => toolsWithWidgets.includes(id));
}

/**
 * 过滤可显示的消息
 * @param messages 原始消息列表
 * @param options 过滤选项
 * @returns 过滤后的消息列表
 */
export function filterDisplayableMessages(
  messages: ClaudeStreamMessage[],
  options: FilterOptions = {}
): ClaudeStreamMessage[] {
  const {
    hideMeta = true,
    hideEmptyUser = true,
    deduplicateToolResults = true,
    toolsWithWidgets = [],
    customFilter,
  } = options;

  return messages.filter(message => {
    // 1. 过滤 meta 消息（没有 leafUuid 和 summary）
    if (hideMeta && isMeta(message) && !hasLeafUuid(message) && !hasSummary(message)) {
      return false;
    }

    // 2. 过滤空内容的用户消息
    if (hideEmptyUser && isEmptyUserMessage(message)) {
      return false;
    }

    // 3. 去重工具结果消息
    if (deduplicateToolResults && shouldDeduplicateToolResult(message, toolsWithWidgets)) {
      return false;
    }

    // 4. 自定义过滤函数
    if (customFilter && !customFilter(message)) {
      return false;
    }

    return true;
  });
}

/**
 * 从消息列表中提取所有带 widget 的工具 ID
 * （用于工具结果去重）
 */
export function extractToolsWithWidgets(messages: ClaudeStreamMessage[]): string[] {
  const toolIds: string[] = [];

  messages.forEach(message => {
    if (message.type !== 'assistant') {
      return;
    }

    const content = message.message?.content;
    if (!Array.isArray(content)) {
      return;
    }

    content.forEach((item: any) => {
      if (item.type === 'tool_use' && item.id) {
        toolIds.push(item.id);
      }
    });
  });

  return toolIds;
}

/**
 * 智能过滤管道（自动提取 toolsWithWidgets）
 * @param messages 原始消息列表
 * @param options 过滤选项（会自动补充 toolsWithWidgets）
 * @returns 过滤后的消息列表
 */
export function smartFilterMessages(
  messages: ClaudeStreamMessage[],
  options: Omit<FilterOptions, 'toolsWithWidgets'> = {}
): ClaudeStreamMessage[] {
  // 自动提取已有 widget 的工具列表
  const toolsWithWidgets = extractToolsWithWidgets(messages);

  return filterDisplayableMessages(messages, {
    ...options,
    toolsWithWidgets,
  });
}

/**
 * 过滤统计信息
 */
export interface FilterStats {
  /** 原始消息数量 */
  total: number;

  /** 过滤后的消息数量 */
  displayed: number;

  /** 被过滤的消息数量 */
  filtered: number;

  /** 按类型分组的过滤数量 */
  filteredByType: {
    meta: number;
    emptyUser: number;
    duplicateToolResult: number;
    custom: number;
  };
}

/**
 * 获取过滤统计信息
 */
export function getFilterStats(
  messages: ClaudeStreamMessage[],
  displayedMessages: ClaudeStreamMessage[],
  options: FilterOptions = {}
): FilterStats {
  const {
    hideMeta = true,
    hideEmptyUser = true,
    deduplicateToolResults = true,
    toolsWithWidgets = [],
    customFilter,
  } = options;

  const stats: FilterStats = {
    total: messages.length,
    displayed: displayedMessages.length,
    filtered: messages.length - displayedMessages.length,
    filteredByType: {
      meta: 0,
      emptyUser: 0,
      duplicateToolResult: 0,
      custom: 0,
    },
  };

  messages.forEach(message => {
    const isDisplayed = displayedMessages.includes(message);
    if (isDisplayed) {
      return;
    }

    // 统计过滤原因
    if (hideMeta && isMeta(message) && !hasLeafUuid(message) && !hasSummary(message)) {
      stats.filteredByType.meta++;
    } else if (hideEmptyUser && isEmptyUserMessage(message)) {
      stats.filteredByType.emptyUser++;
    } else if (deduplicateToolResults && shouldDeduplicateToolResult(message, toolsWithWidgets)) {
      stats.filteredByType.duplicateToolResult++;
    } else if (customFilter && !customFilter(message)) {
      stats.filteredByType.custom++;
    }
  });

  return stats;
}
