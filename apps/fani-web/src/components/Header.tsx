import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  RefreshCw, 
  LogOut, 
  Calendar, 
  Globe, 
  ChevronDown, 
  Sliders,
  User as UserIcon,
  CheckCircle2,
  Package
} from 'lucide-react';
import { User } from '../api/client';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onRefresh: () => void;
  onOpenNotifications: () => void;
  pendingCount: number;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentRoute: string;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onRefresh,
  onOpenNotifications,
  pendingCount,
  loading,
  searchQuery,
  onSearchChange,
  currentRoute,
}) => {
  const [userDropdown, setUserDropdown] = useState(false);

  // Formatted Current Arabic Date
  const todayDateStr = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const getBreadcrumbTitle = () => {
    if (currentRoute === 'scan') return 'محطة المسح والاعتماد بالسكانر';
    if (currentRoute === 'custody') return 'سجل عهدة الفني';
    if (currentRoute === 'settings') return 'إعدادات الحساب';
    return 'التحويلات المخزنية الشحنات الواردة';
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between gap-6">
        
        {/* 1. Left (RTL Right): Breadcrumb & Date */}
        <div className="flex items-center gap-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500">
            <span className="text-slate-400">StockPro ERP</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-400">بوابة الفنيين</span>
            <span className="text-slate-300">/</span>
            <span className="text-[#0F5EA8] font-black">{getBreadcrumbTitle()}</span>
          </div>

          {/* Current Date Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-[#0F5EA8]" />
            <span>{todayDateStr}</span>
          </div>
        </div>

        {/* 2. Middle: Enterprise Search Input */}
        <div className="flex-1 max-w-lg relative">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="بحث بالرقم التسلسلي، رقم الشحنة، أو المستودع... (Ctrl + K)"
            className="w-full pl-12 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs font-semibold focus:bg-white focus:border-[#0F5EA8] focus:ring-2 focus:ring-[#0F5EA8]/15 outline-none transition-all"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-200 rounded-md">Ctrl K</kbd>
          </div>
        </div>

        {/* 3. Right: System Actions & User Dropdown */}
        <div className="flex items-center gap-3">
          
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-[#0F5EA8] transition-all cursor-pointer"
            title="تحديث بيانات السيرفر"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Language Switcher */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-700 cursor-pointer hover:bg-slate-100 transition-all">
            <Globe className="w-3.5 h-3.5 text-[#0F5EA8]" />
            <span>العربية (SA)</span>
          </div>

          {/* Notifications Drawer Button */}
          <div className="relative">
            <button
              onClick={onOpenNotifications}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-[#0F5EA8] transition-all cursor-pointer relative"
              title="مركز تنبيهات الشحنات"
            >
              <Bell className="w-4 h-4" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -left-1 px-1.5 py-0.5 bg-rose-600 text-white rounded-full text-[9px] font-black animate-pulse shadow-xs">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setUserDropdown(!userDropdown)}
              className="flex items-center gap-3 pr-3 pl-2 py-1.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-[#0F5EA8] text-white flex items-center justify-center font-extrabold text-xs shadow-2xs">
                {user.name ? user.name.substring(0, 2) : 'ع ع'}
              </div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-black text-slate-900">{user.name || user.username}</span>
                <span className="text-[10px] font-bold text-slate-500">فني صيانة ومخزون</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {userDropdown && (
              <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-fade-in text-right">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-black text-slate-900">{user.name || user.username}</p>
                  <p className="text-[10px] font-bold text-slate-500">معرف الفني: #TECH-8920</p>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors text-right cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج النهائي</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
