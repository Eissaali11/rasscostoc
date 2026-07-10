import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ProductsDistributionTable } from "@/features/products-management/components/products-distribution-table";
import { ProductsKpiCards } from "@/features/products-management/components/products-kpi-cards";
import { ProductsManagementHeader } from "@/features/products-management/components/products-management-header";
import { ProductsScanReceiver } from "@/features/products-management/components/products-scan-receiver";
import {
  buildProductDistributionRows,
  calculateProductsKpis,
  normalizeProductMaster,
  toStorageOptions,
} from "@/features/products-management/lib/products-management.helpers";
import type { ProductMaster, ProductScanRecord, StorageBucketType } from "@/features/products-management/types";
import { getInventoryValueForItemType, type InventoryEntry } from "@/hooks/use-item-types";
import { AlertTriangle } from "lucide-react";

type TechnicianInventoryRecord = {
  technicianId?: string;
  id?: string;
  technicianName?: string;
  fullName?: string;
  name?: string;
  fixedInventory?: Record<string, any> | null;
  movingInventory?: Record<string, any> | null;
};

type ScanOperationType =
  | "ADD_STOCK"
  | "DEDUCT_STOCK"
  | "TRANSFER_TO_TECHNICIAN"
  | "WITHDRAW_FROM_TECHNICIAN";
type PackagingType = "box" | "unit";

const fetchJson = async (url: string): Promise<any> => {
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

  const rawText = await response.text();
  if (!rawText?.trim()) {
    return null;
  }

  return JSON.parse(rawText);
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

const postScanReceive = async (body: any) => {
  const response = await fetch("/api/inventory-scan/execute", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let payload: any = {};
  if (rawText?.trim()) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { message: rawText };
    }
  }

  if (!response.ok) {
    throw new Error(payload?.message || "تعذر تنفيذ حركة المسح.");
  }

  return payload;
};

export default function ProductsManagementPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [searchTerm, setSearchTerm] = useState("");
  const [scannedValue, setScannedValue] = useState("");
  const [operationType, setOperationType] = useState<ScanOperationType>("ADD_STOCK");
  const [packagingType, setPackagingType] = useState<PackagingType>("unit");
  const [quantity, setQuantity] = useState(1);
  const [storageType, setStorageType] = useState<StorageBucketType>("warehouse");
  const [storageId, setStorageId] = useState("");
  const [transferWarehouseId, setTransferWarehouseId] = useState("");
  const [transferTechnicianId, setTransferTechnicianId] = useState("");
  const [latestScans, setLatestScans] = useState<ProductScanRecord[]>([]);
  const [receiveMessage, setReceiveMessage] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["products-management", "item-types"],
    queryFn: () => fetchArray("/api/item-types/active"),
  });

  const warehousesQuery = useQuery({
    queryKey: ["products-management", "warehouses", user?.role],
    enabled: !!user && (user.role === "admin" || user.role === "supervisor"),
    queryFn: async () => {
      if (!user) {
        return [];
      }

      if (user.role === "admin") {
        return fetchArray("/api/warehouses");
      }

      return fetchArray("/api/supervisor/warehouses");
    },
  });

  const techniciansInventoriesQuery = useQuery({
    queryKey: ["products-management", "technicians-inventories", user?.role, user?.id],
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

  const productMasters = useMemo<ProductMaster[]>(
    () =>
      (productsQuery.data ?? [])
        .map(normalizeProductMaster)
        .filter((product) => !!product.id),
    [productsQuery.data]
  );

  const warehouses = useMemo(() => (Array.isArray(warehousesQuery.data) ? warehousesQuery.data : []), [warehousesQuery.data]);

  const technicianRecords = useMemo<TechnicianInventoryRecord[]>(() => {
    const payload = techniciansInventoriesQuery.data;

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.technicians)) {
      return payload.technicians;
    }

    return [];
  }, [techniciansInventoriesQuery.data]);

  const warehouseInventoryRows = useMemo(() => {
    if (productMasters.length === 0) {
      return [];
    }

    return warehouses.flatMap((warehouse: any) => {
      const warehouseId = String(warehouse?.id ?? "");
      if (!warehouseId) {
        return [];
      }

      const warehouseName =
        String(warehouse?.nameAr ?? warehouse?.name ?? warehouse?.name_ar ?? warehouse?.location ?? "").trim() || "مستودع";
      const legacyInventory = warehouse?.inventory ?? null;
      const entries = Array.isArray(legacyInventory?.entries) ? (legacyInventory.entries as InventoryEntry[]) : [];

      return productMasters
        .map((product) => {
          const boxes = Number(getInventoryValueForItemType(product.id, entries, legacyInventory, "boxes") || 0);
          const units = Number(getInventoryValueForItemType(product.id, entries, legacyInventory, "units") || 0);
          const quantity = boxes * Math.max(1, Number(product.unitsPerBox || 1)) + units;

          if (quantity <= 0) {
            return null;
          }

          return {
            itemTypeId: product.id,
            quantity,
            boxes,
            units,
            warehouseId,
            warehouseName,
          };
        })
        .filter(Boolean);
    }) as any[];
  }, [warehouses, productMasters]);

  const technicianInventoryRows = useMemo(() => {
    if (productMasters.length === 0) {
      return [];
    }

    return technicianRecords.flatMap((technician) => {
      const technicianId = String(technician?.technicianId ?? technician?.id ?? "");
      if (!technicianId) {
        return [];
      }

      const technicianName =
        String(technician?.technicianName ?? technician?.fullName ?? technician?.name ?? "").trim() || "مندوب";

      const fixedInventory = technician?.fixedInventory ?? null;
      const movingInventory = technician?.movingInventory ?? null;

      const fixedEntries = Array.isArray((fixedInventory as any)?.entries)
        ? ((fixedInventory as any).entries as InventoryEntry[])
        : [];
      const movingEntries = Array.isArray((movingInventory as any)?.entries)
        ? ((movingInventory as any).entries as InventoryEntry[])
        : [];

      return productMasters
        .map((product) => {
          const fixedBoxes = Number(getInventoryValueForItemType(product.id, fixedEntries, fixedInventory, "boxes") || 0);
          const fixedUnits = Number(getInventoryValueForItemType(product.id, fixedEntries, fixedInventory, "units") || 0);
          const movingBoxes = Number(getInventoryValueForItemType(product.id, movingEntries, movingInventory, "boxes") || 0);
          const movingUnits = Number(getInventoryValueForItemType(product.id, movingEntries, movingInventory, "units") || 0);

          const quantity =
            (fixedBoxes + movingBoxes) * Math.max(1, Number(product.unitsPerBox || 1)) + fixedUnits + movingUnits;

          if (quantity <= 0) {
            return null;
          }

          return {
            itemTypeId: product.id,
            quantity,
            boxes: fixedBoxes + movingBoxes,
            units: fixedUnits + movingUnits,
            technicianId,
            technicianName,
          };
        })
        .filter(Boolean);
    }) as any[];
  }, [technicianRecords, productMasters]);

  const normalizedTechniciansForOptions = useMemo(
    () =>
      technicianRecords
        .map((record) => ({
          id: String(record?.technicianId ?? record?.id ?? ""),
          fullName: String(record?.technicianName ?? record?.fullName ?? record?.name ?? "مندوب"),
        }))
        .filter((record) => record.id.length > 0),
    [technicianRecords]
  );

  const warehouseOptions = useMemo(() => toStorageOptions(warehouses, "warehouse"), [warehouses]);
  const technicianOptions = useMemo(
    () => toStorageOptions(normalizedTechniciansForOptions, "technician"),
    [normalizedTechniciansForOptions]
  );

  useEffect(() => {
    if (user?.role === "technician" && storageType !== "technician") {
      setStorageType("technician");
      return;
    }

    const options = storageType === "warehouse" ? warehouseOptions : technicianOptions;
    if (options.length === 0) {
      if (storageId !== "") {
        setStorageId("");
      }
      return;
    }

    const isCurrentValid = options.some((option) => option.id === storageId);
    if (!isCurrentValid) {
      setStorageId(options[0].id);
    }
  }, [storageType, warehouseOptions, technicianOptions, storageId]);

  useEffect(() => {
    if (!transferWarehouseId || !warehouseOptions.some((option) => option.id === transferWarehouseId)) {
      setTransferWarehouseId(warehouseOptions[0]?.id ?? "");
    }
  }, [warehouseOptions, transferWarehouseId]);

  useEffect(() => {
    if (user?.role === "technician") {
      if (transferTechnicianId !== user.id) {
        setTransferTechnicianId(user.id);
      }
      return;
    }

    if (!transferTechnicianId || !technicianOptions.some((option) => option.id === transferTechnicianId)) {
      setTransferTechnicianId(technicianOptions[0]?.id ?? "");
    }
  }, [technicianOptions, transferTechnicianId, user?.id, user?.role]);

  const rows = useMemo(
    () => buildProductDistributionRows(productMasters, warehouseInventoryRows, technicianInventoryRows),
    [productMasters, warehouseInventoryRows, technicianInventoryRows]
  );

  const filteredRows = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return rows;
    }

    return rows.filter(
      (row) => row.itemNameAr.toLowerCase().includes(normalized) || row.itemCode.toLowerCase().includes(normalized)
    );
  }, [rows, searchTerm]);

  const kpis = useMemo(() => calculateProductsKpis(rows), [rows]);

  const receiveMutation = useMutation({
    mutationFn: postScanReceive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-management"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-technicians-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supervisor/technicians-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-fixed-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-moving-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
    },
  });

  const handleReceive = async () => {
    const trimmedValue = scannedValue.trim();
    if (!trimmedValue) {
      setReceiveMessage("يرجى مسح الباركود أو إدخال SKU/اسم المنتج.");
      return;
    }

    const isTransferMode = operationType === "TRANSFER_TO_TECHNICIAN" || operationType === "WITHDRAW_FROM_TECHNICIAN";

    if (isTransferMode) {
      if (!transferWarehouseId) {
        setReceiveMessage("يرجى اختيار المستودع قبل تنفيذ التحويل.");
        return;
      }
      if (!transferTechnicianId) {
        setReceiveMessage("يرجى اختيار المندوب قبل تنفيذ التحويل.");
        return;
      }
    } else if (!storageId) {
      setReceiveMessage("يرجى اختيار موقع التخزين قبل التنفيذ.");
      return;
    }

    const normalized = trimmedValue.toLowerCase();
    const matchedProduct =
      productMasters.find((product) => (product.itemCode ?? "").toLowerCase() === normalized) ||
      productMasters.find((product) => (product.barcode ?? "").toLowerCase() === normalized) ||
      productMasters.find((product) => product.nameAr.toLowerCase().includes(normalized));

    if (!matchedProduct) {
      setReceiveMessage("لم يتم العثور على المنتج. جرّب الباركود أو SKU الصحيح.");
      return;
    }

    try {
      const payload = {
        source: "scanner",
        operationType,
        itemCode: matchedProduct.id,
        packagingType,
        quantity,
        ownerType: !isTransferMode ? storageType : undefined,
        ownerId: !isTransferMode ? storageId : undefined,
        warehouseId: isTransferMode ? transferWarehouseId : undefined,
        technicianId: isTransferMode ? transferTechnicianId : undefined,
        reasonCode:
          operationType === "ADD_STOCK"
            ? "scan_add"
            : operationType === "DEDUCT_STOCK"
              ? "scan_deduct"
              : operationType === "TRANSFER_TO_TECHNICIAN"
                ? "scan_transfer_to_technician"
                : "scan_withdraw_from_technician",
        idempotencyKey: isTransferMode
          ? `${operationType}:${transferWarehouseId}:${transferTechnicianId}:${matchedProduct.id}:${packagingType}:${quantity}:${trimmedValue}`
          : `${storageType}:${storageId}:${matchedProduct.id}:${operationType}:${packagingType}:${quantity}:${trimmedValue}`,
        notes: `scannedValue:${trimmedValue}`,
      };

      await receiveMutation.mutateAsync(payload);

      const selectedWarehouse = warehouseOptions.find((option) => option.id === transferWarehouseId)?.label ?? "مستودع";
      const selectedTechnician = technicianOptions.find((option) => option.id === transferTechnicianId)?.label ?? "مندوب";
      const options = storageType === "warehouse" ? warehouseOptions : technicianOptions;
      const directStorageName = options.find((option) => option.id === storageId)?.label ?? "موقع تخزين";
      const storageName =
        operationType === "TRANSFER_TO_TECHNICIAN"
          ? `${selectedWarehouse} → ${selectedTechnician}`
          : operationType === "WITHDRAW_FROM_TECHNICIAN"
            ? `${selectedTechnician} → ${selectedWarehouse}`
            : directStorageName;

      const newRecord: ProductScanRecord = {
        id: `${Date.now()}-${matchedProduct.id}`,
        itemTypeId: matchedProduct.id,
        itemNameAr: matchedProduct.nameAr,
        quantity,
        operationType,
        packagingType,
        storageType: isTransferMode ? "warehouse" : storageType,
        storageId: isTransferMode ? `${transferWarehouseId}:${transferTechnicianId}` : storageId,
        storageName,
        createdAt: new Date().toISOString(),
      };

      setLatestScans((previous) => [newRecord, ...previous].slice(0, 20));
      setScannedValue("");
      setQuantity(1);
      const operationText =
        operationType === "ADD_STOCK"
          ? "إضافة"
          : operationType === "DEDUCT_STOCK"
            ? "إنقاص"
            : operationType === "TRANSFER_TO_TECHNICIAN"
              ? "تحويل"
              : "سحب";
      const packagingText = packagingType === "box" ? "كرتون" : "وحدة";
      setReceiveMessage(`تم ${operationText} ${quantity} ${packagingText} من ${matchedProduct.nameAr} بنجاح.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ أثناء تسجيل الاستلام.";
      setReceiveMessage(message);
    }
  };

  const isLoading = productsQuery.isLoading || warehousesQuery.isLoading || techniciansInventoriesQuery.isLoading;
  const loadError = productsQuery.error || warehousesQuery.error || techniciansInventoriesQuery.error;

  if (loadError) {
    const message = loadError instanceof Error ? loadError.message : "تعذر تحميل بيانات المنتجات.";
    return (
      <div className="px-4 md:px-6 py-6">
        <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-5 text-center">
          <AlertTriangle className="h-8 w-8 text-orange-300 mx-auto mb-2" />
          <p className="text-orange-200 font-bold mb-1">تعذر تحميل بيانات الصفحة</p>
          <p className="text-orange-100/80 text-sm">{message}</p>
          <p className="text-orange-100/70 text-xs mt-2">إذا كانت الجلسة منتهية، أعد تسجيل الدخول ثم حدّث الصفحة.</p>
        </div>
      </div>
    );
  }

  const handleExportExcel = () => {
    const lines = [
      ["المنتج", "SKU", "المستودعات", "المندوبون", "الإجمالي"].join(","),
      ...filteredRows.map((row) =>
        [row.itemNameAr, row.itemCode, row.warehouseQuantity, row.technicianQuantity, row.totalQuantity].join(",")
      ),
    ];

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "products-distribution.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 md:px-6 py-6">
      <ProductsManagementHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onExportExcel={handleExportExcel}
      />
      <ProductsKpiCards kpis={kpis} />
      <ProductsDistributionTable
        rows={filteredRows}
        isLoading={isLoading}
        onViewDetails={(itemTypeId) => setLocation(`/products-management/${itemTypeId}/details`)}
      />
      <ProductsScanReceiver
        scannedValue={scannedValue}
        onScannedValueChange={setScannedValue}
        operationType={operationType}
        onOperationTypeChange={setOperationType}
        packagingType={packagingType}
        onPackagingTypeChange={setPackagingType}
        quantity={quantity}
        onQuantityChange={setQuantity}
        storageType={storageType}
        onStorageTypeChange={setStorageType}
        storageId={storageId}
        onStorageIdChange={setStorageId}
        transferWarehouseId={transferWarehouseId}
        onTransferWarehouseIdChange={setTransferWarehouseId}
        transferTechnicianId={transferTechnicianId}
        onTransferTechnicianIdChange={setTransferTechnicianId}
        warehouseOptions={warehouseOptions}
        technicianOptions={technicianOptions}
        onReceive={handleReceive}
        latestScans={latestScans}
      />

      {receiveMessage ? (
        <div className="mt-3 text-xs rounded-lg border border-slate-700/70 bg-slate-900/60 text-slate-300 px-3 py-2">
          {receiveMessage}
        </div>
      ) : null}
    </div>
  );
}

