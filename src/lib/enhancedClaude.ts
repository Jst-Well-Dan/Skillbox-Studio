/**
 * Enhanced Claude Service - Integrating SDK, Cache, and Error Handling
 *
 * This service combines all Priority 1 optimizations:
 * 1. Direct TypeScript SDK integration
 * 2. Intelligent prompt caching
 * 3. Enhanced error handling with SDK native error types
 */

import { claudeSDK, ClaudeMessage, ClaudeResponse } from './claudeSDK';
import { promptCache, CacheStats } from './promptCache';
import { errorHandler, ClaudeError, withErrorHandling } from './errorHandling';
import { api } from './api';

export interface EnhancedClaudeOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  useCache?: boolean;
  cacheOnlyOnSuccess?: boolean;
  enableAutoRetry?: boolean;
  retryOptions?: {
    maxRetries?: number;
    baseDelay?: number;
  };
  sessionId?: string;
  projectPath?: string;
}

export interface StreamingOptions extends EnhancedClaudeOptions {
  onContent?: (content: string) => void;
  onUsage?: (usage: { input_tokens: number; output_tokens: number; cache_read_tokens?: number }) => void;
  onComplete?: (response: ClaudeResponse) => void;
  onError?: (error: ClaudeError) => void;
}

export interface ServiceStats {
  requests: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
  };
  performance: {
    averageResponseTime: number;
    totalTokensProcessed: number;
    totalTokensSaved: number;
    cacheHitRate: number;
  };
  cache: CacheStats;
}

export class EnhancedClaudeService {
  private requestCount = 0;
  private successCount = 0;
  private failCount = 0;
  private cachedCount = 0;
  private totalResponseTime = 0;
  private totalTokensProcessed = 0;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    try {
      await claudeSDK.initialize();
      console.log('[EnhancedClaude] Service initialized successfully');
    } catch (error) {
      console.warn('[EnhancedClaude] Service initialization failed:', error);
    }
  }

  /**
   * Send a message with all enhancements
   */
  async sendMessage(
    messages: ClaudeMessage[],
    options: EnhancedClaudeOptions = {}
  ): Promise<ClaudeResponse> {
    const startTime = performance.now();
    this.requestCount++;

    const {
      model = 'claude-3-5-sonnet-20241022',
      temperature = 0.7,
      maxTokens = 4000,
      systemPrompt,
      useCache = true,
      cacheOnlyOnSuccess = true,
      enableAutoRetry = true,
      retryOptions = {},
      sessionId,
      projectPath,
    } = options;

    const context = {
      operation: 'sendMessage',
      model,
      sessionId,
      projectPath,
    };

    try {
      // Try to get from cache first
      if (useCache) {
        const cached = await promptCache.get(messages, model, temperature, systemPrompt);
        if (cached) {
          this.cachedCount++;
          this.successCount++;

          const responseTime = performance.now() - startTime;
          this.totalResponseTime += responseTime;

          console.log(`[EnhancedClaude] Cache HIT - Response time: ${responseTime.toFixed(2)}ms`);

          // Update auto-compact if session is provided
          if (sessionId && cached.usage) {
            try {
              await api.updateSessionContext(sessionId, cached.usage.input_tokens + cached.usage.output_tokens);
            } catch (error) {
              console.warn('[EnhancedClaude] Failed to update session context:', error);
            }
          }

          return cached.response;
        }
      }

      // Define the operation to retry
      const operation = async (): Promise<ClaudeResponse> => {
        return await claudeSDK.sendMessage(messages, {
          model,
          temperature,
          maxTokens,
          systemPrompt,
        });
      };

      // Execute with retry if enabled
      let response: ClaudeResponse;
      if (enableAutoRetry) {
        response = await errorHandler.retryWithBackoff(
          operation,
          retryOptions.maxRetries || 3,
          retryOptions.baseDelay || 1000
        );
      } else {
        response = await operation();
      }

      // Cache successful response
      if (useCache && (!cacheOnlyOnSuccess || response)) {
        await promptCache.set(messages, response, model, temperature, maxTokens, systemPrompt);
      }

      // Update statistics
      this.successCount++;
      this.totalTokensProcessed += response.usage.input_tokens + response.usage.output_tokens;

      const responseTime = performance.now() - startTime;
      this.totalResponseTime += responseTime;

      console.log(`[EnhancedClaude] Request completed - Response time: ${responseTime.toFixed(2)}ms, Tokens: ${response.usage.input_tokens + response.usage.output_tokens}`);

      // Update auto-compact if session is provided
      if (sessionId) {
        try {
          await api.updateSessionContext(sessionId, response.usage.input_tokens + response.usage.output_tokens);
        } catch (error) {
          console.warn('[EnhancedClaude] Failed to update session context:', error);
        }
      }

      return response;

    } catch (error) {
      this.failCount++;

      const responseTime = performance.now() - startTime;
      this.totalResponseTime += responseTime;

      throw errorHandler.handleError(error, context);
    }
  }

  /**
   * Send a message with streaming response
   */
  async *sendMessageStream(
    messages: ClaudeMessage[],
    options: StreamingOptions = {}
  ): AsyncGenerator<{ type: 'content' | 'usage' | 'done' | 'cached'; content?: string; usage?: any; response?: ClaudeResponse }, void, unknown> {
    const startTime = performance.now();
    this.requestCount++;

    const {
      model = 'claude-3-5-sonnet-20241022',
      temperature = 0.7,
      maxTokens = 4000,
      systemPrompt,
      useCache = true,
      onContent,
      onUsage,
      onComplete,
      onError,
      sessionId,
      projectPath,
    } = options;

    const context = {
      operation: 'sendMessageStream',
      model,
      sessionId,
      projectPath,
    };

    try {
      // Try to get from cache first
      if (useCache) {
        const cached = await promptCache.get(messages, model, temperature, systemPrompt);
        if (cached) {
          this.cachedCount++;
          this.successCount++;

          const responseTime = performance.now() - startTime;
          this.totalResponseTime += responseTime;

          console.log(`[EnhancedClaude] Cache HIT (Streaming) - Response time: ${responseTime.toFixed(2)}ms`);

          // Simulate streaming from cache
          const content = cached.response.content;
          const chunkSize = 10; // Characters per chunk

          for (let i = 0; i < content.length; i += chunkSize) {
            const chunk = content.slice(i, i + chunkSize);

            if (onContent) onContent(chunk);
            yield { type: 'content', content: chunk };

            // Add small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          if (onUsage) onUsage(cached.usage);
          yield { type: 'usage', usage: cached.usage };

          if (onComplete) onComplete(cached.response);
          yield { type: 'cached', response: cached.response };

          // Update auto-compact if session is provided
          if (sessionId && cached.usage) {
            try {
              await api.updateSessionContext(sessionId, cached.usage.input_tokens + cached.usage.output_tokens);
            } catch (error) {
              console.warn('[EnhancedClaude] Failed to update session context:', error);
            }
          }

          return;
        }
      }

      // Stream from SDK
      let fullResponse: ClaudeResponse | null = null;

      for await (const chunk of claudeSDK.sendMessageStream(messages, {
        model,
        temperature,
        maxTokens,
        systemPrompt,
        onTokenUsage: (usage) => {
          if (onUsage) onUsage(usage);
        },
      })) {
        if (chunk.type === 'content' && chunk.content) {
          if (onContent) onContent(chunk.content);
        }

        if (chunk.type === 'done' && chunk.response) {
          fullResponse = chunk.response;
          if (onComplete) onComplete(chunk.response);

          // Cache successful response
          if (useCache) {
            await promptCache.set(messages, chunk.response, model, temperature, maxTokens, systemPrompt);
          }
        }

        yield chunk;
      }

      // Update statistics
      this.successCount++;
      if (fullResponse) {
        this.totalTokensProcessed += fullResponse.usage.input_tokens + fullResponse.usage.output_tokens;

        // Update auto-compact if session is provided
        if (sessionId) {
          try {
            await api.updateSessionContext(sessionId, fullResponse.usage.input_tokens + fullResponse.usage.output_tokens);
          } catch (error) {
            console.warn('[EnhancedClaude] Failed to update session context:', error);
          }
        }
      }

      const responseTime = performance.now() - startTime;
      this.totalResponseTime += responseTime;

      console.log(`[EnhancedClaude] Streaming completed - Response time: ${responseTime.toFixed(2)}ms`);

    } catch (error) {
      this.failCount++;

      const responseTime = performance.now() - startTime;
      this.totalResponseTime += responseTime;

      const claudeError = errorHandler.handleError(error, context);
      if (onError) onError(claudeError);
      throw claudeError;
    }
  }

  /**
   * Test connection with enhanced error handling
   */
  async testConnection(): Promise<{ success: boolean; error?: ClaudeError; model?: string; responseTime?: number }> {
    const startTime = performance.now();

    try {
      const result = await claudeSDK.testConnection();
      const responseTime = performance.now() - startTime;

      return {
        success: result.success,
        model: result.model,
        responseTime,
        error: result.error ? errorHandler.handleError(new Error(result.error)) : undefined,
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        success: false,
        error: errorHandler.handleError(error, { operation: 'testConnection' }),
        responseTime,
      };
    }
  }

  /**
   * Get comprehensive service statistics
   */
  getStats(): ServiceStats {
    const cacheStats = promptCache.getStats();

    return {
      requests: {
        total: this.requestCount,
        successful: this.successCount,
        failed: this.failCount,
        cached: this.cachedCount,
      },
      performance: {
        averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
        totalTokensProcessed: this.totalTokensProcessed,
        totalTokensSaved: cacheStats.totalTokensSaved,
        cacheHitRate: cacheStats.hitRate,
      },
      cache: cacheStats,
    };
  }

  /**
   * Clear cache and reset stats
   */
  reset(): void {
    promptCache.clear();
    this.requestCount = 0;
    this.successCount = 0;
    this.failCount = 0;
    this.cachedCount = 0;
    this.totalResponseTime = 0;
    this.totalTokensProcessed = 0;
  }

  /**
   * Update cache configuration
   */
  updateCacheConfig(config: any): void {
    promptCache.updateConfig(config);
  }

  /**
   * Get cache analytics
   */
  getCacheAnalytics() {
    return promptCache.getAnalytics();
  }

  /**
   * Get popular cached patterns
   */
  getPopularPatterns(limit: number = 10) {
    return promptCache.getPopularPatterns(limit);
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return claudeSDK.isReady();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    claudeSDK.cleanup();
  }
}

// Export singleton instance
export const enhancedClaude = new EnhancedClaudeService();

// Convenience functions
export const sendMessage = withErrorHandling(
  (messages: ClaudeMessage[], options?: EnhancedClaudeOptions) =>
    enhancedClaude.sendMessage(messages, options)
);

export const sendMessageStream = (messages: ClaudeMessage[], options?: StreamingOptions) =>
  enhancedClaude.sendMessageStream(messages, options);

export const testConnection = () => enhancedClaude.testConnection();