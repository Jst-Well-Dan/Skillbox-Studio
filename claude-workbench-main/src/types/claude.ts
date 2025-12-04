// Claude stream message types

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
  [key: string]: any;
}
