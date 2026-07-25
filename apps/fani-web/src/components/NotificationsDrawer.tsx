import React from 'react';
import { Bell, X, Package, Clock, CheckCircle2, Scan, ArrowLeft } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'transfer_pending' | 'transfer_accepted' | 'system';
  createdAt: string;
  transferId?: string;
  read: boolean;
}

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onSelectNotification: (transferId?: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onSelectNotification,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div 
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-r border-slate-200 animate-slide-in-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#0F5EA8] border border-blue-100">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">مركز الإشعارات والتنبيهات</h3>
              <p className="text-xs text-slate-500">متابعة الشحنات المحولة والعهدة الشخصية</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-3">
              <Bell className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-extrabold text-slate-600">لا توجد إشعارات جديدة حالياً</p>
              <p className="text-xs text-slate-400">ستظهر هنا التنبيهات عند تحويل أجهزة أو شرائح جديدة لك</p>
            </div>
          ) : (
            notifications.map((n) => {
              const isPending = n.type === 'transfer_pending';
              const isAccepted = n.type === 'transfer_accepted';

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.transferId) {
                      onSelectNotification(n.transferId);
                      onClose();
                    }
                  }}
                  className={`p-4 rounded-2xl border text-right transition-all cursor-pointer relative space-y-2 ${
                    isPending
                      ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/80 shadow-xs'
                      : isAccepted
                      ? 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/80'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-white">
                      {isPending ? (
                        <>
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span className="text-amber-700">شحنة بانتظار المسح</span>
                        </>
                      ) : isAccepted ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">تم الاعتماد</span>
                        </>
                      ) : (
                        <span className="text-slate-600">تنبيه نظام</span>
                      )}
                    </span>

                    <span className="text-[10px] text-slate-400 font-semibold">{n.createdAt}</span>
                  </div>

                  <h4 className="text-xs font-black text-slate-900">{n.title}</h4>
                  <p className="text-xs font-semibold text-slate-600 leading-relaxed">{n.message}</p>

                  {isPending && n.transferId && (
                    <div className="pt-2 flex justify-end">
                      <button className="px-4 py-1.5 rounded-xl rassco-btn-primary text-xs flex items-center gap-1.5 shadow-xs">
                        <Scan className="w-3.5 h-3.5 text-[#12C6E8]" />
                        <span>فتح شاشة المسح</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-center text-xs text-slate-500 font-semibold">
          نظام مؤسسة رأس السعودية (RASSCO Enterprise)
        </div>
      </div>
    </div>
  );
};
