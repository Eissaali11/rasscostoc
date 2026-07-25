import React from 'react';
import { Cpu, Radio, Package, Smartphone, HardDrive } from 'lucide-react';

interface ItemProductAvatarProps {
  itemTypeKey: string;
  size?: 'sm' | 'md' | 'lg';
  showCategoryPill?: boolean;
}

export interface ItemMeta {
  name: string;
  categoryName: string;
  category: 'devices' | 'sim' | 'accessories';
  manufacturer: string;
  barcodeFormat: string;
  iconType: 'pos' | 'sim' | 'box';
  themeColor: string;
  bgGradient: string;
  badgeBg: string;
}

export const getItemMetadata = (itemTypeKey: string): ItemMeta => {
  const key = (itemTypeKey || '').trim();
  const upper = key.toUpperCase();
  const lower = key.toLowerCase();

  if (upper.includes('A960')) {
    return {
      name: 'جهاز POS — PAX A960 Smart',
      categoryName: 'أجهزة نقاط البيع (Android)',
      category: 'devices',
      manufacturer: 'PAX Technology',
      barcodeFormat: 'سيريال الجهاز (SN)',
      iconType: 'pos',
      themeColor: '#0F5EA8',
      bgGradient: 'from-blue-600 to-indigo-700',
      badgeBg: 'bg-blue-50 text-[#0F5EA8] border-blue-200',
    };
  }

  if (lower.includes('verifone') || lower.includes('vx680')) {
    return {
      name: 'جهاز POS — Verifone VX680',
      categoryName: 'أجهزة نقاط البيع المحمولة',
      category: 'devices',
      manufacturer: 'Verifone Systems',
      barcodeFormat: 'سيريال الجهاز (S/N)',
      iconType: 'pos',
      themeColor: '#0F5EA8',
      bgGradient: 'from-[#0F5EA8] to-blue-800',
      badgeBg: 'bg-blue-50 text-[#0F5EA8] border-blue-200',
    };
  }

  if (lower.includes('i9100') || lower.includes('i9000')) {
    return {
      name: 'جهاز POS — Urovo i9100 / i9000s',
      categoryName: 'أجهزة نقاط البيع الذكية',
      category: 'devices',
      manufacturer: 'Urovo Payment Systems',
      barcodeFormat: 'سيريال الجهاز (SN)',
      iconType: 'pos',
      themeColor: '#0F5EA8',
      bgGradient: 'from-cyan-600 to-blue-700',
      badgeBg: 'bg-blue-50 text-[#0F5EA8] border-blue-200',
    };
  }

  if (lower.includes('n950')) {
    return {
      name: 'جهاز POS — Newland N950',
      categoryName: 'أجهزة نقاط البيع الذكية',
      category: 'devices',
      manufacturer: 'Newland Payment Tech',
      barcodeFormat: 'سيريال الجهاز (S/N)',
      iconType: 'pos',
      themeColor: '#0F5EA8',
      bgGradient: 'from-sky-600 to-blue-800',
      badgeBg: 'bg-blue-50 text-[#0F5EA8] border-blue-200',
    };
  }

  if (lower.includes('stc')) {
    return {
      name: 'شريحة اتصال — STC 5G Data SIM',
      categoryName: 'شرائح 5G / بيانات',
      category: 'sim',
      manufacturer: 'STC Telecom',
      barcodeFormat: 'رقم الـ ICCID (89966...)',
      iconType: 'sim',
      themeColor: '#16A34A',
      bgGradient: 'from-emerald-500 to-teal-700',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }

  if (lower.includes('mobily')) {
    return {
      name: 'شريحة اتصال — Mobily Business SIM',
      categoryName: 'شرائح أعمال / بيانات',
      category: 'sim',
      manufacturer: 'Mobily Telecom',
      barcodeFormat: 'رقم الـ ICCID (89966...)',
      iconType: 'sim',
      themeColor: '#0284C7',
      bgGradient: 'from-sky-500 to-blue-600',
      badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
    };
  }

  if (lower.includes('zain')) {
    return {
      name: 'شريحة اتصال — Zain M2M SIM',
      categoryName: 'شرائح بيانات M2M',
      category: 'sim',
      manufacturer: 'Zain KSA',
      barcodeFormat: 'رقم الـ ICCID (89966...)',
      iconType: 'sim',
      themeColor: '#7C3AED',
      bgGradient: 'from-purple-600 to-indigo-700',
      badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    };
  }

  // Fallback for custom or UUID item types
  const isSim = lower.includes('sim') || lower.includes('شريحة');
  return {
    name: key && key.length < 25 ? `صنف — ${key}` : 'جهاز نقاط بيع / مستلزمات مخزنية',
    categoryName: isSim ? 'شرائح اتصالات' : 'أجهزة ومستلزمات',
    category: isSim ? 'sim' : 'devices',
    manufacturer: 'مؤسسة رأس السعودية (RASSCO)',
    barcodeFormat: 'باركود السيريال',
    iconType: isSim ? 'sim' : 'pos',
    themeColor: '#0F5EA8',
    bgGradient: 'from-slate-700 to-slate-900',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
  };
};

export const ItemProductAvatar: React.FC<ItemProductAvatarProps> = ({
  itemTypeKey,
  size = 'md',
  showCategoryPill = true,
}) => {
  const meta = getItemMetadata(itemTypeKey);

  const containerSizes = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-14 h-14 rounded-2xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };

  return (
    <div className="flex items-center gap-3 text-right">
      {/* Visual Product Avatar Box */}
      <div className={`${containerSizes[size]} bg-gradient-to-br ${meta.bgGradient} text-white flex items-center justify-center font-bold shadow-xs shrink-0 relative overflow-hidden border border-white/20`}>
        {meta.iconType === 'sim' ? (
          <Radio className={iconSizes[size]} />
        ) : (
          <Cpu className={iconSizes[size]} />
        )}
        <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
      </div>

      {/* Item Title & Specs */}
      <div className="space-y-0.5 min-w-0">
        <div className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
          {meta.name}
        </div>

        {showCategoryPill && (
          <div className="flex items-center gap-2">
            <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${meta.badgeBg}`}>
              {meta.categoryName}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 truncate">
              {meta.manufacturer}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
