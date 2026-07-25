import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Scan, 
  ArrowLeft, 
  LogOut, 
  Shield, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  ChevronLeft,
  Boxes,
  Truck
} from 'lucide-react';
import { api, WarehouseTransfer, User } from '../api/client';

interface TransfersPageProps {
  user: User;
  onLogout: () => void;
  onOpenScan: (transferId?: string) => void;
}

export const TransfersPage: React.FC<TransfersPageProps> = ({ user, onLogout, onOpenScan }) => {
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await api.getTransfers();
    setTransfers(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0b1322] text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Desktop Navigation Bar */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-teal-400 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Shield className="w-6 h-6 text-teal-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">شركة رأس السعودية — بوابة الفنيين</h1>
            <p className="text-slate-400 text-xs">مرحباً بك: <span className="text-cyan-400 font-semibold">{user.name || user.username}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenScan()}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Scan className="w-5 h-5" />
            <span>مسح شحنة جديدة</span>
          </button>

          <button
            onClick={onLogout}
            className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Banner Card */}
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-right relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
              <Truck className="w-4 h-4" />
              <span>نظام استلام الشحنات الفوري</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">الطلبات والشحنات الواردة للعهدة</h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
              اختر أي طلب استلام للبدء الفوري بمسح الأجهزة والشرائح عبر جهاز السكانر ومطابقة الكمية تلقائياً.
            </p>
          </div>

          <button
            onClick={() => onOpenScan()}
            className="px-6 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center gap-3 border border-slate-700 transition-all cursor-pointer"
          >
            <Boxes className="w-5 h-5 text-teal-400" />
            <span>فتح شاشة المسح الضوئي</span>
          </button>
        </div>

        {/* Transfer Requests Table / Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-400" />
              <span>جدول الطلبات والشحنات ({transfers.length || 1})</span>
            </h3>

            <button
              onClick={loadData}
              className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="تحديث"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">جاري تحميل الطلبات...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Default Shipment Item */}
              <div
                onClick={() => onOpenScan('trf-1001')}
                className="glass-card p-6 rounded-3xl border border-slate-800 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer group hover:shadow-cyan-500/5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                      قيد الاستلام (PENDING)
                    </span>
                    <h4 className="text-lg font-bold text-white mt-2 group-hover:text-cyan-300 transition-colors">
                      طلب شحنة رقم TRF-2026-0892
                    </h4>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-800 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-400 border-t border-slate-800/80 pt-4 mt-4">
                  <div className="flex justify-between">
                    <span>من:</span>
                    <span className="text-slate-200 font-semibold">المستودع الرئيسي — الرياض</span>
                  </div>
                  <div className="flex justify-between">
                    <span>إلى:</span>
                    <span className="text-slate-200 font-semibold">عهدة الفني ({user.name || user.username})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>محتويات الشحنة:</span>
                    <span className="text-teal-400 font-bold">15 قطعة (5 أجهزة + 10 شرائح)</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-cyan-400">
                  <span>اضغط لفتح الطلب ومطابقة المسح ⬅️</span>
                  <Scan className="w-4 h-4" />
                </div>
              </div>

              {/* Dynamic API Transfers */}
              {transfers.map((trf) => (
                <div
                  key={trf.id}
                  onClick={() => onOpenScan(trf.id)}
                  className="glass-card p-6 rounded-3xl border border-slate-800 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold">
                        {trf.status}
                      </span>
                      <h4 className="text-lg font-bold text-white mt-2 group-hover:text-cyan-300 transition-colors">
                        طلب رقم {trf.transferNumber}
                      </h4>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-800 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all">
                      <ChevronLeft className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-400 border-t border-slate-800/80 pt-4 mt-4">
                    <div className="flex justify-between">
                      <span>من:</span>
                      <span className="text-slate-200 font-semibold">{trf.sourceWarehouseName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>إلى:</span>
                      <span className="text-slate-200 font-semibold">{trf.targetWarehouseName}</span>
                    </div>
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
