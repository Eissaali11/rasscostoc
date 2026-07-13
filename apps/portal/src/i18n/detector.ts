import { Language, DEFAULT_LANGUAGE } from './language';

export function detectLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  
  try {
    // 1. Check local storage
    const saved = localStorage.getItem('language');
    if (saved === 'ar' || saved === 'en') {
      return saved;
    }
    
    // 2. Check browser languages
    const browserLang = navigator.language;
    if (browserLang) {
      const parsed = browserLang.split('-')[0].toLowerCase();
      if (parsed === 'ar' || parsed === 'en') {
        return parsed as Language;
      }
    }
  } catch (error) {
    console.error('Failed to detect language, falling back to default:', error);
  }
  
  return DEFAULT_LANGUAGE;
}
