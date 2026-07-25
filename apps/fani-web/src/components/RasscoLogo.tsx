import React from 'react';

interface RasscoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
}

export const RasscoLogo: React.FC<RasscoLogoProps> = ({ 
  size = 'md', 
  showText = true,
  subtitle = 'نظام إدارة مخزون الفنيين والعهدة'
}) => {
  const logoDimensions = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }[size];

  const titleSizes = {
    sm: 'text-sm font-bold',
    md: 'text-lg font-extrabold',
    lg: 'text-2xl font-black',
    xl: 'text-3xl font-black',
  }[size];

  return (
    <div className="flex items-center gap-3.5 select-none">
      {/* Brand Emblem Container with Glow */}
      <div className={`relative ${logoDimensions} shrink-0`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-[#18B2B0] to-cyan-400 rounded-2xl blur-md opacity-40 animate-pulse" />
        <div className="relative w-full h-full rounded-2xl bg-slate-900 border border-[#18B2B0]/40 p-1.5 flex items-center justify-center shadow-lg shadow-[#18B2B0]/20 overflow-hidden">
          <img 
            src="/logo.png" 
            alt="RASSCO Logo" 
            className="w-full h-full object-contain filter drop-shadow-md"
            onError={(e) => {
              // Fallback to vector logo if image fails
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col text-right">
          <div className="flex items-center gap-2">
            <span className={`${titleSizes} text-white tracking-tight leading-none`}>
              رأس السعودية
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#18B2B0]/15 border border-[#18B2B0]/30 text-[#18B2B0] text-[10px] font-bold tracking-wider uppercase">
              RASSCO
            </span>
          </div>
          {subtitle && (
            <span className="text-[11px] font-semibold text-slate-400 mt-1 leading-tight">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
