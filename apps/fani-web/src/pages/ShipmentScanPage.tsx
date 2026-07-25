import React, { useState, useEffect, useRef } from 'react';
import { 
  Scan, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  ArrowRight, 
  RefreshCw, 
  Package, 
  Building2, 
  Layers, 
  Trash2,
  Barcode,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { api } from '../api/client';
import { ItemProductAvatar, getItemMetadata } from '../components/ItemProductAvatar';

interface ShipmentScanPageProps {
  transferId: string | null;
  onBack: () => void;
}

export const ShipmentScanPage: React.FC<ShipmentScanPageProps> = ({ transferId, onBack }) => {
  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [serialInput, setSerialInput] = useState('');
  const [scannedItems, setScannedItems] = useState<Array<{ serial: string; itemType: string; timestamp: string }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<{ serial: string; timestamp: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (transferId) {
      loadTransferDetails();
    } else {
      setLoading(false);
    }
  }, [transferId]);

  // Keep auto-focus on scanner input
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(focusTimer);
  }, [scannedItems, errorMsg, successMsg]);

  const loadTransferDetails = async () => {
    setLoading(true);
    const data = await api.getTransferById(transferId!);
    setTransfer(data);
    setLoading(false);
  };

  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = serialInput.trim().toUpperCase();

    if (!raw) {
      setErrorMsg('⚠️ الرجاء قراءة أو إدخال الرقم التسلسلي للسكانر');
      setSuccessMsg(null);
      return;
    }

    // Sanitize Barcode prefixes
    let cleanSerial = raw;
    if (cleanSerial.startsWith(']C1')) cleanSerial = cleanSerial.substring(3);
    else if (cleanSerial.startsWith('C1')) cleanSerial = cleanSerial.substring(2);

    // Duplicate Check
    if (scannedItems.some((i) => i.serial === cleanSerial)) {
      setErrorMsg(`⚠️ الرقم التسلسلي (${cleanSerial}) مضاف بالفعل في جدول القراءة!`);
      setSuccessMsg(null);
      setSerialInput('');
      return;
    }

    const currentItemType = transfer?.itemType || 'A960';
    const nowStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setScannedItems((prev) => [
      { serial: cleanSerial, itemType: currentItemType, timestamp: nowStr },
      ...prev,
    ]);

    setLastScanned({ serial: cleanSerial, timestamp: nowStr });
    setSuccessMsg(`✓ تمت قراءة وتمييز الرقم التسلسلي [${cleanSerial}] بنجاح`);
    setErrorMsg(null);
    setSerialInput('');
  };

  const removeItem = (serial: string) => {
    setScannedItems((prev) => prev.filter((i) => i.serial !== serial));
  };

  const handleFinalConfirm = async () => {
    if (scannedItems.length === 0) {
      setErrorMsg('⚠️ لا توجد أرقام تسلسلية ممسوحة للاعتماد!');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const itemsToConfirm = scannedItems.map((i) => ({
      serialNumber: i.serial,
      itemTypeId: i.itemType,
    }));

    const res = await api.acceptTransferBatch(transferId || '1001', itemsToConfirm);

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(`🎉 تم اعتماد الشحنة بنجاح! تم نقل قيد وحضانة (${scannedItems.length} قطعة) إلى عهدتك المخزنية الرسمية.`);
      setTimeout(() => {
        onBack();
      }, 2000);
    } else {
      setErrorMsg(res.message || 'فشل اعتماد الشحنة بالسيرفر. يرجى إعادة المحاولة.');
    }
  };

  const totalRequired = transfer?.quantity || 1;
  const progressPercent = Math.min(100, Math.round((scannedItems.length / totalRequired) * 100));
  const meta = getItemMetadata(transfer?.itemType || 'A960');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-[#0F5EA8]" />
        <p className="text-sm font-extrabold text-slate-700">جاري تحميل بيانات محطة المسح والمطابقة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Top Breadcrumb Header & Return Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
        >
          <ChevronRight className="w-4 h-4 text-[#0F5EA8]" />
          <span>العودة لجدول التحويلات الرئيسية</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>جلسة مطابقة آمنة ومشفّرة</span>
        </div>
      </div>

      {/* Main Split Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* 1. LEFT PANEL (Width 4/12): Shipment Summary & Visual Progress */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Card: Shipment Info & Product Avatar */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-6">
            
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">تفاصيل الشحنة المحولة</span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                TRF-{(transferId || '1001').substring(0, 8).toUpperCase()}
              </h2>
            </div>

            {/* Product Visual Avatar */}
            <ItemProductAvatar itemTypeKey={transfer?.itemType || 'A960'} size="lg" showCategoryPill={true} />

            {/* Shipment Metadata Details */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">المستودع المصدر:</span>
                <span className="font-extrabold text-slate-900">{transfer?.warehouseName || 'المستودع الرئيسي'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">إجمالي القطع المطلوب استلامها:</span>
                <span className="font-extrabold text-[#0F5EA8]">{totalRequired} قطعة</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">حالة الشحنة:</span>
                <span className="font-extrabold text-amber-600">بانتظار المسح ضوئياً</span>
              </div>
            </div>

            {/* Visual Progress Gauge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">نسبة مطابقة واستلام الشحنة</span>
                <span className="text-[#0F5EA8] font-black">{progressPercent}%</span>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-[#0F5EA8] to-[#12C6E8] transition-all duration-300 shadow-xs"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="text-[11px] text-center text-slate-500 font-bold">
                تم مسح <strong className="text-slate-900">{scannedItems.length}</strong> من أصل <strong className="text-slate-900">{totalRequired}</strong> قطعة
              </div>
            </div>

          </div>

          {/* Pending Items Summary Widget */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900">الأصناف المطلوب استلامها بالشحنة</h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#0F5EA8] text-[10px] font-bold">نوع واحد</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ItemProductAvatar itemTypeKey={transfer?.itemType || 'A960'} size="xs" showCategoryPill={false} />
              </div>
              <span className="text-xs font-black text-slate-900">{totalRequired}x قطعة</span>
            </div>
          </div>

        </div>

        {/* 2. RIGHT PANEL (Width 8/12): Live Scanner Input & Scanned Serials Grid */}
        <div className="lg:col-span-8 space-y-6">

          {/* Scanner Input Station Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-[#0F5EA8]">
                  <Scan className="w-5 h-5 text-[#12C6E8]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">محطة القراءة والمسح الضوئي المباشر</h3>
                  <p className="text-xs text-slate-500">وجه قارئ الباركود أو أدخل الرقم التسلسلي SN / ICCID ووافق بالزر</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>جاهز للقراءة التلقائية</span>
              </div>
            </div>

            {/* Scanner Input Form */}
            <form onSubmit={handleScanSubmit} className="relative">
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  placeholder="امسح الباركود بالسكانر أو أدخل الرقم التسلسلي هنا (مثال: SN89201982)..."
                  className="w-full pl-36 pr-12 py-4 rounded-2xl rassco-scan-input text-slate-900 font-mono font-bold text-sm text-right placeholder-slate-400 outline-none transition-all shadow-2xs"
                  autoFocus
                />
                <Barcode className="w-5 h-5 text-slate-400 absolute right-4 pointer-events-none" />

                <button
                  type="submit"
                  className="absolute left-2.5 px-5 py-2.5 rounded-xl rassco-btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>إضافة للقائمة</span>
                </button>
              </div>
            </form>

            {/* Real-time Feedback Banners */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-extrabold flex items-center gap-3 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold flex items-center gap-3 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Last Scanned Item Card */}
            {lastScanned && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/50 to-slate-50 border border-blue-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#0F5EA8] text-white flex items-center justify-center font-bold">
                    <Check className="w-4 h-4 text-[#12C6E8]" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold">آخر رقم ممسوح بالسكانر:</span>
                    <div className="font-mono font-black text-slate-900 text-sm">{lastScanned.serial}</div>
                  </div>
                </div>
                <span className="text-slate-400 font-mono text-[10px]">{lastScanned.timestamp}</span>
              </div>
            )}

          </div>

          {/* Scanned Items Table Station */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0F5EA8]" />
                <h3 className="text-sm font-extrabold text-slate-900">جدول الأرقام التسلسلية الممسوحة ضوئياً ({scannedItems.length})</h3>
              </div>

              {scannedItems.length > 0 && (
                <button
                  onClick={() => setScannedItems([])}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                >
                  تفريع القائمة
                </button>
              )}
            </div>

            {scannedItems.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-3">
                <Barcode className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-extrabold text-slate-600">جدول القراءة فارغ حالياً</p>
                <p className="text-xs text-slate-400">قم بقراءة باركود الأجهزة والشرائح لإضافتها في الجدول قبل الاعتماد النهائي</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-3 px-6">#</th>
                      <th className="py-3 px-6">الرقم التسلسلي (SN / ICCID)</th>
                      <th className="py-3 px-6">نوع الصنف</th>
                      <th className="py-3 px-6">توقيت المسح</th>
                      <th className="py-3 px-6 text-center">إزالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                    {scannedItems.map((item, index) => (
                      <tr key={item.serial} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-6 font-mono text-slate-400">{scannedItems.length - index}</td>
                        <td className="py-3.5 px-6 font-mono font-black text-slate-900">{item.serial}</td>
                        <td className="py-3.5 px-6">
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0F5EA8] text-[10px] font-bold">
                            {meta.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 font-mono text-[11px] text-slate-500">{item.timestamp}</td>
                        <td className="py-3.5 px-6 text-center">
                          <button
                            onClick={() => removeItem(item.serial)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="حذف الرقم"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* 3. Bottom Sticky Confirmation Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
        
        <div className="flex items-center gap-4 text-right">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900">جاهزية نقل الحضانة والعهدة</h4>
            <p className="text-xs text-slate-500">تم تجهيز <strong className="text-emerald-600 font-bold">{scannedItems.length}</strong> قطعة ممسوحة للاعتماد وحفظها بعهدتك الرسمية</p>
          </div>
        </div>

        <button
          onClick={handleFinalConfirm}
          disabled={scannedItems.length === 0 || isSubmitting}
          className={`w-full sm:w-auto px-10 py-4 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            scannedItems.length > 0 && !isSubmitting
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-900/20'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>جاري تسجيل ونقل العهدة بالسيرفر...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>تأكيد واعتماد نقل العهدة إلى حسابي النهائي ✓</span>
            </>
          )}
        </button>

      </div>

    </div>
  );
};

// Helper Plus Icon
function PlusIcon(props: any) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
    </svg>
  );
}
