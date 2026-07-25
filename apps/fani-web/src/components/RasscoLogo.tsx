import React from 'react';

interface RasscoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  lightMode?: boolean;
}

export const RasscoLogo: React.FC<RasscoLogoProps> = ({ 
  size = 'md', 
  showText = true,
  subtitle = 'نظام إدارة المخزون الفني والعهدة',
  lightMode = true,
}) => {
  const logoDimensions = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  }[size];

  const titleSizes = {
    sm: 'text-sm font-bold',
    md: 'text-lg font-extrabold',
    lg: 'text-2xl font-black',
    xl: 'text-3xl font-black',
  }[size];

  return (
    <div className="flex items-center gap-3.5 select-none">
      {/* Brand Emblem */}
      <div className={`relative ${logoDimensions} shrink-0`}>
        <div className="w-full h-full rounded-2xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-md overflow-hidden">
          <img 
            src="/logo.png" 
            alt="RASSCO Logo" 
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col text-right">
          <div className="flex items-center gap-2">
            <span className={`${titleSizes} ${lightMode ? 'text-slate-900' : 'text-white'} tracking-tight leading-none`}>
              شركة رأس السعودية
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#0F5EA8] text-white text-[10px] font-extrabold tracking-wider uppercase shadow-xs">
              RASSCO
            </span>
          </div>
          {subtitle && (
            <span className={`text-[11px] font-semibold ${lightMode ? 'text-slate-500' : 'text-slate-400'} mt-1 leading-tight`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
