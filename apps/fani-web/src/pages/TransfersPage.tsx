import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Scan, 
  LogOut, 
  RefreshCw, 
  ChevronLeft,
  Boxes,
  Truck,
  CheckCircle2,
  Cpu,
  Smartphone
} from 'lucide-react';
import { api, WarehouseTransfer, User } from '../api/client';
import { RasscoLogo } from '../components/RasscoLogo';

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
    <div className="min-h-screen bg-[#070d18] text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top RASSCO Brand Desktop Header */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-[#18B2B0]/20">
        <RasscoLogo size="md" subtitle={`مرحباً بك: ${user.name || user.username}`} />

        <div className="flex items-center gap-4">
          <button
            onClick={() => onOpenScan()}
            className="px-6 py-3.5 rounded-2xl rassco-btn-primary text-sm flex items-center gap-2.5 cursor-pointer shadow-lg shadow-[#18B2B0]/20"
          >
            <Scan className="w-5 h-5" />
            <span>مسح شحنة جديدة</span>
          </button>

          <button
            onClick={onLogout}
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main RASSCO Workspace Grid */}
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* RASSCO Hero Banner Card */}
        <div className="rassco-glass-card p-6 sm:p-8 rounded-3xl border border-[#18B2B0]/30 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center sm:text-right relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#18B2B0]/15 border border-[#18B2B0]/30 text-[#18B2B0] text-xs font-bold">
              <Truck className="w-4 h-4" />
              <span>نظام استلام الشحنات الفوري المباشر</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">الطلبات والشحنات المحولة للعهدة</h2>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              قم بفتح الشحنة المطلوبة للمسح الفوري عبر جهاز السكانر ومطابقة كميات الأجهزة والشرائح وتأكيد الاستلام فورياً.
            </p>
          </div>

          <button
            onClick={() => onOpenScan()}
            className="px-7 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center gap-3 border border-[#18B2B0]/40 transition-all cursor-pointer shadow-xl hover:border-[#18B2B0]"
          >
            <Boxes className="w-5 h-5 text-[#18B2B0]" />
            <span>فتح شاشة المسح الضوئي</span>
          </button>
        </div>

        {/* Transfer Requests Table & Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Package className="w-5 h-5 text-[#18B2B0]" />
              <span>جدول طلبات الشحنات المحولة ({transfers.length || 1})</span>
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
            <div className="text-center py-12 text-slate-400 text-sm">جاري تحميل الشحنات من الخادم...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Default Active Warehouse Transfer Card */}
              <div
                onClick={() => onOpenScan('trf-1001')}
                className="rassco-glass-card p-6 rounded-3xl border border-[#18B2B0]/30 hover:border-[#18B2B0] transition-all duration-300 cursor-pointer group hover:shadow-2xl hover:shadow-[#18B2B0]/10"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-extrabold">
                      قيد الاستلام (PENDING)
                    </span>
                    <h4 className="text-xl font-black text-white mt-3 group-hover:text-[#18B2B0] transition-colors">
                      طلب شحنة رقم TRF-2026-0892
                    </h4>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-[#18B2B0] group-hover:bg-[#18B2B0] group-hover:text-slate-950 transition-all shadow-md">
                    <ChevronLeft className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300 border-t border-slate-800/80 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">المستودع المحوِّل:</span>
                    <span className="text-white font-bold">المستودع الرئيسي — الرياض</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">الجهة المحوَّل إليها:</span>
                    <span className="text-white font-bold">عهدة الفني ({user.name || user.username})</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">محتويات الشحنة:</span>
                    <span className="text-[#18B2B0] font-black text-sm">15 قطعة (5 أجهزة POS + 10 شرائح SIM)</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-black text-[#18B2B0]">
                  <span>اضغط لفتح الطلب ومطابقة المسح بالسكانر ⬅️</span>
                  <Scan className="w-4 h-4" />
                </div>
              </div>

              {/* Dynamic API Transfer Cards */}
              {transfers.map((trf) => (
                <div
                  key={trf.id}
                  onClick={() => onOpenScan(trf.id)}
                  className="rassco-glass-card p-6 rounded-3xl border border-slate-800 hover:border-[#18B2B0] transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="px-3.5 py-1 rounded-full bg-[#18B2B0]/15 border border-[#18B2B0]/30 text-[#18B2B0] text-xs font-extrabold">
                        {trf.status}
                      </span>
                      <h4 className="text-xl font-black text-white mt-3 group-hover:text-[#18B2B0] transition-colors">
                        طلب رقم {trf.transferNumber}
                      </h4>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-900 text-[#18B2B0] group-hover:bg-[#18B2B0] group-hover:text-slate-950 transition-all">
                      <ChevronLeft className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800/80 pt-4 mt-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400">من:</span>
                      <span className="text-white font-bold">{trf.sourceWarehouseName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">إلى:</span>
                      <span className="text-white font-bold">{trf.targetWarehouseName}</span>
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
