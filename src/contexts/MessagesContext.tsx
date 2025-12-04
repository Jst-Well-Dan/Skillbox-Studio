import React from "react";
import type { ClaudeStreamMessage } from "@/types/claude";

export interface ToolResultEntry {
  toolUseId: string;
  content?: any;
  isError?: boolean;
  sourceMessage?: ClaudeStreamMessage;
}

export interface MessageFilterConfig {
  hideWarmupMessages: boolean;
}

interface MessagesContextValue {
  messages: ClaudeStreamMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ClaudeStreamMessage[]>>;
  isStreaming: boolean;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  filterConfig: MessageFilterConfig;
  setFilterConfig: React.Dispatch<React.SetStateAction<MessageFilterConfig>>;
  toolResults: Map<string, ToolResultEntry>;
}

const MessagesContext = React.createContext<MessagesContextValue | undefined>(undefined);

const buildToolResultMap = (messages: ClaudeStreamMessage[]): Map<string, ToolResultEntry> => {
  const results = new Map<string, ToolResultEntry>();

  messages.forEach((msg) => {
    const content = msg.message?.content;

    if (Array.isArray(content)) {
      content.forEach((item: any) => {
        if (item && item.type === "tool_result" && item.tool_use_id) {
          results.set(item.tool_use_id, {
            toolUseId: item.tool_use_id,
            content: item.content ?? item.result ?? item,
            isError: Boolean(item.is_error),
            sourceMessage: msg,
          });
        }
      });
    }
  });

  return results;
};

interface MessagesProviderProps {
  initialMessages?: ClaudeStreamMessage[];
  initialIsStreaming?: boolean;
  initialFilterConfig?: Partial<MessageFilterConfig>;
  children: React.ReactNode;
}

const defaultFilterConfig: MessageFilterConfig = {
  hideWarmupMessages: true,
};

export const MessagesProvider: React.FC<MessagesProviderProps> = ({
  initialMessages = [],
  initialIsStreaming = false,
  initialFilterConfig,
  children,
}) => {
  const [messages, setMessages] = React.useState<ClaudeStreamMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = React.useState<boolean>(initialIsStreaming);
  const [filterConfig, setFilterConfig] = React.useState<MessageFilterConfig>({
    hideWarmupMessages:
      initialFilterConfig?.hideWarmupMessages !== undefined
        ? initialFilterConfig.hideWarmupMessages
        : defaultFilterConfig.hideWarmupMessages,
  });

  const toolResults = React.useMemo(() => buildToolResultMap(messages), [messages]);

  const contextValue = React.useMemo<MessagesContextValue>(
    () => ({
      messages,
      setMessages,
      isStreaming,
      setIsStreaming,
      filterConfig,
      setFilterConfig,
      toolResults,
    }),
    [messages, isStreaming, filterConfig, toolResults]
  );

  return <MessagesContext.Provider value={contextValue}>{children}</MessagesContext.Provider>;
};

export const useMessagesContext = (): MessagesContextValue => {
  const context = React.useContext(MessagesContext);
  if (!context) {
    throw new Error("useMessagesContext must be used within a MessagesProvider");
  }
  return context;
};

MessagesProvider.displayName = "MessagesProvider";


