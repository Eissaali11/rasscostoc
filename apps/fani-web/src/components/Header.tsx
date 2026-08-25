import React from 'react';
import { 
  Search, 
  Bell, 
  Sun, 
  MoreVertical,
  LogOut
} from 'lucide-react';
import { User } from '../api/client';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenNotifications: () => void;
  pendingCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenNotifications,
  pendingCount,
  searchQuery,
  onSearchChange,
}) => {
  const initials = (() => {
    const str = user?.name || user?.username || '';
    if (!str) return 'ف';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.substring(0, 2).toUpperCase();
  })();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-[1920px] mx-auto px-6 py-3.5 flex items-center justify-between gap-6">
        
        {/* 1. Left (RTL Right): Options menu icon & RASSCO Logo */}
        <div className="flex items-center gap-4">
          <button className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer">
            <MoreVertical className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            {/* RASSCO Circuit Logo Icon */}
            <div className="w-10 h-10 rounded-xl bg-[#0F5EA8] text-white flex items-center justify-center font-black text-sm shadow-2xs">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            
            <div className="flex flex-col text-right">
              <span className="text-base font-black text-[#0F5EA8] tracking-wider font-['Cairo']">RASSCO</span>
              <span className="text-[11px] font-bold text-slate-500">شركة رأس السعودية — بوابة الفنيين</span>
            </div>
          </div>
        </div>

        {/* 2. Middle: Large Rounded Search Input */}
        <div className="flex-1 max-w-xl relative">
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث برقم الشحنة، رقم المستودع، أو رقم الجهاز..."
            className="w-full pl-6 pr-11 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs font-semibold focus:bg-white focus:border-[#0F5EA8] focus:ring-2 focus:ring-[#0F5EA8]/15 outline-none transition-all"
          />
        </div>

        {/* 3. Right: User Profile Avatar, Theme Toggle, Notification Bell */}
        <div className="flex items-center gap-3">
          
          {/* User Profile Avatar */}
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-right p-1 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
            title="اضغط لتسجيل الخروج"
          >
            <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xs border-2 border-slate-200 shadow-2xs overflow-hidden">
              <span className="text-xs">{initials}</span>
            </div>
          </button>

          {/* Theme Toggle Button (Sun icon) */}
          <button
            className="p-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            title="تبديل المظهر"
          >
            <Sun className="w-4 h-4 text-slate-600" />
          </button>

          {/* Notification Center Trigger */}
          <button
            onClick={onOpenNotifications}
            className="p-2.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer relative"
            title="مركز الإشعارات والتنبيهات"
          >
            <Bell className="w-4 h-4 text-slate-600" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center shadow-2xs">
              {pendingCount > 0 ? pendingCount : 3}
            </span>
          </button>

        </div>

      </div>
    </header>
  );
};
