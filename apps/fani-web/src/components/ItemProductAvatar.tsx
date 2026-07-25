import React from 'react';
import { 
  Smartphone, 
  Cpu, 
  Printer, 
  BatteryCharging, 
  Radio, 
  CreditCard, 
  Layers,
  Zap,
  Tag
} from 'lucide-react';

export interface ItemMetadata {
  key: string;
  name: string;
  nameEn: string;
  category: 'devices' | 'sim' | 'printer' | 'accessory';
  manufacturer: string;
  barcodeFormat: string;
  primaryColor: string;
  bgGradient: string;
  illustrationType: 'pax' | 'verifone' | 'smart_pos' | 'stc_sim' | 'mobily_sim' | 'zain_sim' | 'lebara_sim' | 'printer' | 'battery' | 'generic';
}

export const getItemMetadata = (itemTypeKey: string): ItemMetadata => {
  const key = (itemTypeKey || '').toLowerCase();

  // 1. PAX POS Hardware Terminals
  if (key.includes('a960') || key.includes('960')) {
    return {
      key: 'A960',
      name: 'جهاز POS — PAX A960 Smart',
      nameEn: 'PAX A960 Smart POS Terminal',
      category: 'devices',
      manufacturer: 'PAX Technology',
      barcodeFormat: 'S/N (مثال: SN89201982)',
      primaryColor: '#0F5EA8',
      bgGradient: 'from-blue-600 to-indigo-700',
      illustrationType: 'pax',
    };
  }

  if (key.includes('a920') || key.includes('a930')) {
    return {
      key: 'A920',
      name: 'جهاز POS — PAX A920 Compact',
      nameEn: 'PAX A920 Smart POS Terminal',
      category: 'devices',
      manufacturer: 'PAX Technology',
      barcodeFormat: 'S/N (مثال: SN77102948)',
      primaryColor: '#0284C7',
      bgGradient: 'from-sky-500 to-blue-700',
      illustrationType: 'pax',
    };
  }

  // 2. Verifone & Classic Keypad Terminals
  if (key.includes('verifone') || key.includes('vx520') || key.includes('vx680')) {
    return {
      key: 'VX520',
      name: 'جهاز نقاط بيع — Verifone Vx520',
      nameEn: 'Verifone Vx520 Payment Terminal',
      category: 'devices',
      manufacturer: 'Verifone Systems',
      barcodeFormat: 'S/N (مثال: VF98201948)',
      primaryColor: '#0F766E',
      bgGradient: 'from-teal-600 to-emerald-800',
      illustrationType: 'verifone',
    };
  }

  // 3. Smart POS Terminals (i9100, i9000S, N950)
  if (key.includes('i9100') || key.includes('i9000') || key.includes('n950')) {
    return {
      key: 'I9100',
      name: 'جهاز ذكي — Urovo i9100 Android',
      nameEn: 'Urovo i9100 Android POS',
      category: 'devices',
      manufacturer: 'Urovo / Newland',
      barcodeFormat: 'S/N (مثال: UR90019284)',
      primaryColor: '#4F46E5',
      bgGradient: 'from-indigo-600 to-purple-800',
      illustrationType: 'smart_pos',
    };
  }

  // 4. SIM Cards by Carrier
  if (key.includes('stc') || key.includes('اتصالات')) {
    return {
      key: 'stcSim',
      name: 'شريحة اتصال — STC 5G Data SIM',
      nameEn: 'STC Saudi Telecom 5G SIM',
      category: 'sim',
      manufacturer: 'STC Saudi Arabia',
      barcodeFormat: 'ICCID (89966...) 19 إلى 20 رقم',
      primaryColor: '#4F46E5',
      bgGradient: 'from-purple-600 to-indigo-800',
      illustrationType: 'stc_sim',
    };
  }

  if (key.includes('mobily') || key.includes('موبايلي')) {
    return {
      key: 'mobilySim',
      name: 'شريحة اتصال — Mobily Business SIM',
      nameEn: 'Mobily Corporate Data SIM',
      category: 'sim',
      manufacturer: 'Mobily Saudi Arabia',
      barcodeFormat: 'ICCID (89966...) 19 رقم',
      primaryColor: '#0284C7',
      bgGradient: 'from-sky-500 to-cyan-700',
      illustrationType: 'mobily_sim',
    };
  }

  if (key.includes('zain') || key.includes('زين')) {
    return {
      key: 'zainSim',
      name: 'شريحة اتصال — Zain M2M SIM',
      nameEn: 'Zain M2M Industrial SIM',
      category: 'sim',
      manufacturer: 'Zain Saudi Arabia',
      barcodeFormat: 'ICCID (89966...) 19 رقم',
      primaryColor: '#16A34A',
      bgGradient: 'from-emerald-500 to-teal-700',
      illustrationType: 'zain_sim',
    };
  }

  if (key.includes('lebara') || key.includes('ليبارا')) {
    return {
      key: 'lebaraSim',
      name: 'شريحة اتصال — Lebara Telecom SIM',
      nameEn: 'Lebara Data SIM Card',
      category: 'sim',
      manufacturer: 'Lebara Saudi Arabia',
      barcodeFormat: 'ICCID (89966...) 19 رقم',
      primaryColor: '#E11D48',
      bgGradient: 'from-rose-500 to-pink-700',
      illustrationType: 'lebara_sim',
    };
  }

  if (key.includes('sim') || key.includes('شريحة')) {
    return {
      key: 'genericSim',
      name: 'شريحة اتصال — 5G SIM Card',
      nameEn: 'Generic 5G SIM Card',
      category: 'sim',
      manufacturer: 'Telecom Operator',
      barcodeFormat: 'ICCID 19-20 Digits',
      primaryColor: '#16A34A',
      bgGradient: 'from-emerald-600 to-teal-800',
      illustrationType: 'stc_sim',
    };
  }

  // 5. Printers & Accessories
  if (key.includes('printer') || key.includes('طابعة')) {
    return {
      key: 'printer',
      name: 'طابعة إيصالات — Thermal POS Printer',
      nameEn: 'Thermal Receipt Printer',
      category: 'printer',
      manufacturer: 'RASSCO Accessories',
      barcodeFormat: 'S/N (مثال: PRT99201)',
      primaryColor: '#D97706',
      bgGradient: 'from-amber-500 to-orange-700',
      illustrationType: 'printer',
    };
  }

  if (key.includes('battery') || key.includes('بطارية')) {
    return {
      key: 'battery',
      name: 'بطارية جهاز — POS Terminal Battery',
      nameEn: 'Rechargeable POS Battery 5200mAh',
      category: 'accessory',
      manufacturer: 'RASSCO Accessories',
      barcodeFormat: 'Batch Code',
      primaryColor: '#CA8A04',
      bgGradient: 'from-yellow-500 to-amber-700',
      illustrationType: 'battery',
    };
  }

  // Default Generic POS Terminal Fallback
  return {
    key: 'genericPos',
    name: itemTypeKey || 'جهاز نقاط بيع / مستلزمات مخزنية',
    nameEn: 'POS Hardware Equipment',
    category: 'devices',
    manufacturer: 'مؤسسة رأس السعودية (RASSCO)',
    barcodeFormat: 'S/N أو Barcode',
    primaryColor: '#0F5EA8',
    bgGradient: 'from-blue-600 to-slate-800',
    illustrationType: 'pax',
  };
};

interface ItemProductAvatarProps {
  itemTypeKey: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showCategoryPill?: boolean;
  className?: string;
}

export const ItemProductAvatar: React.FC<ItemProductAvatarProps> = ({
  itemTypeKey,
  size = 'md',
  showCategoryPill = true,
  className = '',
}) => {
  const meta = getItemMetadata(itemTypeKey);

  // Size Dimensions Map
  const sizeMap = {
    xs: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4', title: 'text-xs', sub: 'hidden' },
    sm: { box: 'w-11 h-11 rounded-xl', icon: 'w-5.5 h-5.5', title: 'text-xs', sub: 'text-[10px]' },
    md: { box: 'w-14 h-14 rounded-2xl', icon: 'w-7 h-7', title: 'text-sm', sub: 'text-xs' },
    lg: { box: 'w-20 h-20 rounded-2xl', icon: 'w-10 h-10', title: 'text-base', sub: 'text-xs' },
    xl: { box: 'w-28 h-28 rounded-3xl', icon: 'w-14 h-14', title: 'text-lg', sub: 'text-sm' },
  };

  const dim = sizeMap[size] || sizeMap.md;

  // Realistic Visual Illustration Render Engine
  const renderIllustration = () => {
    switch (meta.illustrationType) {
      case 'pax':
      case 'smart_pos':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${meta.bgGradient} p-2 text-white flex flex-col items-center justify-between shadow-md relative overflow-hidden`}>
              {/* POS Screen Graphic */}
              <div className="w-full bg-white/20 backdrop-blur-xs rounded-lg p-1.5 flex items-center justify-between border border-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <CreditCard className="w-3.5 h-3.5 text-white/90" />
              </div>
              <Smartphone className={`${dim.icon} text-white drop-shadow-sm my-0.5`} />
              {/* POS Thermal Paper Slot */}
              <div className="w-3/4 h-1 bg-white/40 rounded-full" />
            </div>
          </div>
        );

      case 'verifone':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${meta.bgGradient} p-2 text-white flex flex-col items-center justify-between shadow-md relative overflow-hidden`}>
              <div className="w-full bg-slate-900/60 rounded-md p-1 border border-white/10 text-center">
                <span className="text-[8px] font-mono text-cyan-300 font-bold">VERIFONE</span>
              </div>
              <Cpu className={`${dim.icon} text-white my-0.5`} />
              <div className="grid grid-cols-3 gap-0.5 w-3/4">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <span key={n} className="w-full h-1 bg-white/30 rounded-xs" />
                ))}
              </div>
            </div>
          </div>
        );

      case 'stc_sim':
      case 'mobily_sim':
      case 'zain_sim':
      case 'lebara_sim':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${meta.bgGradient} p-2 text-white flex flex-col justify-between shadow-md relative border border-white/20`}>
              {/* Carrier Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black tracking-wider text-white uppercase">{meta.key.replace('Sim', '')}</span>
                <Radio className="w-3 h-3 text-white/80" />
              </div>
              {/* SIM Microchip Graphic */}
              <div className="w-5 h-4 bg-amber-300/90 rounded-sm border border-amber-500/50 mx-auto my-0.5 flex items-center justify-center shadow-2xs">
                <div className="w-full h-0.5 bg-amber-600/40" />
              </div>
              <span className="text-[8px] font-mono text-white/70 text-right">5G DATA</span>
            </div>
          </div>
        );

      case 'printer':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${meta.bgGradient} p-2 text-white flex flex-col items-center justify-between shadow-md`}>
              <Printer className={`${dim.icon} text-white my-auto`} />
              <div className="w-full h-1.5 bg-white/40 rounded-sm border-t border-dashed border-slate-900/30" />
            </div>
          </div>
        );

      case 'battery':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${meta.bgGradient} p-2 text-white flex flex-col items-center justify-between shadow-md`}>
              <BatteryCharging className={`${dim.icon} text-white my-auto`} />
              <span className="text-[8px] font-bold text-white/90">5200 mAh</span>
            </div>
          </div>
        );

      default:
        return (
          <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${meta.bgGradient} p-2 text-white flex items-center justify-center shadow-md`}>
            <Layers className={`${dim.icon} text-white`} />
          </div>
        );
    }
  };

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {/* Product Visual Container */}
      <div className={`${dim.box} shrink-0 shadow-xs relative`}>
        {renderIllustration()}
      </div>

      {/* Product Details Header */}
      <div className="flex flex-col text-right">
        <div className="flex items-center gap-2">
          <span className={`${dim.title} font-extrabold text-slate-900 leading-tight`}>{meta.name}</span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className={`${dim.sub} font-semibold text-slate-500`}>{meta.manufacturer}</span>
          {showCategoryPill && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
              <Tag className="w-2.5 h-2.5 text-[#0F5EA8]" />
              <span>{meta.category === 'sim' ? 'شرائح SIM' : meta.category === 'devices' ? 'أجهزة نقاط البيع' : 'مستلزمات'}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
