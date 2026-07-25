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
  Layers,
  Info,
  Radio,
  HardDrive
} from 'lucide-react';
import { api, WarehouseTransfer, TransferItem } from '../api/client';
import { RasscoLogo } from '../components/RasscoLogo';

interface ShipmentScanPageProps {
  transferId?: string;
  onBack: () => void;
}

// Professional Metadata & Visual Mapping for POS Devices & SIM Cards
interface ItemMeta {
  name: string;
  categoryName: string;
  category: 'devices' | 'sim' | 'accessories';
  manufacturer: string;
  barcodeFormat: string;
  iconType: 'pos' | 'sim' | 'box';
  themeColor: string;
  badgeBg: string;
}

const getItemMetadata = (itemTypeKey: string): ItemMeta => {
  const key = (itemTypeKey || '').trim();

  if (key.toUpperCase().includes('A960')) {
    return {
      name: 'جهاز POS — PAX A960 Smart',
      categoryName: 'أجهزة نقاط البيع ذكية (Android)',
      category: 'devices',
      manufacturer: 'PAX Technology — Touch & Printer',
      barcodeFormat: 'السيريال عالي الدقة (SN: 8-12 رقم)',
      iconType: 'pos',
      themeColor: '#0F5EA8',
      badgeBg: 'bg-blue-50 text-[#0F5EA8] border-blue-200',
    };
  }

  if (key.toLowerCase().includes('verifone') || key.toLowerCase().includes('vx680')) {
    return {
      name: 'جهاز POS — Verifone VX680',
      categoryName: 'أجهزة نقاط البيع المحمولة',
      category: 'devices',
      manufacturer: 'Verifone Systems Inc.',
      barcodeFormat: 'سيريال الجهاز الخلفي (S/N)',
      iconType: 'pos',
      themeColor: '#0F5EA8',
      badgeBg: 'bg-blue-50 text-[#0F5EA8] border-blue-200',
    };
  }

  if (key.toLowerCase().includes('i9100') || key.toLowerCase().includes('i9000')) {
    return {
      name: 'جهاز POS — Urovo i9100 / i9000s',
      categoryName: 'أجهزة نقاط البيع الذكية',
      category: 'devices',
      manufacturer: 'Urovo Payment Systems',
      barcodeFormat: 'سيريال أسفل البطارية (SN)',
      iconType: 'pos',
      themeColor: '#0F5EA8',
      badgeBg: 'bg-blue-50 text-[#0F5EA8] border-blue-200',
    };
  }

  if (key.toLowerCase().includes('stc')) {
    return {
      name: 'شريحة اتصال — STC 5G Data SIM',
      categoryName: 'شرائح الاتصال والبيانات',
      category: 'sim',
      manufacturer: 'شركة الاتصالات السعودية (STC)',
      barcodeFormat: 'باركود الـ ICCID (يبدأ بـ 89966...)',
      iconType: 'sim',
      themeColor: '#16A34A',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }

  if (key.toLowerCase().includes('mobily')) {
    return {
      name: 'شريحة اتصال — Mobily Business SIM',
      categoryName: 'شرائح الاتصال والبيانات',
      category: 'sim',
      manufacturer: 'شركة موبايلي (Mobily)',
      barcodeFormat: 'باركود الـ ICCID (يبدأ بـ 89966...)',
      iconType: 'sim',
      themeColor: '#0284C7',
      badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
    };
  }

  if (key.toLowerCase().includes('zain')) {
    return {
      name: 'شريحة اتصال — Zain M2M Data SIM',
      categoryName: 'شرائح الاتصال والبيانات',
      category: 'sim',
      manufacturer: 'شركة زين السعودية (Zain)',
      barcodeFormat: 'باركود الـ ICCID (يبدأ بـ 89966...)',
      iconType: 'sim',
      themeColor: '#7C3AED',
      badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    };
  }

  // Fallback for custom device names
  return {
    name: `صنف — ${key || 'أجهزة ومستلزمات'}`,
    categoryName: 'مستلزمات وأجهزة مخزنية',
    category: key.toLowerCase().includes('sim') ? 'sim' : 'devices',
    manufacturer: 'نظام RASSCO للمخزون والعهدة',
    barcodeFormat: 'باركود أو سيريال القطعة',
    iconType: key.toLowerCase().includes('sim') ? 'sim' : 'pos',
    themeColor: '#0F5EA8',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-200',
  };
};

export const ShipmentScanPage: React.FC<ShipmentScanPageProps> = ({ transferId, onBack }) => {
  const [transfer, setTransfer] = useState<WarehouseTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItemTypeId, setSelectedItemTypeId] = useState<string | null>(null);

  // Hardware Scanner State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedItems, setScannedItems] = useState<{ serial: string; itemTypeName: string; time: string }[]>([]);
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
    loadTransferData();
  }, [transferId]);

  const loadTransferData = async () => {
    setLoading(true);

    if (transferId) {
      const data: any = await api.getTransferDetails(transferId);
      if (data) {
        // Normalize Items from backend record
        let normalizedItems: TransferItem[] = [];
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          normalizedItems = data.items;
        } else {
          const itemMeta = getItemMetadata(data.itemType || 'A960');
          normalizedItems = [
            {
              id: 'item-main',
              itemTypeId: data.itemType || 'A960',
              itemTypeName: itemMeta.name,
              category: itemMeta.category,
              requestedQuantity: Number(data.quantity) || 1,
              scannedQuantity: 0,
              scannedSerials: [],
            },
          ];
        }

        const normTransfer: WarehouseTransfer = {
          id: data.id || transferId,
          transferNumber: `TRF-${(data.id || transferId).substring(0, 8).toUpperCase()}`,
          sourceWarehouseName: data.warehouseName || 'المستودع الرئيسي',
          targetWarehouseName: data.technicianName || 'عهدة الفني',
          status: (data.status || 'PENDING').toUpperCase() as any,
          createdAt: data.createdAt || new Date().toISOString(),
          items: normalizedItems,
        };

        setTransfer(normTransfer);
        setSelectedItemTypeId(normalizedItems[0]?.itemTypeId || 'A960');
      }
    } else {
      // Demo Transfer Data for Web Testing with full visual metadata
      const demoItems: TransferItem[] = [
        {
          id: 'item-1',
          itemTypeId: 'A960',
          itemTypeName: 'جهاز POS — PAX A960 Smart',
          category: 'devices',
          requestedQuantity: 3,
          scannedQuantity: 0,
          scannedSerials: [],
        },
        {
          id: 'item-2',
          itemTypeId: 'stcSim',
          itemTypeName: 'شريحة اتصال — STC 5G Data SIM',
          category: 'sim',
          requestedQuantity: 10,
          scannedQuantity: 0,
          scannedSerials: [],
        },
      ];

      setTransfer({
        id: 'trf-demo-1001',
        transferNumber: 'TRF-DEMO-892',
        sourceWarehouseName: 'المستودع الرئيسي — الرياض',
        targetWarehouseName: 'عهدة الفني (عيسى)',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        items: demoItems,
      });
      setSelectedItemTypeId('A960');
    }

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

  const selectedItemObj = transfer?.items.find((it) => it.itemTypeId === selectedItemTypeId) || transfer?.items[0];
  const activeMeta = getItemMetadata(selectedItemObj?.itemTypeId || selectedItemObj?.itemTypeName || 'A960');

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
        itemTypeName: activeMeta.name,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };

      setScannedItems((prev) => [newItem, ...prev]);

      // Update Local Quantities for the Selected Item Model
      if (transfer && selectedItemObj) {
        const updatedItems = transfer.items.map((it) => {
          if (it.itemTypeId === selectedItemObj.itemTypeId) {
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

      setScanMessage({ type: 'success', text: `✅ تم مسح ومطابقة (${serial}) لصنف [${activeMeta.name}] بنجاح` });
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
  const totalScanned = transfer?.items.reduce((sum, item) => sum + item.scannedQuantity, 0) || 0;
  const isMatchComplete = totalRequested > 0 && totalScanned >= totalRequested;
  const overallPercentage = totalRequested > 0 ? Math.round((totalScanned / totalRequested) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] text-slate-900">
        <div className="text-center">
          <Scan className="w-12 h-12 text-[#0F5EA8] animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-bold">جاري تحميل تفاصيل الشحنة وصور الأصناف...</p>
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

            <RasscoLogo size="md" subtitle={`مطابقة استلام الشحنة: ${transfer?.transferNumber || 'جديد'}`} lightMode={true} />
          </div>

          {/* Global Progress Indicator */}
          <div className="flex items-center gap-4 bg-slate-50 p-2.5 px-5 rounded-2xl border border-slate-200">
            <div className="text-right">
              <div className="text-[11px] text-slate-500 font-bold">إجمالي قطع الشحنة</div>
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
        
        {/* Left Column: Device & SIM Visual Selector + Barcode Scanner Workstation (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Step 1: Professional Visual Item Card Selector */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <h3 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0F5EA8]" />
                <span>1. حدد الصنف المني لمسحه الآن (عرض صور وتفاصيل الأصناف)</span>
              </span>
              <span className="text-[11px] font-extrabold text-[#0F5EA8]">
                المصنع: {activeMeta.manufacturer}
              </span>
            </h3>

            {/* Grid of Visual Item Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {transfer?.items.map((item) => {
                const meta = getItemMetadata(item.itemTypeId || item.itemTypeName);
                const isSelected = item.itemTypeId === selectedItemTypeId;
                const isItemDone = item.scannedQuantity >= item.requestedQuantity;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemTypeId(item.itemTypeId)}
                    className={`p-4 rounded-2xl border text-right transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 border-[#0F5EA8] shadow-md ring-2 ring-[#0F5EA8]/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {/* Top Row: Icon + Category Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs ${meta.iconType === 'sim' ? 'bg-emerald-600' : 'bg-[#0F5EA8]'}`}>
                        {meta.iconType === 'sim' ? (
                          <Radio className="w-6 h-6" />
                        ) : (
                          <Cpu className="w-6 h-6" />
                        )}
                      </div>

                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${meta.badgeBg}`}>
                        {meta.categoryName}
                      </span>
                    </div>

                    {/* Item Title & Specs */}
                    <div className="space-y-1">
                      <h4 className="font-black text-sm text-slate-900">{meta.name}</h4>
                      <p className="text-[11px] font-semibold text-slate-500">{meta.manufacturer}</p>
                    </div>

                    {/* Quantity & Barcode Format Hint */}
                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">{meta.barcodeFormat}</span>
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${isItemDone ? 'bg-emerald-100 text-emerald-800' : 'bg-[#0F5EA8] text-white'}`}>
                        {item.scannedQuantity} / {item.requestedQuantity} قطعة
                      </span>
                    </div>

                    {isItemDone && (
                      <div className="absolute top-2 left-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Auto-Focus Hardware Barcode Workstation Box */}
          <div className="bg-white p-6 rounded-3xl border-2 border-[#12C6E8] shadow-md relative scan-pulse-ring">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Scan className="w-5 h-5 text-[#0F5EA8]" />
                <span>2. مسح باركود صنف [{activeMeta.name}]</span>
              </h3>
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F5EA8] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                <span className="w-2 h-2 rounded-full bg-[#12C6E8] animate-ping" />
                <span>التركيز تلقائي (Auto-Focus Active)</span>
              </div>
            </div>

            {/* Helper Info Tag */}
            <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Info className="w-4 h-4 text-[#0F5EA8] shrink-0" />
              <span>صيغة الباركود المتوقعة: <strong className="text-slate-900 font-mono">{activeMeta.barcodeFormat}</strong></span>
            </div>

            <form onSubmit={handleScanSubmit} className="space-y-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={`امسح باركود ${activeMeta.name} هنا...`}
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
                {isMatchComplete ? 'تمت مطابقة جميع قطع الشحنة بنجاح! جاهز للاعتماد' : 'قم بمسح جميع القطع لجميع الأصناف لتفعيل التأكيد'}
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

        {/* Right Column: Detailed Specific Item Quantities & Scan Log (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quantity Matching Cards */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center justify-between">
              <span>مطابقة كميات الأصناف بالتفصيل</span>
              <span className="text-xs font-bold text-[#0F5EA8]">Itemized Matching</span>
            </h3>

            <div className="space-y-4">
              {transfer?.items.map((item) => {
                const meta = getItemMetadata(item.itemTypeId || item.itemTypeName);
                const percent = Math.round((item.scannedQuantity / item.requestedQuantity) * 100);
                const isComplete = item.scannedQuantity >= item.requestedQuantity;
                const isSelected = item.itemTypeId === selectedItemTypeId;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemTypeId(item.itemTypeId)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected ? 'bg-blue-50/70 border-[#0F5EA8]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-slate-900">{meta.name}</span>
                      <span className={`text-xs font-black px-3 py-0.5 rounded-full ${isComplete ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                        {item.scannedQuantity} / {item.requestedQuantity} قطعة
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-[#0F5EA8]'}`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scanned Items Log with Item Model Name */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-900">سجل القطع الممسوحة في الجلسة</h3>
              <span className="text-xs font-bold text-[#0F5EA8]">{scannedItems.length} عنصر</span>
            </div>

            {scannedItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                لم يتم مسح أي قطع بعد. استخدم جهاز السكانر لبدء مسح الأجهزة والشرائح.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="font-mono text-[#0F5EA8] font-black">{item.serial}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5 mr-4">
                        {item.itemTypeName}
                      </div>
                    </div>
                    <span className="text-slate-400 font-semibold text-[11px]">{item.time}</span>
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
