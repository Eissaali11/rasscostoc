import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Scan, 
  RefreshCw, 
  Boxes,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  Filter
} from 'lucide-react';
import { api, User } from '../api/client';
import { NotificationsDrawer, NotificationItem } from '../components/NotificationsDrawer';
import { ItemProductAvatar, getItemMetadata } from '../components/ItemProductAvatar';

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

  // Filter transfers by active tab and search query
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

  // Build Notifications List dynamically from Transfers
  const notifications: NotificationItem[] = transfers.map((t) => {
    const isPending = t.status === 'pending' || t.status === 'PENDING';
    const trfCode = `TRF-${(t.id || '1001').substring(0, 8).toUpperCase()}`;
    const meta = getItemMetadata(t.itemType || 'A960');

    return {
      id: `notif-${t.id}`,
      title: isPending ? `⚠️ شحنة محولة بانتظار استلامك: ${trfCode}` : `✅ تم اعتماد الشحنة: ${trfCode}`,
      message: isPending
        ? `قام ${t.warehouseName || 'المستودع الرئيسي'} بتحويل شحنة [${meta.name}] لك (${t.quantity || 1} قطعة). يرجى إجراء المسح الضوئي والمطابقة للاستلام.`
        : `تم قبول شحنة [${meta.name}] وإضافتها لعهدتك المخزنية الرسمية بنجاح.`,
      type: isPending ? 'transfer_pending' : 'transfer_accepted',
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'اليوم',
      transferId: t.id,
      read: !isPending,
    };
  });

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-extrabold shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>بانتظار الاستلام (Pending)</span>
        </span>
      );
    }
    if (s === 'accepted' || s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>تم الاستلام (Completed)</span>
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold shadow-2xs">
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          <span>مرفوض (Rejected)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-extrabold shadow-2xs">
        <Scan className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
        <span>قيد الاستلام</span>
      </span>
    );
  };

  // Top active pending transfer
  const activePendingTransfer = transfers.find((t) => t.status === 'pending' || t.status === 'PENDING');
  const activeMeta = activePendingTransfer ? getItemMetadata(activePendingTransfer.itemType || 'A960') : null;

  return (
    <div className="space-y-8">

      {/* Notifications Drawer Component */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={onCloseNotifications}
        notifications={notifications}
        onSelectNotification={(transferId) => onOpenScan(transferId)}
      />

      {/* 1. Top 6 Enterprise KPI Cards Dashboard */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* KPI 1: Incoming Shipments */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">الشحنات الواردة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0F5EA8] flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{transfers.length}</div>
            <div className="text-[10px] font-bold text-blue-600 mt-0.5">محولة من المستودعات</div>
          </div>
        </div>

        {/* KPI 2: Pending Receiving */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">بانتظار الاستلام</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600">{pendingCount}</div>
            <div className="text-[10px] font-bold text-amber-600 mt-0.5">تتطلب المسح والمطابقة</div>
          </div>
        </div>

        {/* KPI 3: Current Custody */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">العهدة المعتمدة</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-[#12C6E8] flex items-center justify-center font-bold">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#0F5EA8]">{acceptedCount}</div>
            <div className="text-[10px] font-bold text-slate-500 mt-0.5">شحنة مكتملة في العهدة</div>
          </div>
        </div>

        {/* KPI 4: Today's Operations */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">عمليات اليوم</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">{transfers.length > 0 ? transfers.length : 12}</div>
            <div className="text-[10px] font-bold text-purple-600 mt-0.5">عملية مسح ومطابقة</div>
          </div>
        </div>

        {/* KPI 5: Completed Shipments */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">الشحنات المكتملة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600">{acceptedCount}</div>
            <div className="text-[10px] font-bold text-emerald-600 mt-0.5">مضافة بنجاح في العهدة</div>
          </div>
        </div>

        {/* KPI 6: Pending Tasks */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500">المهام المعلقة</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-600">{pendingCount > 0 ? pendingCount : 0}</div>
            <div className="text-[10px] font-bold text-rose-600 mt-0.5">بانتظار إجراء الفني</div>
          </div>
        </div>

      </section>

      {/* 2. Featured Active Shipment Spotlight Card with Large Product Image */}
      {activePendingTransfer && activeMeta ? (
        <section className="fiori-card-spotlight p-6 flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
          
          {/* Product Image on Right */}
          <div className="flex items-center gap-6 text-right w-full lg:w-auto">
            <ItemProductAvatar itemTypeKey={activePendingTransfer.itemType || 'A960'} size="xl" showCategoryPill={true} />

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-[#0F5EA8]/10 text-[#0F5EA8] text-xs font-bold">
                <Scan className="w-3.5 h-3.5 text-[#12C6E8]" />
                <span>⚠️ شحنة محولة بانتظار مسحها بالسكانر الآن</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">
                {activeMeta.name} — شحنة رقم TRF-{activePendingTransfer.id.substring(0, 8).toUpperCase()}
              </h3>
              <div className="text-xs text-slate-600 flex items-center gap-4">
                <span>المستودع المصدر: <strong className="text-slate-900">{activePendingTransfer.warehouseName || 'المستودع الرئيسي'}</strong></span>
                <span>•</span>
                <span>الكمية المطلوبة: <strong className="text-[#0F5EA8] font-bold">{activePendingTransfer.quantity || 1} قطعة</strong></span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => onOpenScan(activePendingTransfer.id)}
            className="w-full lg:w-auto px-8 py-4 rounded-2xl rassco-btn-primary text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md shrink-0"
          >
            <Scan className="w-5 h-5 text-[#12C6E8]" />
            <span>بدء مسح ومطابقة هذه الشحنة بالسكانر</span>
          </button>
        </section>
      ) : null}

      {/* 3. Enterprise Fiori Data Table Section */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* Table Header & Controls */}
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#0F5EA8]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">جدول الشحنات والتحويلات المخزنية المباشرة</h3>
              <p className="text-xs text-slate-500">عرض مجهّز بافتارات المنتجات وحالة الاعتماد الرسمية لكل تحويل</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${activeTab === 'all' ? 'bg-white text-[#0F5EA8] shadow-2xs font-black' : 'hover:text-slate-900'}`}
            >
              الكل ({transfers.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${activeTab === 'pending' ? 'bg-white text-amber-600 shadow-2xs font-black' : 'hover:text-slate-900'}`}
            >
              بانتظار الاستلام ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('accepted')}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer ${activeTab === 'accepted' ? 'bg-white text-emerald-600 shadow-2xs font-black' : 'hover:text-slate-900'}`}
            >
              مكتمل ومستلم ({acceptedCount})
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {filteredTransfers.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-extrabold text-slate-600">لا توجد شحنات محولة مطابقة للبحث</p>
              <p className="text-xs text-slate-400">عند تحويل أجهزة أو شرائح من المستودع ستظهر هنا مباشرة</p>
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">رقم الشحنة</th>
                  <th className="py-4 px-6">المستودع المصدر</th>
                  <th className="py-4 px-6">صورة ونوع المنتج والموديل</th>
                  <th className="py-4 px-6">الكمية</th>
                  <th className="py-4 px-6">الحالة</th>
                  <th className="py-4 px-6">تاريخ التحويل</th>
                  <th className="py-4 px-6 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                {filteredTransfers.map((t) => {
                  const isPending = (t.status || '').toLowerCase() === 'pending';

                  return (
                    <tr key={t.id} className={`hover:bg-slate-50/80 transition-colors ${isPending ? 'bg-amber-50/20' : ''}`}>
                      
                      {/* 1. Transfer Number Badge */}
                      <td className="py-4 px-6">
                        <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[#0F5EA8] font-mono font-black text-xs">
                          TRF-{t.id.substring(0, 8).toUpperCase()}
                        </span>
                      </td>

                      {/* 2. Source Warehouse */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <div>
                            <div className="font-bold text-slate-900">{t.warehouseName || 'المستودع الرئيسي'}</div>
                            <div className="text-[10px] text-slate-400">إلى عهدة: {user.name || user.username}</div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Product Image & Title */}
                      <td className="py-4 px-6">
                        <ItemProductAvatar itemTypeKey={t.itemType || 'A960'} size="md" />
                      </td>

                      {/* 4. Quantity Pill */}
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 font-black text-xs">
                          <Layers className="w-3.5 h-3.5 text-[#0F5EA8]" />
                          <span>{t.quantity || 1} قطعة</span>
                        </span>
                      </td>

                      {/* 5. Status Badge */}
                      <td className="py-4 px-6">
                        {renderStatusBadge(t.status)}
                      </td>

                      {/* 6. Formatted Date */}
                      <td className="py-4 px-6 text-slate-500">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('ar-SA') : 'اليوم'}</span>
                        </div>
                      </td>

                      {/* 7. Action Button */}
                      <td className="py-4 px-6 text-center">
                        {isPending ? (
                          <button
                            onClick={() => onOpenScan(t.id)}
                            className="px-4 py-2 rounded-xl rassco-btn-primary text-xs flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-2xs"
                          >
                            <Scan className="w-3.5 h-3.5 text-[#12C6E8]" />
                            <span>استكمال الاستلام</span>
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>مكتمل</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </section>

    </div>
  );
};
