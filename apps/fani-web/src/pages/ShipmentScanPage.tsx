import React, { useState, useEffect, useRef } from 'react';
import { 
  Scan, 
  CheckCircle2, 
  AlertCircle, 
  PackageCheck, 
  Cpu, 
  Smartphone, 
  ArrowRight, 
  RotateCcw, 
  Sparkles,
  Volume2,
  Check,
  Send
} from 'lucide-react';
import { api, WarehouseTransfer, TransferItem } from '../api/client';

interface ShipmentScanPageProps {
  transferId?: string;
  onBack: () => void;
}

export const ShipmentScanPage: React.FC<ShipmentScanPageProps> = ({ transferId, onBack }) => {
  const [transfer, setTransfer] = useState<WarehouseTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'devices' | 'sim'>('devices');
  const [selectedItemTypeId, setSelectedItemTypeId] = useState<string | null>(null);

  // Scanner State
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
      // Demo Transfer Mock for Web Testing
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
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1322] text-white">
        <div className="text-center">
          <Scan className="w-12 h-12 text-teal-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300 font-medium">جاري تحميل تفاصيل الشحنة والطلب...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1322] text-slate-100 p-4 sm:p-6 lg:p-8" onClick={enforceFocus}>
      {/* Top Header Navigation */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-white">استلام الشحنة وتتبع المسح الضوئي</h1>
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
                {transfer?.transferNumber || 'طلب جديد'}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              من: {transfer?.sourceWarehouseName} ⬅️ إلى: {transfer?.targetWarehouseName}
            </p>
          </div>
        </div>

        {/* Global Progress Badge */}
        <div className="hidden sm:flex items-center gap-4 bg-slate-900/80 p-3 px-5 rounded-2xl border border-slate-800">
          <div className="text-right">
            <div className="text-xs text-slate-400 font-semibold">إجمالي مطابقة الشحنة</div>
            <div className="text-lg font-extrabold text-white">
              {totalScanned} / {totalRequested} <span className="text-xs font-normal text-slate-400">قطعة</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            {isMatchComplete ? (
              <CheckCircle2 className="w-6 h-6 text-teal-400" />
            ) : (
              <Scan className="w-6 h-6 text-cyan-400 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Product Selection & Hardware Scanner Box (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Step 1: Product Category Selector */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>1. تحديد نوع المنتج المراد مسحه</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedCategory('devices')}
                className={`p-4 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
                  selectedCategory === 'devices'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`p-3 rounded-xl ${selectedCategory === 'devices' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  <Cpu className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">أجهزة POS والتطبيقات</div>
                  <div className="text-xs text-slate-400">مسح السيريال (Serial Number)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('sim')}
                className={`p-4 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
                  selectedCategory === 'sim'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`p-3 rounded-xl ${selectedCategory === 'sim' ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">شرائح الاتصال (SIM)</div>
                  <div className="text-xs text-slate-400">مسح رقم الـ ICCID</div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Auto-Focus Hardware Barcode Input Box */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800 relative scan-pulse">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Scan className="w-5 h-5 text-teal-400" />
                <span>2. شاشة المسح الفوري بجهاز USB / Bluetooth Scanner</span>
              </h3>
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
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
                  className="w-full py-5 px-6 rounded-2xl glass-input text-xl font-mono text-cyan-300 placeholder-slate-500 border-2 border-cyan-500/40 focus:border-cyan-400 shadow-inner"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute left-3 top-3 bottom-3 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <span>إدخال</span>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Live Feedback Toast Banner */}
            {scanMessage && (
              <div
                className={`mt-4 p-4 rounded-2xl border flex items-center gap-3 text-sm font-medium animate-fade-in ${
                  scanMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {scanMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span>{scanMessage.text}</span>
              </div>
            )}
          </div>

          {/* Action Step 3: Confirmation Button */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">تأكيد الاعتماد والمطابقة النهائي</div>
              <div className="text-xs text-slate-400 mt-1">
                {isMatchComplete ? 'تمت مطابقة جميع عناصر الشحنة بنجاح! جاهز للاعتمد' : 'قم بمسح جميع القطع المطلوبة لتفعيل التأكيد'}
              </div>
            </div>

            <button
              onClick={handleConfirmAccept}
              disabled={accepting || completed}
              className={`px-8 py-4 rounded-2xl font-extrabold text-sm transition-all duration-300 flex items-center gap-3 cursor-pointer shadow-xl ${
                completed
                  ? 'bg-emerald-500 text-slate-950'
                  : isMatchComplete
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 scale-105'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {completed ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>تم استلام الشحنة بنجاح ✅</span>
                </>
              ) : accepting ? (
                <span>جاري إرسال الاعتماد...</span>
              ) : (
                <>
                  <PackageCheck className="w-5 h-5" />
                  <span>تأكيد الاستلام</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Quantity Match & Scanned History (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quantity Matching Cards */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center justify-between">
              <span>مطابقة كميات الشحنة الحالية</span>
              <span className="text-xs font-normal text-slate-400">Live Matching</span>
            </h3>

            <div className="space-y-4">
              {transfer?.items.map((item) => {
                const percent = Math.round((item.scannedQuantity / item.requestedQuantity) * 100);
                const isComplete = item.scannedQuantity >= item.requestedQuantity;

                return (
                  <div key={item.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-white">{item.itemTypeName}</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isComplete ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                        {item.scannedQuantity} / {item.requestedQuantity}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scanned Serials History List */}
          <div className="glass-card p-6 rounded-3xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-300">سجل القطع الممسوحة مؤخراً</h3>
              <span className="text-xs text-slate-500">{scannedItems.length} عنصر</span>
            </div>

            {scannedItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                لم يتم مسح أي قطع بعد. استخدم جهاز السكانر لبدء المسح.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-mono text-cyan-300 font-semibold">{item.serial}</span>
                    </div>
                    <span className="text-slate-500">{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
