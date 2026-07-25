import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Scan, 
  Boxes, 
  FileText, 
  Settings, 
  ChevronRight,
  ShieldCheck,
  Building2,
  Sliders,
  HelpCircle
} from 'lucide-react';
import { RasscoLogo } from './RasscoLogo';

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onNavigate }) => {
  const menuItems = [
    {
      id: 'transfers',
      label: 'لوحة التحكم والتحويلات',
      labelEn: 'Dashboard & Transfers',
      icon: LayoutDashboard,
      badge: 'الرئيسية',
    },
    {
      id: 'custody',
      label: 'إدارة العهدة والمخزون',
      labelEn: 'Technician Custody',
      icon: Boxes,
      badge: null,
    },
    {
      id: 'scan',
      label: 'محطة المسح والمطابقة',
      labelEn: 'Scanner Workstation',
      icon: Scan,
      badge: 'مباشر',
    },
    {
      id: 'operations',
      label: 'سجل العمليات والتقارير',
      labelEn: 'Logs & Reports',
      icon: FileText,
      badge: null,
    },
    {
      id: 'settings',
      label: 'إعدادات الحساب والنظام',
      labelEn: 'System Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-72 bg-white border-l border-slate-200 flex flex-col justify-between h-screen sticky top-0 z-40 shrink-0 shadow-2xs select-none">
      
      {/* 1. Header & ERP System Logo */}
      <div>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <RasscoLogo size="md" subtitle="StockPro Enterprise ERP" lightMode={true} />
        </div>

        {/* System Ecosystem Badge */}
        <div className="mx-4 my-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0F5EA8] text-white flex items-center justify-center font-black text-xs shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-black text-slate-900">مؤسسة رأس السعودية</span>
              <span className="text-[10px] font-bold text-slate-500">نظام إدارة الأجهزة v2.4</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" title="سيرفر متصل" />
        </div>

        {/* Navigation Menu Links */}
        <nav className="px-3 space-y-1.5 pt-2">
          <div className="px-3 py-1.5 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider text-right">
            القائمة الرئيسية للنظام
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentRoute === item.id || (item.id === 'transfers' && (currentRoute === '' || currentRoute === 'transfers'));

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0F5EA8] text-white shadow-md shadow-blue-900/15 font-black'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#12C6E8]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#0F5EA8] border border-blue-100'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status & Help */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>اتصال آمن مفرّد SSL</span>
          </div>
          <HelpCircle className="w-4 h-4 text-slate-400 cursor-pointer hover:text-slate-600" />
        </div>

        <div className="text-[10px] text-center text-slate-400 font-semibold">
          جميع الحقوق محفوظة © 2026 RASSCO StockPro
        </div>
      </div>

    </aside>
  );
};
