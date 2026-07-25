import React, { useState, useEffect } from 'react';
import { 
  Scan, 
  Boxes,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  Layers,
  ChevronLeft,
  User as UserIcon,
  Trash2,
  Database,
  Check
} from 'lucide-react';
import { api, User } from '../api/client';
import { NotificationsDrawer, NotificationItem } from '../components/NotificationsDrawer';
import { ItemProductAvatar, getItemMetadata } from '../components/ItemProductAvatar';
import { RightSidebarWidget } from '../components/RightSidebarWidget';

interface TransfersPageProps {
  user: User;
  onLogout: () => void;
  onOpenScan: (transferId?: string) => void;
  searchQuery: string;
  isNotificationsOpen: boolean;
  onCloseNotifications: () => void;
}

export const TransfersPage: React.FC<TransfersPageProps> = ({
  user,
  onLogout,
  onOpenScan,
  searchQuery,
  isNotificationsOpen,
  onCloseNotifications,
}) => {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await api.getTransfers();
    setTransfers(data || []);
    setLoading(false);
  };

  const filteredTransfers = transfers.filter((t) => {
    const matchesTab = 
      activeTab === 'all' ? true :
      activeTab === 'pending' ? (t.status === 'pending' || t.status === 'PENDING') :
      activeTab === 'accepted' ? (t.status === 'accepted' || t.status === 'ACCEPTED' || t.status === 'COMPLETED') :
      activeTab === 'rejected' ? (t.status === 'rejected' || t.status === 'REJECTED') : true;

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      (t.id && t.id.toLowerCase().includes(query)) ||
      (t.itemType && t.itemType.toLowerCase().includes(query)) ||
      (t.warehouseName && t.warehouseName.toLowerCase().includes(query));

    return matchesTab && matchesSearch;
  });

  const pendingCount = transfers.filter((t) => t.status === 'pending' || t.status === 'PENDING').length;
  const acceptedCount = transfers.filter((t) => t.status === 'accepted' || t.status === 'ACCEPTED' || t.status === 'COMPLETED').length;
  const rejectedCount = transfers.filter((t) => t.status === 'rejected' || t.status === 'REJECTED').length;

  const notifications: NotificationItem[] = transfers.map((t) => {
    const isPending = t.status === 'pending' || t.status === 'PENDING';
    const trfCode = `TRF-${(t.id || 'CA71A915').toUpperCase()}`;
    const meta = getItemMetadata(t.itemType || 'A960');

    return {
      id: `notif-${t.id}`,
      title: isPending ? `⚠️ شحنة محولة بانتظار استلامك: ${trfCode}` : `✅ تم اعتماد الشحنة: ${trfCode}`,
      message: isPending
        ? `قام ${t.warehouseName || 'المستودع الرئيسي'} بتحويل شحنة [${meta.name}] لك (${t.quantity || 3} قطعة). يرجى إجراء المسح الضوئي والمطابقة للاستلام.`
        : `تم قبول شحنة [${meta.name}] وإضافتها لعهدتك المخزنية الرسمية بنجاح.`,
      type: isPending ? 'transfer_pending' : 'transfer_accepted',
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'اليوم',
      transferId: t.id,
      read: !isPending,
    };
  });

  const activePendingTransfer = transfers.find((t) => t.status === 'pending' || t.status === 'PENDING') || transfers[0];
  const activeMeta = activePendingTransfer ? getItemMetadata(activePendingTransfer.itemType || 'A960') : null;

  return (
    <div className="space-y-6">

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={onCloseNotifications}
        notifications={notifications}
        onSelectNotification={(transferId) => onOpenScan(transferId)}
      />

      {/* 1. Greeting Header Section & Date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Right Title */}
        <div className="text-right space-y-1">
          <h1 className="text-2xl font-black text-slate-900 font-['Cairo']">
            مرحباً بك عيسى القحطاني
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            إليك نظرة عامة على عملياتك وإحصائيات الشحنات والعهدة
          </p>
        </div>

        {/* Left Date Container */}
        <div className="px-4 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2 shadow-2xs self-start sm:self-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>السبت، 25 مايو 2025</span>
        </div>

      </div>

      {/* 2. Top 5 KPI Metric Cards Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Total Custody Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="text-right">
            <span className="text-[11px] font-extrabold text-slate-400">إجمالي العهدة</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">133,616</div>
            <span className="text-[10px] font-bold text-slate-400">قيمة تقريبية</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Shipments */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="text-right">
            <span className="text-[11px] font-extrabold text-slate-400">إجمالي الشحنات</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">{transfers.length > 0 ? transfers.length : 11}</div>
            <span className="text-[10px] font-bold text-slate-400">محولة من المستودع</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Pending Receiving */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="text-right">
            <span className="text-[11px] font-extrabold text-slate-400">بانتظار الاستلام</span>
            <div className="text-xl font-black text-amber-600 mt-0.5">{pendingCount > 0 ? pendingCount : 2}</div>
            <span className="text-[10px] font-bold text-amber-600">تحتاج مطابقة</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Accepted Custody */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="text-right">
            <span className="text-[11px] font-extrabold text-slate-400">العهدة المعتمدة</span>
            <div className="text-xl font-black text-slate-900 mt-0.5">{acceptedCount > 0 ? acceptedCount : 8}</div>
            <span className="text-[10px] font-bold text-slate-400">شحنة مكتملة</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        {/* Card 5: Account Status */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="text-right">
            <span className="text-[11px] font-extrabold text-slate-400">حالة الحساب</span>
            <div className="text-base font-black text-emerald-600 mt-0.5">نشط ومحدث</div>
            <span className="text-[10px] font-bold text-slate-400">حالة الحساب</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

      </section>

      {/* 3. Featured Spotlight Card */}
      {activePendingTransfer && activeMeta ? (
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-6 relative">
          
          {/* Right Product Image & Text */}
          <div className="flex items-center gap-5 text-right w-full md:w-auto">
            {/* Product Thumbnail Container */}
            <div className="w-24 h-24 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-center shrink-0 p-2">
              <ItemProductAvatar itemTypeKey={activePendingTransfer.itemType || 'A960'} size="lg" showSubtext={false} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">جديد</span>
                <span className="text-xs font-bold text-slate-500">شحنة جديدة في انتظار استلامها بالباركود</span>
              </div>
              <h3 className="text-base font-black text-slate-900">
                {activeMeta.name} — شحنة رقم TRF-{(activePendingTransfer.id || 'CA71A915').substring(0, 8).toUpperCase()}
              </h3>
              <div className="text-xs text-slate-500 font-semibold">
                المستودع الرئيسي <span className="mx-1">•</span> أجهزة / {activePendingTransfer.quantity || 3} قطعة
              </div>
            </div>
          </div>

          {/* Left Teal Action Button */}
          <button
            onClick={() => onOpenScan(activePendingTransfer.id)}
            className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-[#00A896] hover:bg-[#008f80] text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
          >
            <Scan className="w-4 h-4 text-white" />
            <span>بدء مسح واستلام هذه الشحنة</span>
          </button>
        </section>
      ) : null}

      {/* 4. Split Main Section Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN (Width 9/12): Data Table Container */}
        <div className="lg:col-span-9 bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          
          {/* Section Header & Tabs */}
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-right">
              <h3 className="text-base font-black text-slate-900">جدول الشحنات والتحويلات المخزنية المباشرة</h3>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-600">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${activeTab === 'all' ? 'bg-[#00A896] text-white font-black shadow-2xs' : 'hover:text-slate-900'}`}
              >
                الكل ({transfers.length > 0 ? transfers.length : 11})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${activeTab === 'pending' ? 'bg-[#00A896] text-white font-black shadow-2xs' : 'hover:text-slate-900'}`}
              >
                بانتظار الاستلام ({pendingCount > 0 ? pendingCount : 2})
              </button>
              <button
                onClick={() => setActiveTab('accepted')}
                className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${activeTab === 'accepted' ? 'bg-[#00A896] text-white font-black shadow-2xs' : 'hover:text-slate-900'}`}
              >
                مكتملا ({acceptedCount > 0 ? acceptedCount : 8})
              </button>
              <button
                onClick={() => setActiveTab('rejected')}
                className={`px-4 py-1.5 rounded-xl transition-all cursor-pointer ${activeTab === 'rejected' ? 'bg-[#00A896] text-white font-black shadow-2xs' : 'hover:text-slate-900'}`}
              >
                ملغي ({rejectedCount > 0 ? rejectedCount : 1})
              </button>
            </div>
          </div>

          {/* Table Element */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">رقم الشحنة</th>
                  <th className="py-4 px-6">المستودع المصدر</th>
                  <th className="py-4 px-6">نوع الصنف</th>
                  <th className="py-4 px-6">الكمية</th>
                  <th className="py-4 px-6">الحالة</th>
                  <th className="py-4 px-6">تاريخ التحويل</th>
                  <th className="py-4 px-6 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                {filteredTransfers.map((t) => {
                  const isPending = (t.status || '').toLowerCase() === 'pending';
                  const isAccepted = (t.status || '').toLowerCase() === 'accepted' || (t.status || '').toLowerCase() === 'completed';
                  const isRejected = (t.status || '').toLowerCase() === 'rejected';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* 1. Transfer ID & User Badge */}
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <div className="font-mono font-black text-slate-900">{(t.id || 'CA71A915').toUpperCase()}</div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <UserIcon className="w-3 h-3 text-slate-400" />
                            <span>تجريبي eissa11</span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Source Warehouse */}
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {t.warehouseName || 'المستودع الرئيسي'}
                      </td>

                      {/* 3. Product Item Avatar */}
                      <td className="py-4 px-6">
                        <ItemProductAvatar itemTypeKey={t.itemType || 'A960'} size="md" />
                      </td>

                      {/* 4. Quantity */}
                      <td className="py-4 px-6 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.quantity || 1} قطعة</span>
                        </div>
                      </td>

                      {/* 5. Status Badge */}
                      <td className="py-4 px-6">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-extrabold border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>بانتظار الاستلام</span>
                          </span>
                        )}
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>تم الإستلام</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-extrabold border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-500" />
                            <span>مرفوض</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Date */}
                      <td className="py-4 px-6 font-mono text-slate-500 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>25/05/2025</span>
                        </div>
                      </td>

                      {/* 7. Action Button */}
                      <td className="py-4 px-6 text-center">
                        {isPending ? (
                          <button
                            onClick={() => onOpenScan(t.id)}
                            className="px-4 py-2 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white text-xs font-black flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-2xs transition-all"
                          >
                            <Scan className="w-3.5 h-3.5 text-white" />
                            <span>استكمال الاستلام</span>
                          </button>
                        ) : isAccepted ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>تم الإستلام</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            <span>مرفوض</span>
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 text-right">
            <button className="text-xs font-extrabold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>عرض جميع الشحنات</span>
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN (Width 3/12): RightSidebarWidget */}
        <div className="lg:col-span-3">
          <RightSidebarWidget />
        </div>

      </div>

    </div>
  );
};
