export type Language = 'ar' | 'en';

export interface LanguageConfig {
  code: Language;
  label: string;
  dir: 'rtl' | 'ltr';
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' }
];

export const DEFAULT_LANGUAGE: Language = 'ar';
