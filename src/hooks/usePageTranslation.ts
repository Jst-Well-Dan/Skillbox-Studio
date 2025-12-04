import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

/**
 * Translation item stored in the Map
 */
interface TranslationItem {
  originalText: string;
  translatedText: string | null;
}

/**
 * Page-level translation hook
 *
 * Manages translation state for all items on a page with batch translation support.
 * Uses Map for O(1) lookups and efficient updates.
 *
 * @example
 * ```tsx
 * const { isTranslated, isTranslating, registerItem, toggleTranslation, getDisplayText } = usePageTranslation();
 *
 * // Register content for translation
 * useEffect(() => {
 *   registerItem('message-123', 'Hello world');
 * }, [registerItem]);
 *
 * // Get display text (original or translated)
 * const displayText = getDisplayText('message-123');
 *
 * // Toggle translation
 * <TranslationBadge
 *   isTranslated={isTranslated}
 *   isTranslating={isTranslating}
 *   onToggle={toggleTranslation}
 * />
 * ```
 */
export function usePageTranslation() {
  const [items, setItems] = useState<Map<string, TranslationItem>>(new Map());
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Keep track of registered item IDs to prevent duplicate registrations
  const registeredIds = useRef<Set<string>>(new Set());

  /**
   * Register an item for translation
   *
   * @param id - Unique identifier for the item
   * @param text - Original text to translate
   */
  const registerItem = useCallback((id: string, text: string) => {
    // Skip if already registered
    if (registeredIds.current.has(id)) {
      return;
    }

    registeredIds.current.add(id);

    setItems((prevItems) => {
      const newItems = new Map(prevItems);
      newItems.set(id, {
        originalText: text,
        translatedText: null,
      });
      return newItems;
    });
  }, []);

  /**
   * Batch translate all registered items
   */
  const translateAll = useCallback(async () => {
    if (items.size === 0) {
      console.warn('No items to translate');
      return;
    }

    setIsTranslating(true);

    try {
      // Collect texts to translate
      const textsToTranslate: string[] = [];
      const itemIds: string[] = [];

      items.forEach((item, id) => {
        // Only translate if not already translated
        if (!item.translatedText) {
          textsToTranslate.push(item.originalText);
          itemIds.push(id);
        }
      });

      if (textsToTranslate.length === 0) {
        console.log('All items already translated');
        setIsTranslated(true);
        return;
      }

      console.log(`Translating ${textsToTranslate.length} items...`);

      // Call batch translate API
      const translatedTexts = await api.translateBatch(textsToTranslate, 'zh');

      // Update items with translations
      setItems((prevItems) => {
        const newItems = new Map(prevItems);

        itemIds.forEach((id, index) => {
          const item = newItems.get(id);
          if (item) {
            newItems.set(id, {
              ...item,
              translatedText: translatedTexts[index],
            });
          }
        });

        return newItems;
      });

      setIsTranslated(true);
      console.log(`Translation complete: ${translatedTexts.length} items`);
    } catch (error) {
      console.error('Translation failed:', error);
      // On error, still mark as "translated" to show original text
      setIsTranslated(true);
    } finally {
      setIsTranslating(false);
    }
  }, [items]);

  /**
   * Toggle between original and translated text
   */
  const toggleTranslation = useCallback(() => {
    if (isTranslating) {
      return; // Don't toggle while translating
    }

    if (isTranslated) {
      // Switch back to original
      setIsTranslated(false);
    } else {
      // Translate all items
      translateAll();
    }
  }, [isTranslated, isTranslating, translateAll]);

  /**
   * Get display text for an item (original or translated based on state)
   *
   * @param id - Item identifier
   * @returns The text to display, or null if item not found
   */
  const getDisplayText = useCallback(
    (id: string): string | null => {
      const item = items.get(id);
      if (!item) {
        return null;
      }

      // Return translated text if available and translated state is active
      if (isTranslated && item.translatedText) {
        return item.translatedText;
      }

      // Otherwise return original text
      return item.originalText;
    },
    [items, isTranslated]
  );

  /**
   * Clear all registered items (useful for cleanup)
   */
  const clearItems = useCallback(() => {
    setItems(new Map());
    registeredIds.current.clear();
    setIsTranslated(false);
    setIsTranslating(false);
  }, []);

  return {
    isTranslated,
    isTranslating,
    registerItem,
    translateAll,
    toggleTranslation,
    getDisplayText,
    clearItems,
  };
}
