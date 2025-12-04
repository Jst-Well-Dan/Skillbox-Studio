import React, { createContext, useContext } from 'react';

/**
 * Translation Context for sharing translation state across components
 */
interface TranslationContextType {
  isTranslated: boolean;
  getDisplayText: (id: string) => string | null;
  registerItem: (id: string, text: string) => void;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export const TranslationProvider: React.FC<{
  value: TranslationContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    // Return no-op functions if not in translation context
    return {
      isTranslated: false,
      getDisplayText: () => null,
      registerItem: () => {},
    };
  }
  return context;
};
