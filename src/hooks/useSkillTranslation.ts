import skillTranslations from '@/i18n/locales/skill-translations.json';

/**
 * 获取分类的中文翻译
 * @param category 英文分类名
 * @returns 中文分类名，如果没有预翻译则返回原文
 */
export function getTranslatedCategory(category: string): string {
  const categories = skillTranslations.categories as Record<string, string>;
  return categories[category] || category;
}

/**
 * 获取技能显示名称的中文翻译
 * @param skillName 技能名称（如 "advanced-video-downloader"）
 * @returns 中文显示名称，如果没有预翻译则返回 undefined
 */
export function getTranslatedDisplayName(skillName: string): string | undefined {
  const skills = skillTranslations.skills as Record<string, { displayName?: string; description: string }>;
  return skills[skillName]?.displayName;
}

/**
 * 获取技能描述的中文翻译
 * @param skillName 技能名称（如 "advanced-video-downloader"）
 * @returns 中文描述，如果没有预翻译则返回 undefined
 */
export function getTranslatedDescription(skillName: string): string | undefined {
  const skills = skillTranslations.skills as Record<string, { displayName?: string; description: string }>;
  return skills[skillName]?.description;
}

/**
 * 检查是否有预翻译
 * @param skillName 技能名称
 * @returns 是否存在预翻译
 */
export function hasPreTranslation(skillName: string): boolean {
  const skills = skillTranslations.skills as Record<string, { displayName?: string; description: string }>;
  return skillName in skills;
}

/**
 * 批量应用预翻译到插件数据
 * 优先使用预翻译，不会调用 API
 *
 * @param plugins 插件数组
 * @param language 目标语言 ('zh' | 'en')
 * @returns 翻译后的插件数组
 */
export function applyPreTranslations<T extends {
  name?: string;
  displayName?: string;
  description?: string;
  category?: string;
}>(plugins: T[], language: 'zh' | 'en'): T[] {
  // 如果是英文模式，直接返回原数据
  if (language === 'en') {
    return plugins;
  }

  return plugins.map(plugin => {
    const result = { ...plugin };

    // 尝试获取技能名称（优先使用 name，displayName 可能已被翻译或修改）
    const skillName = plugin.name || plugin.displayName || '';

    // 翻译分类
    if (plugin.category) {
      result.category = getTranslatedCategory(plugin.category);
    }

    // 翻译显示名称（仅当有预翻译时）
    if (skillName) {
      const translatedName = getTranslatedDisplayName(skillName);
      if (translatedName) {
        result.displayName = translatedName;
      }
    }

    // 翻译描述（仅当有预翻译时）
    if (skillName && plugin.description) {
      const translatedDesc = getTranslatedDescription(skillName);
      if (translatedDesc) {
        result.description = translatedDesc;
      }
    }

    return result;
  });
}

/**
 * 获取所有已翻译的技能名称列表
 */
export function getPreTranslatedSkillNames(): string[] {
  return Object.keys(skillTranslations.skills);
}

/**
 * 获取所有已翻译的分类列表
 */
export function getPreTranslatedCategories(): Array<{ key: string; label: string }> {
  const categories = skillTranslations.categories as Record<string, string>;
  return Object.entries(categories).map(([key, label]) => ({ key, label }));
}
