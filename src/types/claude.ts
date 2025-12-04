// Claude stream message types

// ⭐ AskUserQuestion support types
export interface QuestionOption {
  label: string;
  description: string;
}

export interface UserQuestion {
  question: string;
  header: string;
  multiSelect: boolean;
  options: QuestionOption[];
}

export interface PendingQuestion {
  toolUseId: string;
  questions: UserQuestion[];
}

export interface ClaudeStreamMessage {
  type: "system" | "assistant" | "user" | "result" | "summary" | "queue-operation";
  subtype?: string;
  message?: {
    content?: any[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_tokens?: number;
      cache_read_tokens?: number;
    };
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens?: number;
    cache_read_tokens?: number;
  };
  pendingQuestion?: PendingQuestion;  // ⭐ Attached when AskUserQuestion is detected
  [key: string]: any;
}
