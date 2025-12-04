import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

/**
 * 插件自动翻译Hook
 *
 * 自动将英文插件名称和描述翻译为中文，并缓存结果
 *
 * @param text - 需要翻译的文本（英文）
 * @returns 翻译后的文本（中文），如果翻译失败则返回原文
 *
 * @example
 * ```tsx
 * const translatedName = usePluginTranslation(plugin.name);
 * const translatedDesc = usePluginTranslation(plugin.description);
 *
 * return (
 *   <div>
 *     <h3>{translatedName}</h3>
 *     <p>{translatedDesc}</p>
 *   </div>
 * );
 * ```
 */
export function usePluginTranslation(text: string | undefined): string {
  const [translatedText, setTranslatedText] = useState<string>(text || '');

  useEffect(() => {
    // 如果没有文本，直接返回
    if (!text || text.trim().length === 0) {
      setTranslatedText('');
      return;
    }

    // 如果文本很短（<=3个字符），可能是缩写，不翻译
    if (text.trim().length <= 3) {
      setTranslatedText(text);
      return;
    }

    // 如果不包含英文字母，不翻译
    if (!/[a-zA-Z]/.test(text)) {
      setTranslatedText(text);
      return;
    }

    // 检查是否已经翻译过（使用sessionStorage缓存）
    const cacheKey = `plugin_translation_${text}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      setTranslatedText(cached);
      return;
    }

    // 开始翻译
    const translateText = async () => {
      try {
        // 调用翻译API
        const translated = await api.translateText(text, 'zh');

        // 保存到sessionStorage缓存
        sessionStorage.setItem(cacheKey, translated);

        setTranslatedText(translated);
      } catch (error) {
        console.warn('[PluginTranslation] Translation failed:', error);
        // 翻译失败时使用原文
        setTranslatedText(text);
      }
    };

    translateText();
  }, [text]);

  // 如果正在翻译且没有缓存，显示原文（避免闪烁）
  return translatedText || text || '';
}

/**
 * 批量翻译插件数据
 *
 * @param plugins - 插件数组
 * @returns 翻译后的插件数组
 */
export async function translatePlugins<T extends { name?: string; displayName?: string; description?: string }>(
  plugins: T[]
): Promise<T[]> {
  if (plugins.length === 0) {
    return plugins;
  }

  try {
    // 收集所有需要翻译的文本
    const textsToTranslate: string[] = [];
    const textIndices: Array<{ index: number; field: 'name' | 'displayName' | 'description' }> = [];

    // 首先应用所有已缓存的翻译
    const translatedPlugins = plugins.map((plugin, index) => {
      const result = { ...plugin };

      // 检查 displayName (优先)
      if (plugin.displayName && /[a-zA-Z]/.test(plugin.displayName) && plugin.displayName.length > 3) {
        const cacheKey = `plugin_translation_${plugin.displayName}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) {
          result.displayName = cached;
        } else {
          textsToTranslate.push(plugin.displayName);
          textIndices.push({ index, field: 'displayName' });
        }
      }
      // 检查 name (如果没有 displayName)
      else if (plugin.name && /[a-zA-Z]/.test(plugin.name) && plugin.name.length > 3) {
        const cacheKey = `plugin_translation_${plugin.name}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) {
          result.name = cached;
        } else {
          textsToTranslate.push(plugin.name);
          textIndices.push({ index, field: 'name' });
        }
      }

      // 检查描述
      if (plugin.description && /[a-zA-Z]/.test(plugin.description)) {
        const cacheKey = `plugin_translation_${plugin.description}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) {
          result.description = cached;
        } else {
          textsToTranslate.push(plugin.description);
          textIndices.push({ index, field: 'description' });
        }
      }

      return result;
    });

    // 如果没有需要翻译的内容（全部使用缓存），返回已应用缓存的数据
    if (textsToTranslate.length === 0) {
      return translatedPlugins;
    }

    // 批量翻译未缓存的内容
    const translations = await api.translateBatch(textsToTranslate, 'zh');

    // 应用新翻译的结果并缓存
    translations.forEach((translation, i) => {
      const { index, field } = textIndices[i];
      const originalText = textsToTranslate[i];

      // 保存到缓存
      const cacheKey = `plugin_translation_${originalText}`;
      sessionStorage.setItem(cacheKey, translation);

      // 应用翻译到已有的结果对象
      translatedPlugins[index] = {
        ...translatedPlugins[index],
        [field]: translation
      };
    });

    return translatedPlugins;
  } catch (error) {
    console.warn('[PluginTranslation] Batch translation failed:', error);
    // 翻译失败时返回原数据
    return plugins;
  }
}
