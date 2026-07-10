import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  AlertTriangle,
  Cpu,
  Download,
  Info,
  Loader2,
  QrCode,
  ScanLine,
  Send,
  ShieldCheck,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";

type ItemTypeInfo = {
  id: string;
  nameAr: string;
};

type WarehouseRecord = {
  id: string;
  name?: string;
  nameAr?: string;
  regionId?: string | null;
};

type RegionRecord = {
  id: string;
  name: string;
};

type SerialTrackingRecord = {
  id: string;
  serialNumber: string;
};

type SessionRow = {
  id: string;
  serialNumber: string;
  createdAt: string;
  status: "verified" | "duplicate" | "saved" | "error";
  message: string;
};

type LiveLog = {
  id: string;
  level: "system" | "success" | "error";
  message: string;
};

const fetchJson = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
};

const fetchArray = async <T,>(url: string): Promise<T[]> => {
  const payload = await fetchJson(url);
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
};

export default function ProductSmartAddPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [serialInput, setSerialInput] = useState("");
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [logs, setLogs] = useState<LiveLog[]>([
    { id: "log-1", level: "system", message: "تم بدء جلسة التحقق الذكي..." },
    { id: "log-2", level: "system", message: "بانتظار المسح..." },
  ]);
  const [duplicatePreview, setDuplicatePreview] = useState<string | null>(null);

  const itemTypeQuery = useQuery<ItemTypeInfo>({
    queryKey: [id ? `/api/item-types/${id}` : ""],
    enabled: !!id,
  });

  const serialTrackingQuery = useQuery<SerialTrackingRecord[]>({
    queryKey: [id ? `/api/item-types/${id}/serial-tracking` : ""],
    enabled: !!id,
  });

  const warehousesQuery = useQuery<WarehouseRecord[]>({
    queryKey: ["smart-add", "warehouses", user?.role],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      if (user.role === "admin") {
        return fetchArray<WarehouseRecord>("/api/warehouses");
      }
      if (user.role === "supervisor") {
        return fetchArray<WarehouseRecord>("/api/supervisor/warehouses");
      }
      return [];
    },
  });

  const regionsQuery = useQuery<RegionRecord[]>({
    queryKey: ["/api/regions"],
    enabled: !!user,
  });

  const selectedWarehouse = useMemo(
    () => (warehousesQuery.data ?? []).find((warehouse) => warehouse.id === destinationWarehouseId),
    [warehousesQuery.data, destinationWarehouseId]
  );

  const existingSerialSet = useMemo(
    () => new Set((serialTrackingQuery.data ?? []).map((row) => String(row.serialNumber || "").trim().toUpperCase())),
    [serialTrackingQuery.data]
  );

  const sessionUniqueSerialSet = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (row.status === "verified" || row.status === "saved") {
        set.add(row.serialNumber.toUpperCase());
      }
    });
    return set;
  }, [rows]);

  const uniqueCount = rows.filter((row) => row.status === "verified" || row.status === "saved").length;
  const duplicateCount = rows.filter((row) => row.status === "duplicate").length;
  const pendingRows = rows.filter((row) => row.status === "verified");
  const previewRows = rows.filter((row) => row.status !== "duplicate");

  const previewPageSize = 8;
  const previewTotalPages = Math.max(1, Math.ceil(previewRows.length / previewPageSize));
  const safePreviewPage = Math.min(previewPage, previewTotalPages);
  const previewFrom = previewRows.length === 0 ? 0 : (safePreviewPage - 1) * previewPageSize + 1;
  const previewTo = Math.min(safePreviewPage * previewPageSize, previewRows.length);
  const previewPageRows = previewRows.slice((safePreviewPage - 1) * previewPageSize, safePreviewPage * previewPageSize);

  const destinationRegionId = selectedWarehouse?.regionId || user?.regionId || null;
  const destinationRegionName = useMemo(() => {
    if (!destinationRegionId) {
      return "-";
    }
    const region = (regionsQuery.data ?? []).find((item) => item.id === destinationRegionId);
    return region?.name || destinationRegionId;
  }, [destinationRegionId, regionsQuery.data]);

  const addLog = (level: LiveLog["level"], message: string) => {
    setLogs((previous) => [{ id: `log-${Date.now()}-${Math.random()}`, level, message }, ...previous].slice(0, 12));
  };

  const appendScannedSerial = () => {
    const normalized = serialInput.trim().toUpperCase();
    if (!normalized) return;

    const isDuplicate = existingSerialSet.has(normalized) || sessionUniqueSerialSet.has(normalized);
    const createdAt = new Date().toISOString();

    if (isDuplicate) {
      setRows((previous) => [
        {
          id: `dup-${Date.now()}`,
          serialNumber: normalized,
          createdAt,
          status: "duplicate",
          message: "هذا الرقم مسجل بالفعل في النظام.",
        },
        ...previous,
      ]);
      addLog("error", `فشل التحقق: ${normalized} - عذراً، هذا الرقم مسجل بالفعل.`);
      setDuplicatePreview(normalized);
      setTimeout(() => setDuplicatePreview(null), 1800);
      setSerialInput("");
      return;
    }

    setRows((previous) => [
      {
        id: `ok-${Date.now()}`,
        serialNumber: normalized,
        createdAt,
        status: "verified",
        message: "تمت الإضافة لقائمة الانتظار بنجاح",
      },
      ...previous,
    ]);
    addLog("success", `تم التحقق: ${normalized} - تمت الإضافة لقائمة الانتظار.`);
    setSerialInput("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !id) {
        throw new Error("بيانات المستخدم أو المنتج غير متوفرة.");
      }

      if (pendingRows.length === 0) {
        throw new Error("لا توجد أجهزة جاهزة للحفظ.");
      }

      let successCount = 0;
      let failedCount = 0;

      for (let index = 0; index < pendingRows.length; index += 1) {
        const row = pendingRows[index];
        const serialSuffix = row.serialNumber.replace(/\s+/g, "").slice(-10);
        const terminalId = `IT-${id.toUpperCase()}-${serialSuffix || `${Date.now()}${index}`.slice(-10)}`;

        try {
          await apiRequest("POST", "/api/received-devices", {
            technicianId: user.id,
            supervisorId: user.role === "supervisor" ? user.id : null,
            itemTypeId: id,
            terminalId,
            serialNumber: row.serialNumber,
            battery: false,
            chargerCable: false,
            chargerHead: false,
            hasSim: false,
            simCardType: null,
            damagePart: "",
            regionId: selectedWarehouse?.regionId || user.regionId || null,
          });

          successCount += 1;
          setRows((previous) =>
            previous.map((record) =>
              record.id === row.id
                ? { ...record, status: "saved", message: "تم حفظ السيريال بنجاح" }
                : record
            )
          );
        } catch {
          failedCount += 1;
          setRows((previous) =>
            previous.map((record) =>
              record.id === row.id
                ? { ...record, status: "error", message: "فشل حفظ السيريال، حاول مرة أخرى" }
                : record
            )
          );
        }
      }

      return { successCount, failedCount };
    },
    onSuccess: ({ successCount, failedCount }) => {
      queryClient.invalidateQueries({ queryKey: [id ? `/api/item-types/${id}/serial-tracking` : ""] });
      toast({
        title: "تم إنهاء الحفظ",
        description: `تم حفظ ${successCount} سيريال${failedCount ? `، وفشل ${failedCount}` : ""}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "تعذر حفظ الجلسة",
        description: error?.message || "حدث خطأ أثناء حفظ الأجهزة.",
        variant: "destructive",
      });
    },
  });

  const exportPreviewToExcel = async () => {
    if (!itemTypeQuery.data || previewRows.length === 0) {
      toast({
        title: "لا توجد بيانات للتصدير",
        description: "أضف بيانات أولاً ثم افتح المعاينة للتصدير.",
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    const productName = itemTypeQuery.data?.nameAr || "-";
    const warehouseName = selectedWarehouse?.nameAr || selectedWarehouse?.name || "-";

    const mapStatus = (status: SessionRow["status"]) => {
      if (status === "saved") return "تم الحفظ";
      if (status === "verified") return "جاهز للحفظ";
      if (status === "error") return "فشل الحفظ";
      return "مكرر";
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "StockPro";
    workbook.lastModifiedBy = user?.fullName || user?.username || "StockPro";
    workbook.created = now;
    workbook.modified = now;

    const worksheet = workbook.addWorksheet("StockPro Preview");

    worksheet.columns = [
      { key: "index", width: 8 },
      { key: "serialNumber", width: 26 },
      { key: "productName", width: 22 },
      { key: "regionName", width: 20 },
      { key: "warehouseName", width: 28 },
      { key: "scannedAt", width: 16 },
      { key: "status", width: 18 },
    ];

    worksheet.views = [{ rightToLeft: true, state: "frozen", ySplit: 8 }];
    worksheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    };

    worksheet.mergeCells("A1:G1");
    worksheet.getCell("A1").value = "StockPro | معاينة تقرير الإضافة الفوري";
    worksheet.getCell("A1").font = { name: "Arial", bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells("A2:G2");
    worksheet.getCell("A2").value = `تاريخ التصدير: ${now.toLocaleDateString("en-GB")} | ${now.toLocaleTimeString("en-US")}`;
    worksheet.getCell("A2").font = { name: "Arial", size: 11, color: { argb: "FFCBD5E1" } };
    worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell("A2").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    worksheet.getRow(2).height = 22;

    worksheet.getCell("A4").value = "إجمالي الأجهزة";
    worksheet.getCell("D4").value = "تاريخ العملية";
    worksheet.getCell("A5").value = "المنتج";
    worksheet.getCell("D5").value = "المنطقة";
    worksheet.getCell("A6").value = "المستودع الوجهة";
    worksheet.getCell("D6").value = "حالة التقرير";

    worksheet.mergeCells("B4:C4");
    worksheet.mergeCells("E4:G4");
    worksheet.mergeCells("B5:C5");
    worksheet.mergeCells("E5:G5");
    worksheet.mergeCells("B6:C6");
    worksheet.mergeCells("E6:G6");

    worksheet.getCell("B4").value = `${previewRows.length} قطعة`;
    worksheet.getCell("E4").value = now.toLocaleDateString("en-GB");
    worksheet.getCell("B5").value = productName;
    worksheet.getCell("E5").value = destinationRegionName;
    worksheet.getCell("B6").value = warehouseName;
    worksheet.getCell("E6").value = "جاهز للتصدير";

    ["A4", "D4", "A5", "D5", "A6", "D6"].forEach((ref) => {
      const cell = worksheet.getCell(ref);
      cell.font = { name: "Arial", bold: true, size: 11, color: { argb: "FFE2E8F0" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FF475569" } },
        left: { style: "thin", color: { argb: "FF475569" } },
        bottom: { style: "thin", color: { argb: "FF475569" } },
        right: { style: "thin", color: { argb: "FF475569" } },
      };
    });

    ["B4", "E4", "B5", "E5", "B6", "E6"].forEach((ref) => {
      const cell = worksheet.getCell(ref);
      cell.font = {
        name: "Arial",
        bold: ref === "E6",
        size: ref === "E6" ? 12 : 11,
        color: { argb: ref === "E6" ? "FF10B77F" : "FFFFFFFF" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FF475569" } },
        left: { style: "thin", color: { argb: "FF475569" } },
        bottom: { style: "thin", color: { argb: "FF475569" } },
        right: { style: "thin", color: { argb: "FF475569" } },
      };
    });

    const headerRowIndex = 8;
    const headers = ["م", "السيريال نمبر", "اسم المنتج", "المنطقة", "المستودع", "توقيت المسح", "الحالة"];
    worksheet.getRow(headerRowIndex).values = headers;

    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10B77F" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FF0B7A56" } },
        left: { style: "thin", color: { argb: "FF0B7A56" } },
        bottom: { style: "thin", color: { argb: "FF0B7A56" } },
        right: { style: "thin", color: { argb: "FF0B7A56" } },
      };
    });

    previewRows.forEach((row, index) => {
      const rowIndex = headerRowIndex + 1 + index;
      const excelRow = worksheet.getRow(rowIndex);
      excelRow.values = [
        index + 1,
        row.serialNumber,
        productName,
        destinationRegionName,
        warehouseName,
        new Date(row.createdAt).toLocaleTimeString("en-US"),
        mapStatus(row.status),
      ];
      excelRow.height = 22;

      const isEven = index % 2 === 0;
      excelRow.eachCell((cell, colNumber) => {
        cell.font = {
          name: colNumber === 2 ? "Consolas" : "Arial",
          bold: colNumber === 2,
          size: 10,
          color: { argb: colNumber === 2 ? "FF10B77F" : "FFE2E8F0" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? "FF0F172A" : "FF1E293B" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF334155" } },
          left: { style: "thin", color: { argb: "FF334155" } },
          bottom: { style: "thin", color: { argb: "FF334155" } },
          right: { style: "thin", color: { argb: "FF334155" } },
        };
      });
    });

    const lastDataRowIndex = headerRowIndex + previewRows.length;
    worksheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: 7 },
    };

    const noteRowIndex = lastDataRowIndex + 2;
    worksheet.mergeCells(`A${noteRowIndex}:G${noteRowIndex}`);
    const noteCell = worksheet.getCell(`A${noteRowIndex}`);
    noteCell.value = "الملف مجهز بتنسيق محاسبي متقدم (XLSX) - StockPro";
    noteCell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FF93C5FD" } };
    noteCell.alignment = { horizontal: "center", vertical: "middle" };
    noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172554" } };
    worksheet.getRow(noteRowIndex).height = 20;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `معاينة_الإضافة_${itemTypeQuery.data.id}_${new Date().toISOString().slice(0, 10)}.xlsx`);

    toast({
      title: "تم تنزيل الملف",
      description: "تم تنزيل ملف Excel المنسق بنجاح.",
    });
  };

  const loading = itemTypeQuery.isLoading || warehousesQuery.isLoading || serialTrackingQuery.isLoading;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-300 gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>جاري تحميل مركز الإضافة الذكية...</span>
      </div>
    );
  }

  const itemType = itemTypeQuery.data;

  return (
    <div className="space-y-6 pb-28">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">مركز المسح والتحقق الذكي</h2>
          <p className="text-xs text-slate-400 mt-1">نظام إضافة الأجهزة المجمع بمنع التكرار</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 bg-slate-800/70 px-4 py-2 rounded-xl border border-slate-700">
            <div className="text-center border-l border-slate-700 pl-4">
              <p className="text-[10px] text-slate-400 uppercase">الأجهزة الفريدة</p>
              <p className="text-xl font-bold text-cyan-400">{uniqueCount}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase">التكرارات الممنوعة</p>
              <p className="text-xl font-bold text-rose-500">{duplicateCount}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="border-slate-700 bg-slate-800/70 text-slate-100">
            <Link href={`/products-management/${id}/details`}>الرجوع للتفاصيل</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 flex items-end justify-between gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          <div className="space-y-2">
            <label className="text-xs text-slate-400">المنتج المستهدف</label>
            <div className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-semibold">
              {itemType?.nameAr || "-"}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-400">المستودع الوجهة</label>
            <select
              value={destinationWarehouseId}
              onChange={(event) => setDestinationWarehouseId(event.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
            >
              <option value="">اختر المستودع...</option>
              {(warehousesQuery.data ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.nameAr || warehouse.name || "مستودع"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRows([]);
              setLogs([
                { id: `log-reset-${Date.now()}`, level: "system", message: "تمت إعادة ضبط الجلسة." },
                { id: `log-wait-${Date.now() + 1}`, level: "system", message: "بانتظار المسح..." },
              ]);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-sm hover:bg-slate-700"
          >
            إعادة ضبط
          </button>
          <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            الجلسة نشطة
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 rounded-3xl border border-cyan-400/40 bg-slate-900/70 p-4 relative overflow-hidden">
          <div className="aspect-video rounded-2xl border border-cyan-400/60 bg-slate-950/70 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-700/10" />
            <div className="w-64 h-44 border-2 border-cyan-400/50 rounded-xl relative flex items-center justify-center">
              <ScanLine className="h-10 w-10 text-cyan-300" />
              <div className="absolute h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
            </div>

            {duplicatePreview && (
              <div className="absolute inset-0 bg-rose-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
                <AlertTriangle className="h-16 w-16 text-rose-400 mb-3" />
                <p className="text-xl font-bold text-white">تنبيه: السيريال مكرر</p>
                <p className="text-rose-200 mt-1">{duplicatePreview} مضاف مسبقاً</p>
              </div>
            )}

            <div className="absolute bottom-4 right-4 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-wider text-white flex items-center gap-2">
              <span className="size-2 rounded-full bg-cyan-300" />
              Live Camera Input
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <div className="relative flex-1">
              <Input
                dir="ltr"
                value={serialInput}
                onChange={(event) => setSerialInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    appendScannedSerial();
                  }
                }}
                placeholder="امسح أو أدخل الرقم التسلسلي"
                className="bg-slate-950 border-slate-700 text-white pr-10"
              />
              <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
            <button
              type="button"
              onClick={appendScannedSerial}
              className="px-5 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-700 text-white font-bold"
            >
              إضافة للسجل
            </button>
          </div>
        </div>

        <div className="xl:col-span-5 rounded-3xl border border-slate-700 bg-slate-900/70 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 bg-slate-800/40 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-300" />
              سجل العمليات المباشر
            </h3>
            <span className="text-[10px] text-slate-500">{new Date().toLocaleTimeString("en-US")}</span>
          </div>
          <div className="p-5 space-y-3 max-h-[420px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className={
                  log.level === "success"
                    ? "p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                    : log.level === "error"
                      ? "p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300"
                      : "text-slate-400"
                }
              >
                <p className="text-xs">{log.message}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
          قائمة الأجهزة الموثقة (المسح الحالي)
        </h3>

        <div className="rounded-3xl border border-slate-700 bg-slate-900/60 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-xs text-right border-b border-slate-700">
                <th className="px-6 py-4 font-bold">السيريال نمبر</th>
                <th className="px-6 py-4 font-bold">المنتج</th>
                <th className="px-6 py-4 font-bold">وقت المسح</th>
                <th className="px-6 py-4 font-bold">الحالة</th>
                <th className="px-6 py-4 font-bold text-left">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500 text-sm">
                    لم يتم العثور على سجلات في الجلسة الحالية. قم بمسح المزيد من الأجهزة للبدء.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-mono font-bold text-white">{row.serialNumber}</td>
                    <td className="px-6 py-4 text-slate-300 text-sm">{itemType?.nameAr || "-"}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{new Date(row.createdAt).toLocaleTimeString("en-US")}</td>
                    <td className="px-6 py-4">
                      <span
                        className={
                          row.status === "saved"
                            ? "inline-flex px-3 py-1 rounded-full text-[10px] font-bold border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                            : row.status === "verified"
                              ? "inline-flex px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : row.status === "duplicate"
                                ? "inline-flex px-3 py-1 rounded-full text-[10px] font-bold border border-rose-500/30 bg-rose-500/10 text-rose-300"
                                : "inline-flex px-3 py-1 rounded-full text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300"
                        }
                      >
                        {row.status === "saved"
                          ? "Saved"
                          : row.status === "verified"
                            ? "Verified Unique"
                            : row.status === "duplicate"
                              ? "Duplicate"
                              : "Save Failed"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <button
                        type="button"
                        onClick={() => setRows((previous) => previous.filter((record) => record.id !== row.id))}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="fixed bottom-0 right-0 left-0 md:left-72 h-24 bg-slate-900/70 backdrop-blur-2xl border-t border-slate-700 px-8 flex items-center justify-between z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400 text-sm">الأجهزة الجاهزة للحفظ:</span>
            <span className="text-2xl font-bold text-white">{pendingRows.length}</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" />
            Security Validated
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setPreviewPage(1);
              setIsPreviewOpen(true);
            }}
            className="px-5 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-semibold hover:bg-emerald-500/20 transition-colors"
          >
            عرض البيانات المدخلة
          </button>
          <button
            type="button"
            onClick={() => {
              setRows([]);
              setLogs([
                { id: `log-cancel-${Date.now()}`, level: "system", message: "تم إلغاء الجلسة الحالية." },
                { id: `log-wait-${Date.now() + 1}`, level: "system", message: "بانتظار المسح..." },
              ]);
            }}
            className="px-5 py-3 text-slate-400 hover:text-white"
          >
            إلغاء الجلسة
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || pendingRows.length === 0}
            className="bg-gradient-to-br from-cyan-400 to-blue-700 text-white px-7 py-3 rounded-2xl font-bold flex items-center gap-2 disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>تأكيد وحفظ الأجهزة ({pendingRows.length})</span>
          </button>
        </div>
      </footer>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h2 className="text-3xl font-black text-white mb-2 tracking-tight">معاينة تقرير الإضافة الفوري</h2>
                <p className="text-slate-400">راجع البيانات قبل تصديرها إلى ملف Excel المحاسبي</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="bg-slate-800 text-slate-200 px-6 py-2.5 rounded-lg font-bold hover:bg-slate-700 transition-all inline-flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={exportPreviewToExcel}
                  className="bg-emerald-500 hover:bg-emerald-500/90 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2 transition-all"
                >
                  <Download className="h-4 w-4" />
                  تحميل ملف Excel منسق
                </button>
              </div>
            </div>

            <div className="rounded-2xl p-6 mb-8 grid grid-cols-1 md:grid-cols-4 gap-8 bg-slate-800/60 backdrop-blur-xl border border-slate-700">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">إجمالي الأجهزة</span>
                <span className="text-2xl font-bold text-white">{previewRows.length} قطعة</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">تاريخ العملية</span>
                <span className="text-2xl font-bold text-white">{new Date().toLocaleDateString("en-GB")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">المستودع الوجهة</span>
                <span className="text-xl font-bold text-white">{selectedWarehouse?.nameAr || selectedWarehouse?.name || "-"}</span>
              </div>
              <div className="flex flex-col gap-1 justify-center">
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-2 w-fit shadow-[0_0_15px_rgba(16,183,127,0.25)]">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 text-sm font-bold">جاهز للتصدير</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-300 text-sm font-bold border-b border-slate-700">
                      <th className="px-6 py-4">م</th>
                      <th className="px-6 py-4">السيريال نمبر</th>
                      <th className="px-6 py-4">اسم المنتج</th>
                      <th className="px-6 py-4">المنطقة</th>
                      <th className="px-6 py-4">المستودع</th>
                      <th className="px-6 py-4">توقيت المسح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {previewPageRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-slate-500 text-sm">
                          لا توجد بيانات مدخلة لعرضها في المعاينة.
                        </td>
                      </tr>
                    ) : (
                      previewPageRows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-emerald-500/5 transition-colors">
                          <td className="px-6 py-4 text-slate-400 text-sm">{(safePreviewPage - 1) * previewPageSize + index + 1}</td>
                          <td className="px-6 py-4 font-mono text-emerald-300 font-medium">{row.serialNumber}</td>
                          <td className="px-6 py-4 text-white font-medium">{itemType?.nameAr || "-"}</td>
                          <td className="px-6 py-4 text-slate-300">{destinationRegionName}</td>
                          <td className="px-6 py-4 text-slate-300">{selectedWarehouse?.nameAr || selectedWarehouse?.name || "-"}</td>
                          <td className="px-6 py-4 text-slate-400 text-sm">{new Date(row.createdAt).toLocaleTimeString("en-US")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 bg-slate-800/30 flex items-center justify-between border-t border-slate-700">
                <p className="text-slate-500 text-sm">عرض {previewFrom} - {previewTo} من أصل {previewRows.length} جهاز ممسوح</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPage((previous) => Math.max(1, previous - 1))}
                    disabled={safePreviewPage <= 1}
                    className="size-8 rounded border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPage((previous) => Math.min(previewTotalPages, previous + 1))}
                    disabled={safePreviewPage >= previewTotalPages}
                    className="size-8 rounded border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2">
                <Info className="h-4 w-4 text-blue-400" />
                <p className="text-blue-200 text-xs font-medium">الملف مجهز بتنسيق محاسبي متقدم (XLSX)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
