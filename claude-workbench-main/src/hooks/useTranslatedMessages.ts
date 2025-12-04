import { useCallback } from 'react';
import { translationMiddleware } from '@/lib/translationMiddleware';

/**
 * Hook for translating UI messages, error messages, and toast notifications
 */
export const useTranslatedMessages = () => {
  /**
   * Translate a single message (async)
   */
  const translateMessage = useCallback(async (message: string): Promise<string> => {
    return await translationMiddleware.translateErrorMessage(message);
  }, []);

  /**
   * Translate multiple messages (async)
   */
  const translateMessages = useCallback(async (messages: string[]): Promise<string[]> => {
    return await translationMiddleware.translateErrorMessages(messages);
  }, []);

  /**
   * Translate a message synchronously by returning a promise that resolves to the translated message
   * Useful for toast notifications where you need immediate feedback
   */
  const translateForToast = useCallback((message: string): Promise<string> => {
    return translationMiddleware.translateErrorMessage(message);
  }, []);

  /**
   * Translate and set error state
   */
  const translateAndSetError = useCallback(async (
    message: string,
    setError: (error: string) => void
  ): Promise<void> => {
    const translated = await translateMessage(message);
    setError(translated);
  }, [translateMessage]);

  return {
    translateMessage,
    translateMessages,
    translateForToast,
    translateAndSetError,
  };
};

/**
 * Utility function to wrap existing setError calls
 */
export const withTranslatedError = async (message: string, setError: (error: string) => void) => {
  const translated = await translationMiddleware.translateErrorMessage(message);
  setError(translated);
};

/**
 * Generic utility for toast messages - accepts any toast type
 */
export const withTranslatedToast = async <T extends { message: string }>(
  toast: T,
  setToast: (toast: T) => void
): Promise<void> => {
  const translatedMessage = await translationMiddleware.translateErrorMessage(toast.message);
  setToast({ ...toast, message: translatedMessage });
};