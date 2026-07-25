import React, { useState, useEffect, useRef } from 'react';
import { 
  Scan, 
  CheckCircle2, 
  AlertCircle, 
  PackageCheck, 
  Cpu, 
  Smartphone, 
  ArrowRight, 
  Sparkles,
  Check,
  Send,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { api, WarehouseTransfer } from '../api/client';
import { RasscoLogo } from '../components/RasscoLogo';

interface ShipmentScanPageProps {
  transferId?: string;
  onBack: () => void;
}

export const ShipmentScanPage: React.FC<ShipmentScanPageProps> = ({ transferId, onBack }) => {
  const [transfer, setTransfer] = useState<WarehouseTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'devices' | 'sim'>('devices');
  const [selectedItemTypeId, setSelectedItemTypeId] = useState<string | null>(null);

  // Hardware Scanner State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedItems, setScannedItems] = useState<{ serial: string; category: string; time: string }[]>([]);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-Focus Enforcement
  const enforceFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  useEffect(() => {
    enforceFocus();
    const interval = setInterval(enforceFocus, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (transferId) {
      loadTransferDetails();
    } else {
      // Mock Transfer Data for Web Testing
      setTransfer({
        id: 'trf-1001',
        transferNumber: 'TRF-2026-0892',
        sourceWarehouseName: 'المستودع الرئيسي — الرياض',
        targetWarehouseName: 'عهدة الفني (عيسى)',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 'item-1',
            itemTypeId: 'type-pos-verifone',
            itemTypeName: 'أجهزة POS - Verifone VX680',
            category: 'devices',
            requestedQuantity: 5,
            scannedQuantity: 0,
            scannedSerials: [],
          },
          {
            id: 'item-2',
            itemTypeId: 'type-sim-stc',
            itemTypeName: 'شرائح STC 5G Data',
            category: 'sim',
            requestedQuantity: 10,
            scannedQuantity: 0,
            scannedSerials: [],
          },
        ],
      });
      setLoading(false);
    }
  }, [transferId]);

  const loadTransferDetails = async () => {
    setLoading(true);
    const data = await api.getTransferDetails(transferId!);
    setTransfer(data);
    setLoading(false);
  };

  const playChime = (success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = success ? 880 : 300;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (_) {}
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const serial = barcodeInput.trim();
    if (!serial) return;

    setBarcodeInput('');
    setScanMessage(null);

    // Duplicate Check
    if (scannedItems.some((item) => item.serial === serial)) {
      setScanMessage({ type: 'error', text: `⚠️ السيريال (${serial}) ممسوح سابقاً في هذه الجلسة` });
      playChime(false);
      enforceFocus();
      return;
    }

    // Call API Scan-In or Local Validation
    const res = await api.scanItem(serial, transferId, selectedItemTypeId || undefined);

    if (res.success) {
      const newItem = {
        serial,
        category: selectedCategory,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setScannedItems((prev) => [newItem, ...prev]);

      // Update Local Quantities
      if (transfer) {
        const updatedItems = transfer.items.map((it) => {
          if (it.category === selectedCategory || it.itemTypeId === selectedItemTypeId) {
            return {
              ...it,
              scannedQuantity: Math.min(it.scannedQuantity + 1, it.requestedQuantity),
              scannedSerials: [...it.scannedSerials, serial],
            };
          }
          return it;
        });
        setTransfer({ ...transfer, items: updatedItems });
      }

      setScanMessage({ type: 'success', text: `✅ تم مسح ومطابقة السيريال (${serial}) بنجاح` });
      playChime(true);
    } else {
      setScanMessage({ type: 'error', text: res.message || `⚠️ خطأ في مسح السيريال (${serial})` });
      playChime(false);
    }

    enforceFocus();
  };

  const handleConfirmAccept = async () => {
    if (!transfer) return;
    setAccepting(true);
    const res = await api.acceptTransfer(transfer.id);
    setAccepting(false);
    if (res.success) {
      setCompleted(true);
    } else {
      alert(res.message || 'فشل تأكيد الاستلام');
    }
  };

  const totalRequested = transfer?.items.reduce((sum, item) => sum + item.requestedQuantity, 0) || 0;
  const totalScanned = transfer?.items.reduce((sum, item) => sum + item.scannedQuantity, 0) || scannedItems.length;
  const isMatchComplete = totalRequested > 0 && totalScanned >= totalRequested;
  const overallPercentage = totalRequested > 0 ? Math.round((totalScanned / totalRequested) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] text-slate-900">
        <div className="text-center">
          <Scan className="w-12 h-12 text-[#0F5EA8] animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-bold">جاري تحميل تفاصيل الشحنة والطلب...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900 pb-12" onClick={enforceFocus}>
      
      {/* Top Header Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              title="العودة لجدول الشحنات"
            >
              <ArrowRight className="w-5 h-5" />
            </button>

            <RasscoLogo size="md" subtitle={`استلام الشحنة: ${transfer?.transferNumber || 'جديد'}`} lightMode={true} />
          </div>

          {/* Global Progress Indicator */}
          <div className="flex items-center gap-4 bg-slate-50 p-2.5 px-5 rounded-2xl border border-slate-200">
            <div className="text-right">
              <div className="text-[11px] text-slate-500 font-bold">نسبة المطابقة والكمال</div>
              <div className="text-base font-black text-[#0F5EA8]">
                {totalScanned} / {totalRequested} <span className="text-xs font-bold text-slate-500">({overallPercentage}%)</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#0F5EA8] text-white flex items-center justify-center shadow-xs">
              {isMatchComplete ? (
                <CheckCircle2 className="w-5 h-5 text-[#12C6E8]" />
              ) : (
                <Scan className="w-5 h-5 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Product Selector & Barcode Scanner Workstation (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Step 1: Category Selector */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0F5EA8]" />
              <span>1. اختر نوع المنتج المراد مسحه الآن</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedCategory('devices')}
                className={`p-4 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
                  selectedCategory === 'devices'
                    ? 'bg-blue-50 border-[#0F5EA8] text-[#0F5EA8] shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className={`p-3 rounded-xl ${selectedCategory === 'devices' ? 'bg-[#0F5EA8] text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Cpu className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-sm text-slate-900">أجهزة POS والتطبيقات</div>
                  <div className="text-xs text-slate-500">مسح السيريال (Serial Number)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('sim')}
                className={`p-4 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
                  selectedCategory === 'sim'
                    ? 'bg-blue-50 border-[#0F5EA8] text-[#0F5EA8] shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className={`p-3 rounded-xl ${selectedCategory === 'sim' ? 'bg-[#0F5EA8] text-white' : 'bg-slate-200 text-slate-600'}`}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-sm text-slate-900">شرائح الاتصال (SIM)</div>
                  <div className="text-xs text-slate-500">مسح رقم الـ ICCID</div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Auto-Focus Hardware Barcode Workstation Box */}
          <div className="bg-white p-6 rounded-3xl border-2 border-[#12C6E8] shadow-md relative scan-pulse-ring">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Scan className="w-5 h-5 text-[#0F5EA8]" />
                <span>2. حقل المسح السريع بجهاز USB / Bluetooth Scanner</span>
              </h3>
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F5EA8] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                <span className="w-2 h-2 rounded-full bg-[#12C6E8] animate-ping" />
                <span>التركيز تلقائي الآن (Auto-Focus Active)</span>
              </div>
            </div>

            <form onSubmit={handleScanSubmit} className="space-y-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={selectedCategory === 'devices' ? 'امسح باركود الجهاز هنا...' : 'امسح باركود الشريحة (ICCID)...'}
                  className="w-full py-4 px-5 rounded-2xl rassco-scan-input text-lg font-mono text-slate-900 placeholder-slate-400 font-bold"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute left-3 top-2.5 bottom-2.5 px-6 rounded-xl rassco-btn-primary text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>إدخال</span>
                  <Send className="w-4 h-4 text-[#12C6E8]" />
                </button>
              </div>
            </form>

            {/* Live Feedback Toast Banner */}
            {scanMessage && (
              <div
                className={`mt-4 p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold animate-fade-in ${
                  scanMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {scanMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{scanMessage.text}</span>
              </div>
            )}
          </div>

          {/* Action Step 3: Confirmation Button */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-base font-extrabold text-slate-900">تأكيد الاعتماد والمطابقة النهائي</div>
              <div className="text-xs text-slate-500 mt-1">
                {isMatchComplete ? 'تمت مطابقة جميع عناصر الشحنة بنجاح! جاهز للاعتماد' : 'قم بمسح جميع القطع المطلوبة لتفعيل التأكيد'}
              </div>
            </div>

            <button
              onClick={handleConfirmAccept}
              disabled={accepting || completed}
              className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-base transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer shadow-md ${
                completed
                  ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                  : isMatchComplete
                  ? 'rassco-btn-primary scale-105 shadow-blue-600/30'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200 cursor-not-allowed'
              }`}
            >
              {completed ? (
                <>
                  <Check className="w-5 h-5 text-[#12C6E8]" />
                  <span>تم استلام الشحنة بنجاح ✅</span>
                </>
              ) : accepting ? (
                <span>جاري إرسال الاعتماد...</span>
              ) : (
                <>
                  <PackageCheck className="w-5 h-5 text-[#12C6E8]" />
                  <span>تأكيد الاستلام</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Quantity Matcher & History Log (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quantity Matching Cards */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center justify-between">
              <span>مطابقة كميات الشحنة الحالية</span>
              <span className="text-xs font-bold text-[#0F5EA8]">RASSCO Live Matching</span>
            </h3>

            <div className="space-y-4">
              {transfer?.items.map((item) => {
                const percent = Math.round((item.scannedQuantity / item.requestedQuantity) * 100);
                const isComplete = item.scannedQuantity >= item.requestedQuantity;

                return (
                  <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-slate-900">{item.itemTypeName}</span>
                      <span className={`text-xs font-black px-3 py-1 rounded-full ${isComplete ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                        {item.scannedQuantity} / {item.requestedQuantity}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-[#0F5EA8]'}`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                    <div className="text-left text-[10px] font-bold text-slate-500 mt-1">
                      {percent}% مكتمل
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scanned Items Log */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-900">سجل القطع الممسوحة مؤخراً</h3>
              <span className="text-xs font-bold text-[#0F5EA8]">{scannedItems.length} عنصر</span>
            </div>

            {scannedItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                لم يتم مسح أي قطع بعد. استخدم جهاز السكانر لبدء المسح.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="font-mono text-[#0F5EA8] font-black">{item.serial}</span>
                    </div>
                    <span className="text-slate-500 font-semibold">{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};
