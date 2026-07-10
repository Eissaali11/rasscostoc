import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveItemTypes } from "@/hooks/use-item-types";
import {
  CheckCircle2,
  Download,
  History,
  Package,
  Search,
  Smartphone,
  TriangleAlert,
  XCircle,
} from "lucide-react";

type ReceivedDevice = {
  id: string;
  terminalId: string;
  serialNumber: string;
  itemTypeId: string | null;
  status: "pending" | "approved" | "rejected";
  adminNotes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date | null;
  technicianId: string;
};

type WithdrawnDevice = {
  id: string;
  city: string;
  technicianName: string;
  terminalId: string;
  serialNumber: string;
  notes: string | null;
  damagePart: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

type WarehouseTransfer = {
  id: string;
  warehouseId: string;
  technicianId: string;
  itemType: string;
  packagingType: string;
  quantity: number;
  performedBy: string;
  notes?: string;
  status: "pending" | "accepted" | "rejected";
  rejectionReason?: string;
  respondedAt?: Date | string;
  createdAt: Date | string;
  warehouseName?: string;
  technicianName?: string;
};

type TimelineEntry = {
  id: string;
  title: string;
  description: string;
  timestamp: string | Date;
  markerClass: string;
  tags?: string[];
};

type SearchResultItem = {
  id: string;
  source: "withdrawn" | "received" | "warehouse-transfer";
  sourceLabel: string;
  title: string;
  operationNumber: string;
  operationRefs: string[];
  serialNumber: string;
  productName: string;
  statusText: string;
  statusClass: string;
  createdAt: string | Date;
  route: string;
  summary: string;
  searchable: string[];
  exactTokens: string[];
  timeline: TimelineEntry[];
};

const normalizeText = (value?: string | null): string => (value || "").trim().toLowerCase();

const formatDate = (value?: string | Date | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ar-SA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getReadableOperationNumber = (prefix: "WD" | "RC" | "OP", id: string): string => {
  const shortId = (id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `${prefix}-${shortId || "UNKNOWN"}`;
};

const inferWithdrawnStatus = (device: WithdrawnDevice): "pending" | "approved" | "rejected" | "maintenance" => {
  const combined = `${normalizeText(device.notes)} ${normalizeText(device.damagePart)}`;

  if (/(صيانة|maintenance|تحويل\s*للصيانة)/i.test(combined)) return "maintenance";
  if (/(مرفوض|رفض|rejected|reject)/i.test(combined)) return "rejected";
  if (/(موافق|تمت\s*الموافقة|approved|accept|مقبول)/i.test(combined)) return "approved";

  return "pending";
};

const withdrawnStatusUi: Record<
  ReturnType<typeof inferWithdrawnStatus>,
  { text: string; className: string; markerClass: string }
> = {
  pending: {
    text: "قيد المراجعة",
    className: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    markerClass: "bg-amber-400",
  },
  approved: {
    text: "موافق عليها",
    className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    markerClass: "bg-emerald-400",
  },
  rejected: {
    text: "مرفوضة",
    className: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    markerClass: "bg-rose-400",
  },
  maintenance: {
    text: "محولة للصيانة",
    className: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
    markerClass: "bg-orange-400",
  },
};

const receivedStatusUi: Record<
  ReceivedDevice["status"],
  { text: string; className: string; markerClass: string }
> = {
  pending: {
    text: "قيد المراجعة",
    className: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    markerClass: "bg-amber-400",
  },
  approved: {
    text: "موافق عليه",
    className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    markerClass: "bg-emerald-400",
  },
  rejected: {
    text: "مرفوض",
    className: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    markerClass: "bg-rose-400",
  },
};

const transferStatusUi: Record<
  "accepted" | "rejected",
  { text: string; className: string; markerClass: string }
> = {
  accepted: {
    text: "مكتمل",
    className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    markerClass: "bg-emerald-400",
  },
  rejected: {
    text: "مرفوض",
    className: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    markerClass: "bg-rose-400",
  },
};

function normalizeTransferStatus(status?: string | null): "accepted" | "rejected" | "pending" {
  const normalized = normalizeText(status);

  if (normalized === "rejected" || normalized === "reject" || normalized === "declined") {
    return "rejected";
  }

  if (
    normalized === "accepted" ||
    normalized === "approved" ||
    normalized === "approve" ||
    normalized === "completed" ||
    normalized === "done"
  ) {
    return "accepted";
  }

  return "pending";
}

function getTransferGroupId(transfer: WarehouseTransfer): string {
  const date = new Date(transfer.createdAt);
  const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return `${transfer.warehouseId}-${dayKey}-${transfer.performedBy}-${transfer.status}-${transfer.notes || "no-notes"}`;
}

function rankSearchResults(results: SearchResultItem[], query: string): SearchResultItem[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  return results
    .map((result) => {
      const searchable = result.searchable.map((entry) => normalizeText(entry));
      const exact = result.exactTokens.some((entry) => normalizeText(entry) === normalizedQuery);
      const startsWith = searchable.some((entry) => entry.startsWith(normalizedQuery));
      const includes = searchable.some((entry) => entry.includes(normalizedQuery));

      if (!exact && !startsWith && !includes) return null;

      let score = 0;
      if (exact) score += 1000;
      if (startsWith) score += 650;
      if (includes) score += 350;
      if (normalizeText(result.serialNumber) === normalizedQuery) score += 120;
      if (normalizeText(result.operationNumber) === normalizedQuery) score += 100;
      if (normalizeText(result.productName).includes(normalizedQuery)) score += 40;

      return { result, score };
    })
    .filter((entry): entry is { result: SearchResultItem; score: number } => !!entry)
    .sort((first, second) => {
      if (second.score !== first.score) {
        return second.score - first.score;
      }
      return new Date(second.result.createdAt).getTime() - new Date(first.result.createdAt).getTime();
    })
    .map((entry) => entry.result);
}

export default function OperationsSearchPage() {
  const [, setLocation] = useLocation();

  const [searchInput, setSearchInput] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  const {
    data: receivedDevices = [],
    isLoading: isLoadingReceived,
    error: receivedError,
  } = useQuery<ReceivedDevice[]>({
    queryKey: ["/api/received-devices"],
  });

  const {
    data: withdrawnDevices = [],
    isLoading: isLoadingWithdrawn,
    error: withdrawnError,
  } = useQuery<WithdrawnDevice[]>({
    queryKey: ["/api/withdrawn-devices"],
  });

  const {
    data: transfers = [],
    isLoading: isLoadingTransfers,
    error: transfersError,
  } = useQuery<WarehouseTransfer[]>({
    queryKey: ["/api/warehouse-transfers"],
  });

  const {
    data: itemTypes = [],
    isLoading: isLoadingItemTypes,
  } = useActiveItemTypes();

  const itemTypeMap = useMemo(() => {
    const map = new Map<string, { nameAr: string; nameEn: string }>();
    itemTypes.forEach((itemType) => {
      map.set(itemType.id, { nameAr: itemType.nameAr, nameEn: itemType.nameEn });
      map.set(itemType.nameEn, { nameAr: itemType.nameAr, nameEn: itemType.nameEn });
    });
    return map;
  }, [itemTypes]);

  const allResults = useMemo(() => {
    const results: SearchResultItem[] = [];

    withdrawnDevices.forEach((device) => {
      const status = inferWithdrawnStatus(device);
      const statusUi = withdrawnStatusUi[status];
      const operationNumber = getReadableOperationNumber("WD", device.id);

      const timeline: TimelineEntry[] = [
        {
          id: `wd-create-${device.id}`,
          title: "تسجيل الجهاز المرتجع",
          description: `تم تسجيل الجهاز ${device.serialNumber} كمرتجع في النظام.`,
          timestamp: device.createdAt || new Date(),
          markerClass: "bg-cyan-400",
          tags: [
            `المدينة: ${device.city || "غير محدد"}`,
            `المندوب: ${device.technicianName || "غير محدد"}`,
          ],
        },
      ];

      if (device.updatedAt) {
        timeline.push({
          id: `wd-status-${device.id}`,
          title: `الحالة الحالية: ${statusUi.text}`,
          description: device.notes || "تم تحديث بيانات الطلب حسب آخر إجراء.",
          timestamp: device.updatedAt,
          markerClass: statusUi.markerClass,
        });
      }

      results.push({
        id: `withdrawn-${device.id}`,
        source: "withdrawn",
        sourceLabel: "مرتجع",
        title: `مرتجع ${device.terminalId || "جهاز"}`,
        operationNumber,
        operationRefs: [device.id],
        serialNumber: device.serialNumber,
        productName: device.terminalId,
        statusText: statusUi.text,
        statusClass: statusUi.className,
        createdAt: device.createdAt || new Date(),
        route: `/withdrawn-devices/${device.id}`,
        summary: device.notes || "طلب مرتجع مسجل بانتظار المتابعة.",
        searchable: [
          device.serialNumber,
          device.id,
          operationNumber,
          device.terminalId,
          device.technicianName,
          device.city,
          device.notes || "",
        ],
        exactTokens: [device.serialNumber, device.id, operationNumber],
        timeline,
      });
    });

    receivedDevices.forEach((device) => {
      const statusUi = receivedStatusUi[device.status];
      const operationNumber = getReadableOperationNumber("RC", device.id);
      const itemTypeLabel =
        (device.itemTypeId && itemTypeMap.get(device.itemTypeId)?.nameAr) ||
        (device.itemTypeId && itemTypeMap.get(device.itemTypeId)?.nameEn) ||
        device.terminalId;

      const timeline: TimelineEntry[] = [
        {
          id: `rc-create-${device.id}`,
          title: "استلام الجهاز في النظام",
          description: `تم استلام الجهاز ${device.serialNumber} من المندوب وإدخاله للمراجعة.`,
          timestamp: device.createdAt,
          markerClass: "bg-cyan-400",
          tags: [
            `المندوب: ${device.technicianId}`,
            `نوع المنتج: ${itemTypeLabel}`,
          ],
        },
      ];

      if (device.status !== "pending" || device.updatedAt) {
        timeline.push({
          id: `rc-status-${device.id}`,
          title: `قرار المراجعة: ${statusUi.text}`,
          description: device.adminNotes || "تم تحديث حالة الجهاز من قبل المشرف.",
          timestamp: device.updatedAt || device.createdAt,
          markerClass: statusUi.markerClass,
        });
      }

      results.push({
        id: `received-${device.id}`,
        source: "received",
        sourceLabel: "مستلم",
        title: `استلام ${device.terminalId || "جهاز"}`,
        operationNumber,
        operationRefs: [device.id],
        serialNumber: device.serialNumber,
        productName: itemTypeLabel,
        statusText: statusUi.text,
        statusClass: statusUi.className,
        createdAt: device.createdAt,
        route: `/received-devices/${device.id}`,
        summary: device.adminNotes || "عملية استلام جهاز معروضة للتفاصيل.",
        searchable: [
          device.serialNumber,
          device.id,
          operationNumber,
          device.terminalId,
          itemTypeLabel,
          device.adminNotes || "",
          device.technicianId,
        ],
        exactTokens: [device.serialNumber, device.id, operationNumber],
        timeline,
      });
    });

    const processedTransfers = transfers.filter(
      (transfer) => normalizeTransferStatus(transfer.status) !== "pending",
    );
    const groupedTransfers = processedTransfers.reduce<Record<string, { groupId: string; items: WarehouseTransfer[] }>>(
      (acc, transfer) => {
        const groupId = getTransferGroupId(transfer);
        if (!acc[groupId]) {
          acc[groupId] = { groupId, items: [] };
        }
        acc[groupId].items.push(transfer);
        return acc;
      },
      {},
    );

    Object.values(groupedTransfers).forEach((group) => {
      const base = group.items[0];
      const normalizedStatus = normalizeTransferStatus(base?.status);

      if (!base || normalizedStatus === "pending") return;

      const statusUi = transferStatusUi[normalizedStatus === "rejected" ? "rejected" : "accepted"];
      const transferIds = group.items.map((item) => item.id);
      const operationNumber = getReadableOperationNumber("OP", transferIds[0] || group.groupId);
      const itemNames = Array.from(
        new Set(
          group.items.map((item) => {
            const mapped = itemTypeMap.get(item.itemType);
            if (mapped?.nameAr) return mapped.nameAr;
            if (mapped?.nameEn) return mapped.nameEn;
            return item.itemType;
          }),
        ),
      );

      const timeline: TimelineEntry[] = [
        {
          id: `op-create-${group.groupId}`,
          title: "إنشاء عملية التحويل",
          description: `تم إنشاء العملية من ${base.warehouseName || "المستودع"} إلى المندوب ${base.technicianName || "غير محدد"}.`,
          timestamp: base.createdAt,
          markerClass: "bg-cyan-400",
          tags: [
            `المستودع: ${base.warehouseName || "غير محدد"}`,
            `المندوب: ${base.technicianName || "غير محدد"}`,
          ],
        },
      ];

      if (base.respondedAt) {
        timeline.push({
          id: `op-status-${group.groupId}`,
          title: `نتيجة العملية: ${statusUi.text}`,
          description:
            normalizedStatus === "rejected"
              ? base.rejectionReason || "تم رفض العملية."
              : "تم اعتماد العملية بنجاح.",
          timestamp: base.respondedAt,
          markerClass: statusUi.markerClass,
        });
      }

      results.push({
        id: `transfer-${group.groupId}`,
        source: "warehouse-transfer",
        sourceLabel: "عملية مستودع",
        title: `عملية ${base.warehouseName || "مستودع"}`,
        operationNumber,
        operationRefs: [group.groupId, ...transferIds],
        serialNumber: "-",
        productName: itemNames.slice(0, 2).join(" + ") || "عناصر مستودع",
        statusText: statusUi.text,
        statusClass: statusUi.className,
        createdAt: base.createdAt,
        route: `/operation-details/${encodeURIComponent(group.groupId)}`,
        summary: base.notes || `${group.items.length} عناصر في هذه العملية`,
        searchable: [
          group.groupId,
          operationNumber,
          ...transferIds,
          base.warehouseName || "",
          base.technicianName || "",
          ...itemNames,
          base.notes || "",
        ],
        exactTokens: [group.groupId, operationNumber, ...transferIds],
        timeline,
      });
    });

    return results.sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );
  }, [itemTypeMap, receivedDevices, transfers, withdrawnDevices]);

  const results = useMemo(
    () => rankSearchResults(allResults, submittedQuery),
    [allResults, submittedQuery],
  );

  useEffect(() => {
    if (!results.length) {
      setSelectedResultId(null);
      return;
    }

    const selectedStillExists = selectedResultId && results.some((result) => result.id === selectedResultId);
    if (!selectedStillExists) {
      setSelectedResultId(results[0].id);
    }
  }, [results, selectedResultId]);

  const selectedResult = useMemo(() => {
    if (!results.length) return null;
    if (!selectedResultId) return results[0];
    return results.find((result) => result.id === selectedResultId) || results[0];
  }, [results, selectedResultId]);

  const isLoading = isLoadingReceived || isLoadingWithdrawn || isLoadingTransfers || isLoadingItemTypes;
  const error = receivedError || withdrawnError || transfersError;

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const query = searchInput.trim();
    setSubmittedQuery(query);

    if (!query) {
      setSelectedResultId(null);
      return;
    }

    const ranked = rankSearchResults(allResults, query);

    if (!ranked.length) {
      setSelectedResultId(null);
      return;
    }

    const normalized = normalizeText(query);
    const exactMatches = ranked.filter((result) =>
      result.exactTokens.some((token) => normalizeText(token) === normalized),
    );

    if (exactMatches.length === 1) {
      setLocation(exactMatches[0].route);
      return;
    }

    if (ranked.length === 1) {
      setLocation(ranked[0].route);
      return;
    }

    setSelectedResultId(ranked[0].id);
  };

  const exportToExcel = async () => {
    if (!selectedResult) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("نتيجة البحث");
    worksheet.views = [{ rightToLeft: true }];

    worksheet.columns = [
      { header: "الحقل", key: "field", width: 28 },
      { header: "القيمة", key: "value", width: 60 },
    ];

    worksheet.addRow({ field: "نوع العملية", value: selectedResult.sourceLabel });
    worksheet.addRow({ field: "رقم العملية", value: selectedResult.operationNumber });
    worksheet.addRow({ field: "اسم المنتج", value: selectedResult.productName });
    worksheet.addRow({ field: "الرقم التسلسلي", value: selectedResult.serialNumber });
    worksheet.addRow({ field: "الحالة", value: selectedResult.statusText });
    worksheet.addRow({ field: "تاريخ العملية", value: formatDateTime(selectedResult.createdAt) });
    worksheet.addRow({ field: "ملخص", value: selectedResult.summary });

    worksheet.addRow({ field: "", value: "" });
    worksheet.addRow({ field: "الجدول الزمني", value: "" });

    selectedResult.timeline.forEach((event, index) => {
      worksheet.addRow({
        field: `${index + 1}. ${event.title}`,
        value: `${formatDateTime(event.timestamp)} | ${event.description}`,
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCFDFD" },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `search-result-${selectedResult.operationNumber}.xlsx`);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 backdrop-blur-md p-6">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="relative group">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-cyan-300 transition-transform group-focus-within:scale-110" />
            </div>

            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-16 pr-12 pl-36 bg-slate-900/70 border-cyan-400/20 focus-visible:ring-cyan-400/70 text-lg text-slate-100 placeholder:text-slate-400"
              placeholder="ابحث برقم السيريال أو رقم العملية أو اسم المنتج..."
            />

            <div className="absolute inset-y-0 left-2 flex items-center">
              <Button type="submit" className="bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-bold px-6">
                بحث سريع
              </Button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            البحث يدعم: الرقم التسلسلي، رقم العملية، واسم المنتج. عند وجود تطابق وحيد سيتم فتح التفاصيل مباشرة.
          </p>
        </form>
      </section>

      {submittedQuery ? (
        <section className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 backdrop-blur-md p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">نتائج البحث: {submittedQuery}</h3>
                <p className="text-xs text-slate-400">عدد النتائج المطابقة: {results.length}</p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={exportToExcel}
              disabled={!selectedResult}
              className="border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20"
            >
              <Download className="h-4 w-4 ml-2" />
              تصدير إلى Excel
            </Button>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-slate-300">جاري تحميل بيانات العمليات...</div>
          ) : error ? (
            <div className="py-10 text-center text-rose-300">حدث خطأ أثناء تحميل البيانات. حاول مرة أخرى.</div>
          ) : !results.length ? (
            <div className="py-10 text-center text-slate-300">
              لا توجد نتائج مطابقة لعبارة البحث الحالية.
            </div>
          ) : (
            <>
              {results.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {results.slice(0, 8).map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => setSelectedResultId(result.id)}
                      className={
                        selectedResult?.id === result.id
                          ? "px-3 py-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/15 text-cyan-200 text-xs font-bold"
                          : "px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/70 text-slate-300 text-xs hover:border-cyan-400/30"
                      }
                    >
                      {result.operationNumber}
                    </button>
                  ))}
                </div>
              )}

              {selectedResult && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400 mb-1">اسم المنتج</p>
                      <p className="font-bold text-slate-100">{selectedResult.productName || "-"}</p>
                    </div>

                    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400 mb-1">الرقم التسلسلي</p>
                      <p className="font-mono font-bold text-cyan-300 tracking-wider">{selectedResult.serialNumber || "-"}</p>
                    </div>

                    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400 mb-1">الحالة الحالية</p>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${selectedResult.statusClass}`}>
                        {selectedResult.statusText}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400 mb-1">تاريخ العملية</p>
                      <p className="font-bold text-slate-100">{formatDate(selectedResult.createdAt)}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-lg font-black text-white flex items-center gap-2">
                      <History className="h-5 w-5 text-cyan-300" />
                      الجدول الزمني لدورة حياة العملية
                    </h4>

                    <div className="relative pr-6">
                      <div className="absolute top-0 bottom-0 right-1.5 w-px bg-cyan-500/20" />

                      <div className="space-y-6">
                        {selectedResult.timeline.map((event) => (
                          <div key={event.id} className="relative">
                            <div className={`absolute -right-0.5 top-1.5 size-3 rounded-full ${event.markerClass} ring-4 ring-cyan-500/10`} />

                            <div className="mr-5 rounded-xl border border-slate-700/60 bg-slate-900/70 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <p className="font-bold text-slate-100">{event.title}</p>
                                <span className="text-xs text-slate-400">{formatDateTime(event.timestamp)}</span>
                              </div>

                              <p className="text-sm text-slate-300">{event.description}</p>

                              {!!event.tags?.length && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {event.tags.map((tag, index) => (
                                    <span
                                      key={`${event.id}-${index}`}
                                      className="px-2 py-1 rounded bg-slate-950/60 text-[10px] text-slate-400 border border-slate-700/50"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm text-slate-300 font-semibold">{selectedResult.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{selectedResult.summary}</p>
                    </div>

                    <Button
                      type="button"
                      className="bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-bold"
                      onClick={() => setLocation(selectedResult.route)}
                    >
                      عرض التفاصيل فوراً
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-8 text-center text-slate-400">
          <div className="mx-auto w-fit mb-3 rounded-full bg-cyan-500/10 border border-cyan-500/20 p-3">
            <Search className="h-6 w-6 text-cyan-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-200 mb-2">ابدأ البحث عن العملية</h3>
          <p className="text-sm text-slate-400">أدخل رقم السيريال أو رقم العملية أو اسم المنتج ثم اضغط "بحث سريع".</p>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 mb-1 text-amber-300">
            <TriangleAlert className="h-4 w-4" />
            <span className="text-xs font-bold">قيد المراجعة</span>
          </div>
          <p className="text-sm text-slate-300">عمليات تحتاج قرار نهائي أو متابعة.</p>
        </div>

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 mb-1 text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-bold">مكتملة</span>
          </div>
          <p className="text-sm text-slate-300">عمليات تمت معالجتها بنجاح.</p>
        </div>

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 mb-1 text-rose-300">
            <XCircle className="h-4 w-4" />
            <span className="text-xs font-bold">مرفوضة</span>
          </div>
          <p className="text-sm text-slate-300">عمليات مرفوضة وتحتاج مراجعة السبب.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-4 text-xs text-slate-500 flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-cyan-300" />
        البحث الموحد يعرض العمليات من الأجهزة المستلمة، المرتجعة، وعمليات المستودع المعالجة.
      </section>
    </div>
  );
}
