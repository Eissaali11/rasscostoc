import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Minus, Plus, Search, Send, Trash2, Warehouse, X, XCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getItemTypeVisuals, legacyFieldMapping, useActiveItemTypes } from "@/hooks/use-item-types";
import type { TechnicianMovingInventoryEntry, UserSafe } from "@shared/schema";

const formSchema = z.object({
  warehouseId: z.string().min(1, "يجب اختيار المستودع"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

type TransferItem = {
  selected: boolean;
  quantity: number;
  packagingType: "box" | "unit";
};

type WarehouseOption = {
  id: string;
  name: string;
  location: string;
};

type LegacyMovingInventory = Record<string, number> & {
  id?: string;
  entries?: Array<{ itemTypeId: string; boxes: number; units: number }>;
};

type PriorityLevel = "normal" | "urgent" | "critical";
type SupplyType = "static" | "mobile";
type ItemViewMode = "all" | "selected";

interface WithdrawFromTechnicianModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicianId: string;
  technicianName: string;
  movingInventoryFallback?: LegacyMovingInventory | null;
}

export default function WithdrawFromTechnicianModal({
  open,
  onOpenChange,
  technicianId,
  technicianName,
  movingInventoryFallback,
}: WithdrawFromTechnicianModalProps) {
  const { toast } = useToast();

  const [itemTransfers, setItemTransfers] = useState<Record<string, TransferItem>>({});
  const [priority, setPriority] = useState<PriorityLevel>("urgent");
  const [supplyType, setSupplyType] = useState<SupplyType>("static");
  const [itemViewMode, setItemViewMode] = useState<ItemViewMode>("all");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);

  const { data: authData } = useQuery<{ user: UserSafe }>({
    queryKey: ["/api/auth/me"],
  });
  const currentUser = authData?.user;

  const { data: itemTypes, isLoading: itemTypesLoading } = useActiveItemTypes();

  const { data: movingEntries = [] } = useQuery<TechnicianMovingInventoryEntry[]>({
    queryKey: [`/api/technicians/${technicianId}/moving-inventory-entries`],
    enabled: open && !!technicianId,
  });

  const { data: legacyMovingInventory } = useQuery<LegacyMovingInventory | null>({
    queryKey: [`/api/supervisor/users/${technicianId}/moving-inventory`],
    enabled: open && !!technicianId && currentUser?.role === "supervisor",
  });

  const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
    queryKey: currentUser?.role === "admin" ? ["/api/warehouses"] : ["/api/supervisor/warehouses"],
    enabled: open && !!currentUser,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      warehouseId: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) {
      setPriority("urgent");
      setSupplyType("static");
      setItemViewMode("all");
      setProductSearchQuery("");
      form.reset();
      setItemTransfers({});
      return;
    }

    if (itemTypes && itemTypes.length > 0) {
      const initialState: Record<string, TransferItem> = {};
      const defaultPackaging = supplyType === "static" ? "box" : "unit";

      for (const itemType of itemTypes) {
        initialState[itemType.id] = {
          selected: false,
          quantity: 0,
          packagingType: "unit",
        };
      }

      setItemTransfers(initialState);
    }
  }, [open, form, itemTypes]);

  useEffect(() => {
    if (!open || itemTypesLoading) return;

    const timer = window.setTimeout(() => {
      productSearchInputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [open, itemTypesLoading]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isFindShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f";
      if (!isFindShortcut) return;

      event.preventDefault();
      productSearchInputRef.current?.focus();
      productSearchInputRef.current?.select();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const effectiveLegacyMovingInventory = useMemo(
    () => legacyMovingInventory || movingInventoryFallback || null,
    [legacyMovingInventory, movingInventoryFallback],
  );

  const movingEntryMap = useMemo(() => {
    const fallbackEntries = Array.isArray(effectiveLegacyMovingInventory?.entries)
      ? effectiveLegacyMovingInventory.entries
      : [];

    const sourceEntries = movingEntries.length > 0 ? movingEntries : fallbackEntries;
    return new Map(sourceEntries.map((entry) => [entry.itemTypeId, entry]));
  }, [movingEntries, effectiveLegacyMovingInventory]);

  const availableStock = (itemTypeId: string, packagingType: "box" | "unit") => {
    const entry = movingEntryMap.get(itemTypeId);
    if (entry) {
      return packagingType === "box" ? Number(entry.boxes || 0) : Number(entry.units || 0);
    }

    if (!effectiveLegacyMovingInventory) {
      return 0;
    }

    const legacy = legacyFieldMapping[itemTypeId];
    if (!legacy) {
      return 0;
    }

    return packagingType === "box"
      ? Number((effectiveLegacyMovingInventory as any)[legacy.boxes] || 0)
      : Number((effectiveLegacyMovingInventory as any)[legacy.units] || 0);
  };

  const getPreferredPackagingType = (itemTypeId: string): "box" | "unit" => {
    const availableBoxes = availableStock(itemTypeId, "box");
    if (availableBoxes > 0) {
      return "box";
    }

    return "unit";
  };

  const visibleItems = useMemo(() => {
    if (!itemTypes) {
      return [];
    }

    const categoryCounter: Record<string, number> = {};

    return itemTypes
      .filter((itemType) => itemType.isActive && itemType.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((itemType, index) => {
        const categoryIndex = categoryCounter[itemType.category] || 0;
        categoryCounter[itemType.category] = categoryIndex + 1;
        const visuals = getItemTypeVisuals(itemType, categoryIndex);

        return {
          id: itemType.id,
          nameAr: itemType.nameAr,
          nameEn: itemType.nameEn,
          icon: visuals.icon,
          availableBoxes: availableStock(itemType.id, "box"),
          availableUnits: availableStock(itemType.id, "unit"),
          barcode: `BRC-${892000 + index * 37}`,
        };
      });
  }, [itemTypes, movingEntries, effectiveLegacyMovingInventory]);

  const selectedItems = useMemo(() => {
    const selectedIds = Object.entries(itemTransfers)
      .filter(([, transfer]) => transfer.selected)
      .map(([itemTypeId]) => itemTypeId);

    return visibleItems.filter((item) => selectedIds.includes(item.id));
  }, [itemTransfers, visibleItems]);

  const availableItemsForSupply = useMemo(() => {
    return visibleItems
      .map((item) => ({
        ...item,
        availableForSupply: item.availableBoxes + item.availableUnits,
      }))
      .filter((item) => item.availableForSupply > 0);
  }, [visibleItems]);

  const displayedItems = useMemo(() => {
    if (itemViewMode === "selected") {
      return availableItemsForSupply.filter((item) => itemTransfers[item.id]?.selected);
    }

    return availableItemsForSupply;
  }, [availableItemsForSupply, itemTransfers, itemViewMode]);

  const filteredDisplayedItems = useMemo(() => {
    const normalized = productSearchQuery.trim().toLowerCase();
    if (!normalized) return displayedItems;

    return displayedItems.filter((item) => {
      const nameAr = (item.nameAr || "").toLowerCase();
      const nameEn = (item.nameEn || "").toLowerCase();
      const barcode = (item.barcode || "").toLowerCase();
      return nameAr.includes(normalized) || nameEn.includes(normalized) || barcode.includes(normalized);
    });
  }, [displayedItems, productSearchQuery]);

  const updateItemTransfer = (itemTypeId: string, patch: Partial<TransferItem>) => {
    setItemTransfers((previous) => ({
      ...previous,
      [itemTypeId]: {
        ...previous[itemTypeId],
        selected: previous[itemTypeId]?.selected ?? false,
        quantity: previous[itemTypeId]?.quantity ?? 0,
        packagingType: previous[itemTypeId]?.packagingType ?? "unit",
        ...patch,
      },
    }));
  };

  const removeItem = (itemTypeId: string) => {
    updateItemTransfer(itemTypeId, {
      selected: false,
      quantity: 0,
    });
  };

  const selectAllAvailableItems = () => {
    setItemTransfers((previous) => {
      const nextState = { ...previous };

      for (const item of availableItemsForSupply) {
        const packagingType = getPreferredPackagingType(item.id);
        const previousTransfer = nextState[item.id];
        const maxQty = availableStock(item.id, packagingType);

        nextState[item.id] = {
          selected: true,
          packagingType,
          quantity: previousTransfer?.quantity && previousTransfer.quantity > 0
            ? Math.min(previousTransfer.quantity, maxQty)
            : 1,
        };
      }

      return nextState;
    });
  };

  const clearAllSelections = () => {
    setItemTransfers((previous) => {
      const nextState: Record<string, TransferItem> = {};

      for (const [itemTypeId, transfer] of Object.entries(previous)) {
        nextState[itemTypeId] = {
          ...transfer,
          selected: false,
          quantity: 0,
        };
      }

      return nextState;
    });
  };

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const selected = Object.entries(itemTransfers)
        .filter(([, transfer]) => transfer.selected && transfer.quantity > 0)
        .map(([itemTypeId, transfer]) => ({
          itemTypeId,
          packagingType: transfer.packagingType,
          quantity: transfer.quantity,
        }));

      const notesWithPriority = [
        data.notes?.trim() || "",
        `الأولوية: ${priority === "urgent" ? "عاجل" : priority === "critical" ? "طارئ" : "عادي"}`,
      ]
        .filter(Boolean)
        .join(" | ");

      const response = await apiRequest("POST", `/api/technicians/${technicianId}/withdraw-to-warehouse`, {
        warehouseId: data.warehouseId,
        notes: notesWithPriority,
        items: selected,
      });

      return response.json();
    },
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: [`/api/supervisor/users/${technicianId}/moving-inventory`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/technicians/${technicianId}/moving-inventory-entries`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/supervisor/warehouses"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/warehouse-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/warehouse-inventory", variables.warehouseId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/warehouses", variables.warehouseId, "inventory-entries"] });

      toast({
        title: "تم السحب بنجاح",
        description: "تم تحويل المخزون من المندوب إلى المستودع",
      });

      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "فشل عملية السحب",
        description: error?.message || "حدث خطأ أثناء سحب المخزون",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    const selected = Object.entries(itemTransfers)
      .filter(([, transfer]) => transfer.selected && transfer.quantity > 0);

    if (selected.length === 0) {
      toast({
        title: "لا توجد أصناف محددة",
        description: "اختر صنفًا واحدًا على الأقل مع كمية صحيحة",
        variant: "destructive",
      });
      return;
    }

    for (const [itemTypeId, transfer] of selected) {
      const available = availableStock(itemTypeId, transfer.packagingType);
      if (transfer.quantity > available) {
        const itemName = visibleItems.find((item) => item.id === itemTypeId)?.nameAr || itemTypeId;
        toast({
          title: "كمية غير متاحة",
          description: `${itemName}: المطلوب ${transfer.quantity} والمتاح ${available}`,
          variant: "destructive",
        });
        return;
      }
    }

    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-3xl p-0 border border-cyan-400/20 bg-[#162e30]/85 backdrop-blur-2xl text-slate-100 [&>button]:hidden">
        <DialogHeader className="px-6 py-5 border-b border-cyan-400/10 bg-[#162e30]/70 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-cyan-400/10 border border-cyan-300/30 flex items-center justify-center shadow-[0_0_15px_rgba(13,223,242,0.2)]">
                <Warehouse className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">سحب مخزون المندوب</DialogTitle>
                <DialogDescription className="text-xs text-cyan-300/70 mt-1">
                  إدارة طلب سحب الأصناف وتحويلها للمستودع
                </DialogDescription>
              </div>
            </div>

            <DialogClose className="size-8 rounded-full text-slate-400 hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors flex items-center justify-center">
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
        </DialogHeader>

        {itemTypesLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-h-[85vh] flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">المندوب المستلم</label>
                <div className="flex items-center gap-3 p-3 bg-[#102222]/70 border border-cyan-400/10 rounded-xl">
                  <div className="size-10 rounded-full border border-cyan-300/30 bg-slate-800 flex items-center justify-center text-cyan-200 font-bold shrink-0">
                    {(technicianName || "ف").slice(0, 1)}
                  </div>
                  <div>
                    <span className="text-slate-100 font-bold block">{technicianName}</span>
                    <span className="text-cyan-300/70 text-xs">مندوب صيانة وتمديد</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">نوع التوريد</label>
                  <div className="relative">
                    <select
                      value={supplyType}
                      onChange={(event) => setSupplyType(event.target.value as SupplyType)}
                      className="w-full appearance-none bg-[#102222]/70 border border-cyan-400/20 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 outline-none"
                    >
                      <option value="static">مخزون ثابت</option>
                      <option value="mobile">مخزون متحرك</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">المستودع المستلم</label>
                  <div className="relative">
                    <select
                      value={form.watch("warehouseId")}
                      onChange={(event) => form.setValue("warehouseId", event.target.value, { shouldValidate: true })}
                      className="w-full appearance-none bg-[#102222]/70 border border-cyan-400/20 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400 outline-none"
                    >
                      <option value="">اختر المستودع</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} - {warehouse.location}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.formState.errors.warehouseId && (
                    <p className="text-red-300 text-xs mt-1">{form.formState.errors.warehouseId.message}</p>
                  )}
                </div>
              </div>

              <div className="p-4 bg-[#102222]/60 rounded-xl border border-cyan-400/10 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <label className="block text-sm font-medium text-slate-300">الأصناف المتوفرة للتحديد</label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setItemViewMode("all")}
                      className={
                        itemViewMode === "all"
                          ? "px-3 py-1.5 text-xs rounded-lg border border-cyan-300/35 bg-cyan-400/20 text-cyan-200"
                          : "px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300"
                      }
                    >
                      الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemViewMode("selected")}
                      className={
                        itemViewMode === "selected"
                          ? "px-3 py-1.5 text-xs rounded-lg border border-cyan-300/35 bg-cyan-400/20 text-cyan-200"
                          : "px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300"
                      }
                    >
                      حسب التحديد ({selectedItems.length})
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllAvailableItems}
                    className="px-3 py-1.5 text-xs rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={clearAllSelections}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/70"
                  >
                    إلغاء التحديد
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">البحث عن المنتج</label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-300/70" />
                    <input
                      ref={productSearchInputRef}
                      type="text"
                      value={productSearchQuery}
                      onChange={(event) => setProductSearchQuery(event.target.value)}
                      placeholder="ابحث بالاسم أو الباركود"
                      className="w-full bg-[#0f2526] border border-cyan-400/20 rounded-xl px-4 py-2.5 pr-10 pl-10 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400 outline-none"
                    />
                    {productSearchQuery.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setProductSearchQuery("")}
                        aria-label="مسح البحث"
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-cyan-300/70 hover:text-cyan-200 hover:bg-cyan-400/10 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">عرض {filteredDisplayedItems.length} من {displayedItems.length} صنف</p>
                </div>

                <div className="space-y-3">
                  {filteredDisplayedItems.map((item) => {
                    const transfer = itemTransfers[item.id];
                    const isSelected = !!transfer?.selected;
                    const quantity = transfer?.quantity || 0;
                    const packagingType = transfer?.packagingType || "unit";
                    const maxQty = availableStock(item.id, packagingType);
                    const Icon = item.icon;

                    return (
                      <div key={`selected-${item.id}`} className="flex items-center justify-between p-3 bg-[#102222]/80 border border-cyan-400/20 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => {
                              const preferredPackaging = getPreferredPackagingType(item.id);
                              const maxQty = availableStock(item.id, preferredPackaging);

                              updateItemTransfer(item.id, {
                                selected: event.target.checked,
                                quantity: event.target.checked ? (quantity > 0 ? Math.min(quantity, maxQty) : 1) : 0,
                                packagingType: preferredPackaging,
                              });
                            }}
                            className="size-4 accent-cyan-400"
                          />
                          <div className="size-8 rounded-lg bg-cyan-400/10 border border-cyan-300/25 flex items-center justify-center text-cyan-300">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-slate-200 text-sm font-medium block truncate">{item.nameAr}</span>
                            <span className="text-slate-500 text-xs">
                              {item.barcode} • المتاح: {item.availableForSupply}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">الكمية:</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isSelected) return;
                              updateItemTransfer(item.id, { quantity: Math.max(0, quantity - 1) });
                            }}
                            className="size-8 rounded-lg border border-cyan-400/30 bg-[#0f2526] text-cyan-300 hover:bg-cyan-400/10 transition-colors flex items-center justify-center disabled:opacity-50"
                            disabled={!isSelected || quantity <= 0}
                            aria-label="إنقاص الكمية"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={maxQty}
                            value={quantity}
                            disabled={!isSelected}
                            onChange={(event) => {
                              const next = parseInt(event.target.value || "0", 10) || 0;
                              updateItemTransfer(item.id, { quantity: Math.max(0, Math.min(maxQty, next)) });
                            }}
                            className="w-16 bg-[#0f2526] border border-cyan-400/30 rounded-lg px-2 py-1.5 text-center text-slate-100 focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400 outline-none disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!isSelected) return;
                              updateItemTransfer(item.id, { quantity: Math.min(maxQty, quantity + 1) });
                            }}
                            className="size-8 rounded-lg border border-cyan-400/30 bg-[#0f2526] text-cyan-300 hover:bg-cyan-400/10 transition-colors flex items-center justify-center disabled:opacity-50"
                            disabled={!isSelected || quantity >= maxQty}
                            aria-label="زيادة الكمية"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isSelected) return;
                              updateItemTransfer(item.id, { quantity: maxQty });
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 text-xs hover:bg-cyan-400/20 transition-colors disabled:opacity-50"
                            disabled={!isSelected || maxQty === 0}
                          >
                            الحد الأقصى
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-red-400/70 hover:text-red-300 hover:bg-red-400/10 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                            disabled={!isSelected}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredDisplayedItems.length === 0 && (
                    <div className="text-sm text-slate-500 text-center py-3 border border-dashed border-cyan-400/20 rounded-xl">
                      لا توجد أصناف مطابقة للبحث أو العرض الحالي.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">الأولوية</label>
                <div className="grid grid-cols-3 gap-2 bg-[#102222]/70 p-1.5 rounded-xl border border-cyan-400/10">
                  <button
                    type="button"
                    onClick={() => setPriority("normal")}
                    className={
                      priority === "normal"
                        ? "py-2.5 text-sm font-bold bg-slate-700/50 text-slate-200 rounded-lg border border-slate-500/50"
                        : "py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 rounded-lg"
                    }
                  >
                    عادي
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority("urgent")}
                    className={
                      priority === "urgent"
                        ? "py-2.5 text-sm font-bold bg-cyan-400/20 text-cyan-300 border border-cyan-300/40 rounded-lg shadow-[0_0_15px_rgba(13,223,242,0.2)] flex items-center justify-center gap-2"
                        : "py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 rounded-lg"
                    }
                  >
                    {priority === "urgent" && <span className="size-2 rounded-full bg-cyan-300 animate-pulse" />}
                    عاجل
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority("critical")}
                    className={
                      priority === "critical"
                        ? "py-2.5 text-sm font-bold bg-orange-400/20 text-orange-300 border border-orange-300/40 rounded-lg"
                        : "py-2.5 text-sm text-orange-300/70 hover:text-orange-300 hover:bg-orange-400/10 rounded-lg"
                    }
                  >
                    طارئ
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">ملاحظات إضافية</label>
                <textarea
                  rows={3}
                  value={form.watch("notes") || ""}
                  onChange={(event) => form.setValue("notes", event.target.value)}
                  placeholder="أضف أي ملاحظات أو تعليمات خاصة هنا..."
                  className="w-full bg-[#102222]/70 border border-cyan-400/20 rounded-xl p-4 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400 outline-none resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-cyan-400/10 bg-[#162e30]/70 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
                className="px-6 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-all font-medium"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 text-[#102222] font-bold shadow-[0_0_20px_rgba(13,223,242,0.3)] hover:shadow-[0_0_30px_rgba(13,223,242,0.5)] transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    إرسال الطلب
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

