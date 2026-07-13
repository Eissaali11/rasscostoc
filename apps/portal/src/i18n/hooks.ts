import { useContext } from 'react';
import { LanguageContext, translateKey } from './provider';
import { detectLanguage } from './detector';

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return context;
}

// Backward-compatibility alias
export const useLanguage = useTranslation;

// Global t function for static/non-React-context usage
export function t(key: string, options?: any): string {
  let lang = 'ar';
  if (typeof window !== 'undefined') {
    try {
      lang = localStorage.getItem('language') || detectLanguage();
    } catch {
      lang = detectLanguage();
    }
  } else {
    lang = detectLanguage();
  }
  
  let value = translateKey(lang as any, key);
  
  if (!value || value === key) {
    if (options && (options.ar || options.en)) {
      value = lang === 'en'
        ? (options.en || options.ar || key)
        : (options.ar || options.en || key);
    } else {
      value = key;
    }
  }

  if (options && typeof options === 'object') {
    Object.keys(options).forEach(optKey => {
      if (optKey !== 'ar' && optKey !== 'en') {
        const val = options[optKey];
        const formattedVal = String(val);
        value = value.replace(new RegExp(`\\\\{\\\\{\\\\s*${optKey}\\\\s*\\\\}\\\\}`, 'g'), formattedVal);
        value = value.replace(new RegExp(`\\\\{${optKey}\\\\}`, 'g'), formattedVal);
        value = value.replace(new RegExp(`\\{\\{\\s*${optKey}\\s*\\}\\}`, 'g'), formattedVal);
        value = value.replace(new RegExp(`\\{${optKey}\\}`, 'g'), formattedVal);
      }
    });
  }

  return value;
}
