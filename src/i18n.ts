import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import zh from './locales/zh.json';
import marketplaceEn from '@skillbox-i18n/locales/marketplace.en.json';
import marketplaceZh from '@skillbox-i18n/locales/marketplace.zh.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: en,
                marketplace: marketplaceEn
            },
            zh: {
                translation: zh,
                marketplace: marketplaceZh
            },
        },
        fallbackLng: 'en',
        defaultNS: 'translation',
        debug: true,
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
    });

export default i18n;
