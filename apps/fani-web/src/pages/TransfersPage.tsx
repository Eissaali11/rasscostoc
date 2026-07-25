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
  Clock,
  AlertTriangle,
  XCircle,
  Search,
  Bell,
  User as UserIcon,
  Filter,
  ArrowUpRight,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'in_progress' | 'accepted' | 'rejected'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await api.getTransfers();
    setTransfers(data);
    setLoading(false);
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>بانتظار الاستلام</span>
          </span>
        );
      case 'PARTIAL':
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            <Scan className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>قيد المسح (64%)</span>
          </span>
        );
      case 'ACCEPTED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>تم الاستلام (مكتمل)</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>مرفوض</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900 pb-12">
      
      {/* 1. Strong RASSCO Executive Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          
          {/* Logo & Branding */}
          <RasscoLogo size="md" subtitle="بوابة الفنيين — شركة رأس السعودية" lightMode={true} />

          {/* Search Input Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-6 relative">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث برقم الشحنة أو اسم المستودع..."
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs font-semibold focus:bg-white focus:border-[#0F5EA8] outline-none transition-all"
            />
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={loadData}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-[#0F5EA8] transition-all cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Notifications Badge Button */}
            <div className="relative">
              <button
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                title="الإشعارات"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 left-1.5 w-2.5 h-2.5 bg-[#12C6E8] rounded-full ring-2 ring-white" />
              </button>
            </div>

            {/* Technician Profile Badge */}
            <div className="flex items-center gap-3 pr-3 border-r border-slate-200">
              <div className="w-9 h-9 rounded-xl bg-[#0F5EA8] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {user.name ? user.name.substring(0, 2) : 'ع علي'}
              </div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-black text-slate-900">{user.name || user.username}</span>
                <span className="text-[10px] font-bold text-slate-500">فني صيانة ومخزون</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* 2. KPI Cards Dashboard (4 Clean White Cards) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* KPI 1: New Shipments */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 mb-1">الشحنات الجديدة</div>
              <div className="text-3xl font-black text-slate-900">3</div>
              <div className="text-[11px] font-semibold text-blue-600 mt-1">محولة مؤخراً من المستودع</div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#0F5EA8] flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 2: Pending Receipt */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 mb-1">بانتظار الاستلام</div>
              <div className="text-3xl font-black text-amber-600">5</div>
              <div className="text-[11px] font-semibold text-amber-600 mt-1">تحتاج مطابقة ومسح</div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 3: Current Custody */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 mb-1">العهدة الحالية</div>
              <div className="text-3xl font-black text-[#0F5EA8]">186</div>
              <div className="text-[11px] font-semibold text-slate-500 mt-1">جهاز وشريحة في العهدة</div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-100 text-[#12C6E8] flex items-center justify-center">
              <Boxes className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 4: Completed Today */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 mb-1">تم اليوم</div>
              <div className="text-3xl font-black text-emerald-600">12</div>
              <div className="text-[11px] font-semibold text-emerald-600 mt-1">شحنة مكتملة الاعتماد</div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

        </section>

        {/* 3. Featured Active Shipment Spotlight Card */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 text-right w-full lg:w-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F5EA8]/10 text-[#0F5EA8] text-xs font-bold">
              <Scan className="w-3.5 h-3.5" />
              <span>الشحنة الجارية الموصى بمطابقتها الآن</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">شحنة رقم TRF-2026-0892</h3>
            <div className="text-xs text-slate-500 flex items-center gap-4">
              <span>المصدر: <strong className="text-slate-800">المستودع الرئيسي — الرياض</strong></span>
              <span>•</span>
              <span>المحتوى: <strong className="text-slate-800">50 قطعة (15 Verifone + 20 PAX + 15 SIM)</strong></span>
            </div>
          </div>

          {/* Live Progress Bar Container */}
          <div className="w-full lg:w-80 space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-700">نسبة الاستلام:</span>
              <span className="text-[#0F5EA8]">32 / 50 (64%)</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-[#0F5EA8] rounded-full transition-all duration-500" style={{ width: '64%' }} />
            </div>
          </div>

          <button
            onClick={() => onOpenScan('trf-1001')}
            className="w-full lg:w-auto px-7 py-3.5 rounded-2xl rassco-btn-primary text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Scan className="w-4 h-4 text-[#12C6E8]" />
            <span>استكمال الاستلام بالسكانر</span>
          </button>
        </section>

        {/* 4. Desktop Professional Data Table Section */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          
          {/* Table Header Controls */}
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-[#0F5EA8]">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">جدول الشحنات والتحويلات المخزنية</h3>
                <p className="text-xs text-slate-500">إدارة ومطابقة جميع الشحنات الواردة لعهدة الفني</p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'all' ? 'bg-white text-[#0F5EA8] shadow-xs font-black' : 'hover:text-slate-900'}`}
              >
                الكل (6)
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'pending' ? 'bg-white text-amber-600 shadow-xs font-black' : 'hover:text-slate-900'}`}
              >
                بانتظار الاستلام (3)
              </button>
              <button
                onClick={() => setActiveTab('accepted')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'accepted' ? 'bg-white text-emerald-600 shadow-xs font-black' : 'hover:text-slate-900'}`}
              >
                مكتمل ومستلم (2)
              </button>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">رقم الشحنة</th>
                  <th className="py-4 px-6">المستودع المصدر</th>
                  <th className="py-4 px-6">الأجهزة والشرائح</th>
                  <th className="py-4 px-6">الحالة</th>
                  <th className="py-4 px-6">نسبة الاستلام</th>
                  <th className="py-4 px-6">تاريخ التحويل</th>
                  <th className="py-4 px-6 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                
                {/* Row 1: Active Demo Shipment */}
                <tr className="hover:bg-blue-50/50 transition-colors">
                  <td className="py-4 px-6 font-extrabold text-[#0F5EA8] font-mono text-sm">
                    TRF-2026-0892
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">المستودع الرئيسي — الرياض</div>
                    <div className="text-[11px] text-slate-400">إلى عهدة: {user.name || user.username}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">50 قطعة إجمالية</div>
                    <div className="text-[11px] text-slate-500">15 Verifone + 20 PAX + 15 SIM</div>
                  </td>
                  <td className="py-4 px-6">
                    {renderStatusBadge('PARTIAL')}
                  </td>
                  <td className="py-4 px-6">
                    <div className="w-32 space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>32 / 50</span>
                        <span>64%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-[#0F5EA8] h-full rounded-full" style={{ width: '64%' }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-500">
                    2026-07-25 (منذ ساعتين)
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => onOpenScan('trf-1001')}
                      className="px-4 py-2 rounded-xl rassco-btn-primary text-xs flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-xs"
                    >
                      <Scan className="w-3.5 h-3.5 text-[#12C6E8]" />
                      <span>استكمال الاستلام</span>
                    </button>
                  </td>
                </tr>

                {/* Row 2: Pending Shipment */}
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 font-extrabold text-[#0F5EA8] font-mono text-sm">
                    TRF-2026-0888
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">مستودع جدة الإقليمي</div>
                    <div className="text-[11px] text-slate-400">إلى عهدة: {user.name || user.username}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">20 جهاز POS</div>
                    <div className="text-[11px] text-slate-500">20 PAX A960</div>
                  </td>
                  <td className="py-4 px-6">
                    {renderStatusBadge('PENDING')}
                  </td>
                  <td className="py-4 px-6">
                    <div className="w-32 space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>0 / 20</span>
                        <span>0%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-slate-300 h-full rounded-full" style={{ width: '0%' }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-500">
                    2026-07-24 (أمس)
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => onOpenScan('trf-1002')}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-[#0F5EA8] hover:text-white border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer mx-auto"
                    >
                      <span>بدء المسح</span>
                    </button>
                  </td>
                </tr>

                {/* Row 3: Completed Shipment */}
                <tr className="hover:bg-slate-50/80 transition-colors bg-emerald-50/20">
                  <td className="py-4 px-6 font-extrabold text-slate-700 font-mono text-sm">
                    TRF-2026-0850
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">المستودع الرئيسي — الرياض</div>
                    <div className="text-[11px] text-slate-400">إلى عهدة: {user.name || user.username}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">30 شريحة SIM</div>
                    <div className="text-[11px] text-slate-500">30 STC 5G Data</div>
                  </td>
                  <td className="py-4 px-6">
                    {renderStatusBadge('ACCEPTED')}
                  </td>
                  <td className="py-4 px-6">
                    <div className="w-32 space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-emerald-700">
                        <span>30 / 30</span>
                        <span>100%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-500">
                    2026-07-22
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>مكـتمل</span>
                    </span>
                  </td>
                </tr>

              </tbody>
            </table>
          </div>

        </section>

      </main>
    </div>
  );
};
