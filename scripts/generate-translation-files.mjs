import fs from 'fs';
import path from 'path';

const localesDir = './apps/portal/src/i18n/locales';
const providerFile = './apps/portal/src/i18n/provider.tsx';

const namespaces = [
  'common', 'dashboard', 'inventory', 'courier', 'warehouse',
  'users', 'reports', 'settings', 'errors', 'notifications',
  'verification', 'scanner', 'accounting'
];

// 1. Create missing locale JSON files
['ar', 'en'].forEach((lang) => {
  const dirPath = path.join(localesDir, lang);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  namespaces.forEach((ns) => {
    const filePath = path.join(dirPath, `${ns}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '{}', 'utf-8');
      console.log(`Created: ${filePath}`);
    }
  });
});

// 2. Read provider.tsx and rewrite it with the updated namespaces and imports
const newProviderContent = `import { createContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Language, DEFAULT_LANGUAGE } from './language';
import { detectLanguage } from './detector';

// Arabic translations
import arCommon from './locales/ar/common.json';
import arDashboard from './locales/ar/dashboard.json';
import arInventory from './locales/ar/inventory.json';
import arCourier from './locales/ar/courier.json';
import arWarehouse from './locales/ar/warehouse.json';
import arUsers from './locales/ar/users.json';
import arReports from './locales/ar/reports.json';
import arSettings from './locales/ar/settings.json';
import arErrors from './locales/ar/errors.json';
import arNotifications from './locales/ar/notifications.json';
import arVerification from './locales/ar/verification.json';
import arScanner from './locales/ar/scanner.json';
import arAccounting from './locales/ar/accounting.json';

// English translations
import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import enInventory from './locales/en/inventory.json';
import enCourier from './locales/en/courier.json';
import enWarehouse from './locales/en/warehouse.json';
import enUsers from './locales/en/users.json';
import enReports from './locales/en/reports.json';
import enSettings from './locales/en/settings.json';
import enErrors from './locales/en/errors.json';
import enNotifications from './locales/en/notifications.json';
import enVerification from './locales/en/verification.json';
import enScanner from './locales/en/scanner.json';
import enAccounting from './locales/en/accounting.json';

const translations = {
  ar: {
    common: arCommon,
    dashboard: arDashboard,
    inventory: arInventory,
    courier: arCourier,
    warehouse: arWarehouse,
    users: arUsers,
    reports: arReports,
    settings: arSettings,
    errors: arErrors,
    notifications: arNotifications,
    verification: arVerification,
    scanner: arScanner,
    accounting: arAccounting
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    inventory: enInventory,
    courier: enCourier,
    warehouse: enWarehouse,
    users: enUsers,
    reports: enReports,
    settings: enSettings,
    errors: enErrors,
    notifications: enNotifications,
    verification: enVerification,
    scanner: enScanner,
    accounting: enAccounting
  }
};

const NAMESPACES = [
  'common', 'dashboard', 'inventory', 'courier', 'warehouse',
  'users', 'reports', 'settings', 'errors', 'notifications',
  'verification', 'scanner', 'accounting'
] as const;

function lookupPath(root: unknown, parts: string[]): string | undefined {
  let current: any = root;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

function translateKey(language: Language, key: string): string {
  const langObj = translations[language] || translations[DEFAULT_LANGUAGE];
  if (!langObj || !key) return key;

  const normalized = key.startsWith('common.') ? key.slice(7) : key;
  const parts = normalized.split('.').filter(Boolean);

  if (parts.length > 1 && (NAMESPACES as readonly string[]).includes(parts[0])) {
    const found = lookupPath(langObj[parts[0] as keyof typeof langObj], parts.slice(1));
    if (found) return found;
  }

  const fromCommon = lookupPath(langObj.common, parts);
  if (fromCommon) return fromCommon;

  for (const ns of NAMESPACES) {
    const found = lookupPath(langObj[ns], parts);
    if (found) return found;
  }

  for (const ns of NAMESPACES) {
    const nsObj = langObj[ns] as Record<string, unknown>;
    if (nsObj && typeof nsObj[normalized] === 'string') {
      return nsObj[normalized] as string;
    }
  }

  return key;
}

export interface LanguageContextType {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: string, fallbacks?: { ar?: string; en?: string }) => string;
  dir: 'rtl' | 'ltr';
  formatNumber: (num: number) => string;
  formatDate: (date: Date | string) => string;
  formatCurrency: (num: number) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => detectLanguage());

  const applyDocumentDirection = useCallback((lang: Language) => {
    if (typeof document === 'undefined') return;
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
    document.body.setAttribute('dir', dir);
    document.body.style.direction = dir;
  }, []);

  const changeLanguage = useCallback((lang: Language) => {
    if (lang !== 'ar' && lang !== 'en') return;

    setLanguageState(lang);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('language', lang);
      } catch (e) {
        console.warn('Failed to save language preference locally:', e);
      }

      applyDocumentDirection(lang);

      const token = localStorage.getItem('auth-token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userId = payload.id;
          if (userId) {
            fetch(\`/api/users/\${userId}\`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${token}\`
              },
              body: JSON.stringify({ preferredLanguage: lang })
            }).catch(err => console.warn('Failed to save language to user DB profile:', err));
          }
        } catch {
          // ignore
        }
      }
    }
  }, [applyDocumentDirection]);

  useEffect(() => {
    applyDocumentDirection(language);
  }, [language, applyDocumentDirection]);

  const t = useCallback((key: string, fallbacks?: { ar?: string; en?: string }): string => {
    const value = translateKey(language, key);
    if (value && value !== key) return value;

    if (fallbacks) {
      return language === 'en'
        ? (fallbacks.en || fallbacks.ar || key)
        : (fallbacks.ar || fallbacks.en || key);
    }

    return key;
  }, [language]);

  const formatNumber = useCallback((num: number): string => {
    if (language === 'ar') {
      const formatted = new Intl.NumberFormat('en-US').format(num);
      const digitMap: { [key: string]: string } = {
        '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
        '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
        ',': '٬', '.': '٫'
      };
      return formatted.split('').map(char => digitMap[char] || char).join('');
    }
    return new Intl.NumberFormat('en-US').format(num);
  }, [language]);

  const formatDate = useCallback((date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  }, [language]);

  const formatCurrency = useCallback((num: number): string => {
    if (language === 'ar') {
      return \`\${formatNumber(num)} ريال\`;
    }
    return \`SAR \${new Intl.NumberFormat('en-US').format(num)}\`;
  }, [language, formatNumber]);

  const value = useMemo<LanguageContextType>(() => ({
    language,
    changeLanguage,
    t,
    dir: language === 'ar' ? 'rtl' : 'ltr',
    formatNumber,
    formatDate,
    formatCurrency
  }), [language, changeLanguage, t, formatNumber, formatDate, formatCurrency]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
`;

fs.writeFileSync(providerFile, newProviderContent, 'utf-8');
console.log('Successfully updated provider.tsx with all namespaces.');
