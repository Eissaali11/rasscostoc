import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  Store,
  Building2,
  UserCog,
  CheckCircle2,
  Plus,
  X,
  QrCode,
  Sparkles,
} from "lucide-react";
import { getInventoryValueForItemType, type InventoryEntry } from "@/hooks/use-item-types";
import {
  formatArabicDateTime,
  toSerialLifecycleRows,
  type RawSerialTrackingRecord,
} from "@/features/product-details/lifecycle.helpers";

type ItemTypeInfo = {
  id: string;
  nameAr: string;
  nameEn?: string;
  unitsPerBox: number;
};

type RegionRecord = {
  id: string;
  name: string;
};

type WarehouseRecord = {
  id: string;
  name?: string;
  nameAr?: string;
  regionId?: string | null;
  inventory?: Record<string, any> & {
    entries?: InventoryEntry[];
  };
};

type TechnicianInventoryRecord = {
  technicianId?: string;
  id?: string;
  technicianName?: string;
  fullName?: string;
  name?: string;
  fixedInventory?: Record<string, any> | null;
  movingInventory?: Record<string, any> | null;
};

type LocationFilter = "all" | "main-warehouse" | "regional-warehouse" | "technician-stock";
type AddEntryMethod = "scan" | "manual";

type AddSerialForm = {
  method: AddEntryMethod;
  serialNumber: string;
  regionId: string;
  warehouseId: string;
};

const PAGE_SIZE = 8;

const fetchJson = async (url: string) => {
  const response = await fetch(url, { credentials: "include" });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          message = json?.message || json?.error || text;
        } catch {
          message = text;
        }
      }
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  const raw = await response.text();
  if (!raw?.trim()) {
    return null;
  }

  return JSON.parse(raw);
};

const fetchArray = async (url: string): Promise<any[]> => {
  const payload = await fetchJson(url);
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

const normalizeTechniciansPayload = (payload: any): TechnicianInventoryRecord[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.technicians)) {
    return payload.technicians;
  }

  return [];
};

export default function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [page, setPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [localSerialRows, setLocalSerialRows] = useState<RawSerialTrackingRecord[]>([]);
  const [addSerialForm, setAddSerialForm] = useState<AddSerialForm>({
    method: "manual",
    serialNumber: "",
    regionId: "",
    warehouseId: "",
  });

  const isScanMode = addSerialForm.method === "scan";

  const itemTypeQuery = useQuery<ItemTypeInfo>({
    queryKey: [`/api/item-types/${id}`],
    enabled: !!id,
  });

  const serialTrackingQuery = useQuery<RawSerialTrackingRecord[]>({
    queryKey: [`/api/item-types/${id}/serial-tracking`],
    enabled: !!id,
  });

  const regionsQuery = useQuery<RegionRecord[]>({
    queryKey: ["/api/regions"],
    enabled: !!user && isAddModalOpen,
  });

  const warehousesQuery = useQuery<WarehouseRecord[]>({
    queryKey: ["product-details", "warehouses", user?.role],
    enabled: !!user && (user.role === "admin" || user.role === "supervisor"),
    queryFn: async () => {
      if (!user) {
        return [];
      }

      if (user.role === "admin") {
        return (await fetchArray("/api/warehouses")) as WarehouseRecord[];
      }

      return (await fetchArray("/api/supervisor/warehouses")) as WarehouseRecord[];
    },
  });

  const techniciansInventoriesQuery = useQuery<{ technicians: TechnicianInventoryRecord[] }>({
    queryKey: ["product-details", "technicians-inventories", user?.role, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) {
        return { technicians: [] };
      }

      if (user.role === "admin") {
        const payload = await fetchJson("/api/admin/all-technicians-inventory");
        return payload ?? { technicians: [] };
      }

      if (user.role === "supervisor") {
        const payload = await fetchJson("/api/supervisor/technicians-inventory");
        return payload ?? { technicians: [] };
      }

      const [fixedInventory, movingInventory] = await Promise.all([
        fetchJson("/api/my-fixed-inventory"),
        fetchJson("/api/my-moving-inventory"),
      ]);

      return {
        technicians: [
          {
            technicianId: user.id,
            technicianName: user.fullName || user.username || "المندوب الحالي",
            fixedInventory,
            movingInventory,
          },
        ],
      };
    },
  });

  const loading =
    itemTypeQuery.isLoading ||
    serialTrackingQuery.isLoading ||
    warehousesQuery.isLoading ||
    techniciansInventoriesQuery.isLoading;

  const loadError =
    itemTypeQuery.error ||
    serialTrackingQuery.error ||
    warehousesQuery.error ||
    techniciansInventoriesQuery.error;

  const itemType = itemTypeQuery.data;
  const serialRows = useMemo(
    () => toSerialLifecycleRows([...(serialTrackingQuery.data ?? []), ...localSerialRows]),
    [serialTrackingQuery.data, localSerialRows]
  );

  const warehouseStockSummary = useMemo(() => {
    if (!itemType?.id) {
      return { mainWarehouseStock: 0, regionalWarehouseStock: 0 };
    }

    const warehouses = Array.isArray(warehousesQuery.data) ? warehousesQuery.data : [];
    if (warehouses.length === 0) {
      return { mainWarehouseStock: 0, regionalWarehouseStock: 0 };
    }

    const warehouseStocks = warehouses.map((warehouse) => {
      const entries = Array.isArray(warehouse?.inventory?.entries) ? warehouse.inventory.entries : [];
      const boxes = Number(getInventoryValueForItemType(itemType.id, entries, warehouse?.inventory, "boxes") || 0);
      const units = Number(getInventoryValueForItemType(itemType.id, entries, warehouse?.inventory, "units") || 0);
      const qty = boxes * Math.max(1, Number(itemType.unitsPerBox || 1)) + units;

      return {
        warehouse,
        qty,
      };
    });

    const mainIndex = warehouseStocks.findIndex((item) => {
      const name = String(item.warehouse?.nameAr ?? item.warehouse?.name ?? "").toLowerCase();
      return name.includes("رئيس") || name.includes("main");
    });

    const pickedMainIndex = mainIndex >= 0 ? mainIndex : 0;
    const mainWarehouseStock = warehouseStocks[pickedMainIndex]?.qty ?? 0;
    const regionalWarehouseStock = warehouseStocks.reduce((sum, item, index) => {
      if (index === pickedMainIndex) {
        return sum;
      }
      return sum + item.qty;
    }, 0);

    return { mainWarehouseStock, regionalWarehouseStock };
  }, [itemType?.id, itemType?.unitsPerBox, warehousesQuery.data]);

  const technicianStock = useMemo(() => {
    if (!itemType?.id) {
      return 0;
    }

    const rows = normalizeTechniciansPayload(techniciansInventoriesQuery.data);

    return rows.reduce((sum, technician) => {
      const fixed = technician.fixedInventory;
      const moving = technician.movingInventory;

      const fixedEntries = Array.isArray((fixed as any)?.entries) ? ((fixed as any).entries as InventoryEntry[]) : [];
      const movingEntries = Array.isArray((moving as any)?.entries) ? ((moving as any).entries as InventoryEntry[]) : [];

      const fixedBoxes = Number(getInventoryValueForItemType(itemType.id, fixedEntries, fixed, "boxes") || 0);
      const fixedUnits = Number(getInventoryValueForItemType(itemType.id, fixedEntries, fixed, "units") || 0);
      const movingBoxes = Number(getInventoryValueForItemType(itemType.id, movingEntries, moving, "boxes") || 0);
      const movingUnits = Number(getInventoryValueForItemType(itemType.id, movingEntries, moving, "units") || 0);

      const qty = (fixedBoxes + movingBoxes) * Math.max(1, Number(itemType.unitsPerBox || 1)) + fixedUnits + movingUnits;
      return sum + qty;
    }, 0);
  }, [itemType?.id, itemType?.unitsPerBox, techniciansInventoriesQuery.data]);

  const deliveredCount = useMemo(
    () => serialRows.filter((row) => row.lifecycleCategory === "delivered").length,
    [serialRows]
  );

  const rejectedCount = useMemo(
    () => serialRows.filter((row) => row.lifecycleCategory === "rejected").length,
    [serialRows]
  );

  const filteredRows = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return serialRows.filter((row) => {
      const matchesFilter = locationFilter === "all" ? true : row.lifecycleCategory === locationFilter;
      if (!matchesFilter) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return row.serialNumber.toLowerCase().includes(normalized) || row.terminalId.toLowerCase().includes(normalized);
    });
  }, [serialRows, locationFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const pagedRows = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page, totalPages]);

  const availableWarehouses = useMemo(() => {
    const warehouses = Array.isArray(warehousesQuery.data) ? warehousesQuery.data : [];
    if (!addSerialForm.regionId) {
      return warehouses;
    }

    return warehouses.filter((warehouse) => String(warehouse.regionId || "") === addSerialForm.regionId);
  }, [warehousesQuery.data, addSerialForm.regionId]);

  const addSerialMutation = useMutation({
    mutationFn: async (payload: {
      serialNumber: string;
      regionId?: string;
      warehouseId: string;
    }) => {
      if (!user?.id || !itemType?.id) {
        throw new Error("بيانات المستخدم أو المنتج غير متوفرة.");
      }

      const serial = payload.serialNumber.trim();
      const serialSuffix = serial.replace(/\s+/g, "").slice(-10).toUpperCase();
      const terminalId = `IT-${itemType.id.toUpperCase()}-${serialSuffix || Date.now().toString().slice(-10)}`;

      await apiRequest("POST", "/api/received-devices", {
        technicianId: user.id,
        supervisorId: user.role === "supervisor" ? user.id : null,
        itemTypeId: itemType.id,
        terminalId,
        serialNumber: serial,
        battery: false,
        chargerCable: false,
        chargerHead: false,
        hasSim: false,
        simCardType: null,
        damagePart: "",
        regionId: payload.regionId || user.regionId || null,
      });

      return { terminalId };
    },
    onSuccess: (result, variables) => {
      const selectedWarehouse = availableWarehouses.find((warehouse) => warehouse.id === variables.warehouseId);

      setLocalSerialRows((previous) => [
        {
          id: `local-${Date.now()}`,
          itemTypeId: itemType?.id,
          terminalId: result.terminalId,
          serialNumber: variables.serialNumber.trim(),
          status: "pending",
          warehouseName: selectedWarehouse ? String(selectedWarehouse.nameAr ?? selectedWarehouse.name ?? "المستودع المحدد") : "المستودع المحدد",
          technicianId: null,
          technicianName: null,
          regionId: variables.regionId || user?.regionId || null,
          createdAt: new Date().toISOString(),
        },
        ...previous,
      ]);

      queryClient.invalidateQueries({ queryKey: [`/api/item-types/${id}/serial-tracking`] });

      toast({
        title: "تمت الإضافة بنجاح",
        description: "تمت إضافة السيريال الجديد إلى سجل المنتج.",
      });

      setIsAddModalOpen(false);
      setAddSerialForm({ method: "manual", serialNumber: "", regionId: "", warehouseId: "" });
      setPage(1);
    },
    onError: (error: any) => {
      toast({
        title: "تعذر إضافة السيريال",
        description: error?.message || "حدث خطأ أثناء الحفظ، حاول مرة أخرى.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitAddSerial = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const requireWarehouseSelection = availableWarehouses.length > 0;

    if (!addSerialForm.serialNumber.trim()) {
      toast({
        title: "بيانات ناقصة",
        description: isScanMode ? "يرجى مسح الرقم التسلسلي أولًا." : "يرجى إدخال الرقم التسلسلي.",
        variant: "destructive",
      });
      return;
    }

    if (requireWarehouseSelection && !addSerialForm.warehouseId) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى اختيار المستودع الوجهة.",
        variant: "destructive",
      });
      return;
    }

    addSerialMutation.mutate(addSerialForm);
  };

  if (loading) {
    return (
      <div className="space-y-6 px-2 md:px-4">
        <Skeleton className="h-16 bg-slate-800/60" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-32 bg-slate-800/60" />
          ))}
        </div>
        <Skeleton className="h-[480px] bg-slate-800/60" />
      </div>
    );
  }

  if (!itemType) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-8 text-center">
        <p className="text-white text-lg font-bold">المنتج غير موجود</p>
        <p className="text-slate-400 mt-2">تعذر العثور على تفاصيل هذا المنتج.</p>
        <Button asChild variant="outline" className="mt-4 border-slate-700 bg-slate-800/60 text-white">
          <Link href="/products-management">العودة لإدارة المنتجات</Link>
        </Button>
      </div>
    );
  }

  if (loadError) {
    const message = loadError instanceof Error ? loadError.message : "تعذر تحميل بيانات المنتج.";
    return (
      <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-6 text-center">
        <p className="text-orange-200 font-bold">تعذر تحميل البيانات</p>
        <p className="text-orange-100/80 text-sm mt-2">{message}</p>
      </div>
    );
  }

  const currentPage = Math.min(page, totalPages);
  const from = filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filteredRows.length);

  const filterButtons: Array<{ value: LocationFilter; label: string }> = [
    { value: "all", label: "الكل" },
    { value: "main-warehouse", label: "المستودع الرئيسي" },
    { value: "regional-warehouse", label: "مستودعات المناطق" },
    { value: "technician-stock", label: "مخزون المندوبين" },
  ];

  const badgeColorByCard: Record<string, string> = {
    main: "bg-purple-700/70",
    regional: "bg-indigo-700/70",
    technician: "bg-orange-700/70",
    status: "bg-emerald-700/70",
  };

  return (
    <>
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative w-full max-w-xl rounded-3xl overflow-hidden bg-slate-900/90 backdrop-blur-3xl border border-slate-700 shadow-2xl">
            <div className="px-8 py-6 flex items-center justify-between border-b border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300">
                  <QrCode className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white">إضافة سيريال جديد</h3>
              </div>

              <button
                type="button"
                className="size-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="px-8 pb-8 pt-6 space-y-6" onSubmit={handleSubmitAddSerial}>
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">المنتج المستهدف</span>
                <span className="px-4 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 font-bold text-sm border border-cyan-500/20">
                  اسم المنتج: {itemType.nameAr}
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300 px-1">طريقة إضافة السيريال</label>
                <select
                  value={addSerialForm.method}
                  onChange={(event) =>
                    setAddSerialForm((prev) => ({
                      ...prev,
                      method: event.target.value as AddEntryMethod,
                    }))
                  }
                  className="w-full bg-slate-900/70 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
                >
                  <option value="scan">مسح أجهزة</option>
                  <option value="manual">إضافة يدوي</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300 px-1">
                  {isScanMode ? "مسح الرقم التسلسلي" : "الرقم التسلسلي (Serial Number)"}
                </label>
                <div className="relative group">
                  <Input
                    dir="ltr"
                    value={addSerialForm.serialNumber}
                    onChange={(event) => setAddSerialForm((prev) => ({ ...prev, serialNumber: event.target.value }))}
                    placeholder={isScanMode ? "امسح باركود السيريال هنا" : "SN-000000"}
                    className="bg-slate-950 border-slate-700 rounded-2xl px-5 py-6 text-white font-mono text-lg focus-visible:ring-cyan-500/40 focus-visible:border-cyan-400"
                  />
                  <QrCode className="h-5 w-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-300 transition-colors" />
                </div>
                <p className="text-[11px] text-slate-500 px-1">
                  {isScanMode
                    ? "قم بتركيز المؤشر داخل الحقل ثم امسح الباركود عبر جهاز المسح."
                    : "يرجى إدخال الرقم التسلسلي الفريد المطبوع على ملصق الجهاز."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300 px-1">المنطقة</label>
                  <select
                    value={addSerialForm.regionId}
                    onChange={(event) =>
                      setAddSerialForm((prev) => ({
                        ...prev,
                        regionId: event.target.value,
                        warehouseId: "",
                      }))
                    }
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
                  >
                    <option value="" disabled>
                      اختر المنطقة...
                    </option>
                    {(regionsQuery.data ?? []).map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300 px-1">المستودع الوجهة</label>
                  <select
                    value={addSerialForm.warehouseId}
                    onChange={(event) => setAddSerialForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
                    className="w-full bg-slate-900/70 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
                  >
                    <option value="" disabled>
                      اختر المستودع...
                    </option>
                    {availableWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.nameAr || warehouse.name || "مستودع"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={addSerialMutation.isPending}
                  className="flex-[2] bg-gradient-to-br from-cyan-400 to-blue-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-60"
                >
                  <span>{addSerialMutation.isPending ? "جاري الحفظ..." : "إضافة للسجل"}</span>
                  <Plus className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  className="flex-1 border border-slate-700 text-slate-300 font-medium py-4 rounded-2xl hover:bg-slate-800 hover:text-white transition-all"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-8 px-2 md:px-4">
        <section className="h-20 flex items-center justify-between px-6 rounded-xl bg-slate-900/70 border border-slate-700/70">
          <div className="flex items-center gap-8">
            <h2 className="text-2xl font-bold text-white">
              تفاصيل المنتج : <span className="text-cyan-400">{itemType.nameAr}</span>
            </h2>
            <div className="relative w-[340px] max-w-[45vw]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="البحث برقم السيريال..."
                className="pr-10 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20">
              <Link href={`/products-management/${id}/smart-add`}>
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  الإضافة الذكية
                </span>
              </Link>
            </Button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-gradient-to-br from-cyan-400 to-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold transition-all hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة سيريال جديد</span>
            </button>

            <Button asChild variant="outline" className="border-slate-700 bg-slate-800/60 text-slate-100 hover:bg-slate-700">
              <Link href="/products-management">العودة لإدارة المنتجات</Link>
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <article className="bg-slate-900/70 backdrop-blur-md border border-slate-700 rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-widest">المستودع الرئيسي</p>
                <h3 className="text-4xl font-bold text-white">{warehouseStockSummary.mainWarehouseStock.toLocaleString("en-US")}</h3>
              </div>
              <div className={`size-12 rounded-lg ${badgeColorByCard.main} text-white flex items-center justify-center border border-slate-600`}>
                <Store className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="bg-slate-900/70 backdrop-blur-md border border-slate-700 rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-widest">مستودعات المناطق</p>
                <h3 className="text-4xl font-bold text-white">{warehouseStockSummary.regionalWarehouseStock.toLocaleString("en-US")}</h3>
              </div>
              <div className={`size-12 rounded-lg ${badgeColorByCard.regional} text-white flex items-center justify-center border border-slate-600`}>
                <Building2 className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="bg-slate-900/70 backdrop-blur-md border border-slate-700 rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-widest">مخزون المندوبين</p>
                <h3 className="text-4xl font-bold text-white">{technicianStock.toLocaleString("en-US")}</h3>
              </div>
              <div className={`size-12 rounded-lg ${badgeColorByCard.technician} text-white flex items-center justify-center border border-slate-600`}>
                <UserCog className="h-6 w-6" />
              </div>
            </div>
          </article>

          <article className="bg-slate-900/70 backdrop-blur-md border border-slate-700 rounded-xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-widest">تم التسليم / مرفوض</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold text-white">{deliveredCount.toLocaleString("en-US")}</h3>
                  <span className="text-sm font-medium text-slate-400">/ {rejectedCount.toLocaleString("en-US")}</span>
                </div>
              </div>
              <div className={`size-12 rounded-lg ${badgeColorByCard.status} text-white flex items-center justify-center border border-slate-600`}>
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg w-fit border border-slate-700">
            {filterButtons.map((button) => {
              const active = locationFilter === button.value;
              return (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => {
                    setLocationFilter(button.value);
                    setPage(1);
                  }}
                  className={
                    active
                      ? "px-6 py-2 rounded-md text-cyan-300 border border-cyan-400/50 bg-cyan-500/10 font-medium text-sm"
                      : "px-6 py-2 rounded-md text-slate-400 font-medium text-sm hover:text-white hover:bg-slate-700"
                  }
                >
                  {button.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-5 px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700">
              <div>السيريال نمبر</div>
              <div>الموقع الحالي</div>
              <div>حالة دورة الحياة</div>
              <div>آخر تحديث</div>
              <div className="text-left">الإجراءات</div>
            </div>

            {pagedRows.length === 0 ? (
              <div className="grid grid-cols-1 items-center px-6 py-12 rounded-xl text-center text-slate-400 bg-slate-900/70 border border-slate-700">
                لا توجد بيانات سيريال مطابقة للبحث أو الفلتر الحالي.
              </div>
            ) : (
              pagedRows.map((row) => (
                <div key={row.id} className="grid grid-cols-5 items-center px-6 py-4 bg-slate-900/70 border border-slate-700 rounded-xl hover:bg-slate-800/90 transition-colors">
                  <div className="font-mono font-bold text-base text-cyan-300 [text-shadow:0_0_8px_rgba(6,182,212,0.35)]">{row.serialNumber}</div>
                  <div className="text-sm text-slate-300 font-medium">{row.currentLocation}</div>
                  <div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium ${row.badgeClass}`}>
                      {row.lifecycleLabel}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium">{formatArabicDateTime(row.createdAt)}</div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-md bg-transparent text-slate-400 hover:text-cyan-300"
                    >
                      <Link href={`/received-devices/${row.id}`} title="عرض دورة الحياة">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}

            <div className="flex justify-between items-center mt-8 px-2">
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Showing {from}-{to} of {filteredRows.length.toLocaleString("en-US")} units
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                  disabled={currentPage <= 1}
                  className="size-8 rounded-md flex items-center justify-center bg-transparent text-slate-400 border border-slate-600 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {Array.from({ length: Math.min(totalPages, 3) }).map((_, index) => {
                  const pageNumber = index + 1;
                  const active = currentPage === pageNumber;

                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={
                        active
                          ? "size-8 rounded-md bg-cyan-500 text-white font-bold text-sm"
                          : "size-8 rounded-md bg-transparent text-slate-400 border border-slate-600 font-medium hover:text-white hover:border-slate-500"
                      }
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                  disabled={currentPage >= totalPages}
                  className="size-8 rounded-md flex items-center justify-center bg-transparent text-slate-400 border border-slate-600 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

