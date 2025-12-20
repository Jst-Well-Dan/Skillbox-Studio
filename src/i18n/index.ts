import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import language resources
import zh from './locales/zh.json';

const resources = {
  zh: {
    translation: zh
  }
};

// 固定使用中文，不再支持语言切换
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh', // 固定中文
    fallbackLng: 'zh',
    debug: false,

    interpolation: {
      escapeValue: false, // React already does escaping
    },
  });

export default i18n;
