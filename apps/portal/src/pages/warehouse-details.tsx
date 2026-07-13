import { useTranslation } from "@/lib/language";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { exportSingleWarehouseToExcel } from "@/lib/exportToExcel";
import { useActiveItemTypes, buildInventoryDisplayItems, type InventoryEntry } from "@/hooks/use-item-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Warehouse, 
  MapPin, 
  Trash2,
  ArrowRight,
  Send,
  RefreshCw,
  AlertTriangle,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportWarehouseTransferToPDF } from "@/features/warehouse-details/export-transfer-pdf";
import {
  buildTransferExportRows,
  filterWarehouseTransfers,
  groupWarehouseTransfers,
} from "@/features/warehouse-details/transfer-helpers";
import type {
  WarehouseData,
  WarehouseTransfer,
  WarehouseTransferRaw,
} from "@/features/warehouse-details/types";
import { WarehouseOverviewCards } from "@/features/warehouse-details/components/warehouse-overview-cards";
import { WarehouseInventorySection } from "@/features/warehouse-details/components/warehouse-inventory-section";
import { WarehouseTransfersSection } from "@/features/warehouse-details/components/warehouse-transfers-section";
import { WarehouseDetailsModals } from "@/features/warehouse-details/components/warehouse-details-modals";

export default function WarehouseDetailsPage() {
  const { t, language } = useTranslation();
  const [, params] = useRoute("/warehouses/:id");
  const warehouseId = params?.id || "";
  const { toast } = useToast();

  const [showUpdateInventoryModal, setShowUpdateInventoryModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inventorySearchQuery, setInventorySearchQuery] = useState("");
  const [technicianSearchQuery, setTechnicianSearchQuery] = useState("");

  const { data: warehouse, isLoading: warehouseLoading } = useQuery<WarehouseData>({
    queryKey: ["/api/warehouses", warehouseId],
    enabled: !!warehouseId,
  });

  const { data: itemTypesData, refetch: refetchItemTypes } = useActiveItemTypes();

  const { data: inventoryEntriesData } = useQuery<InventoryEntry[]>({
    queryKey: ["/api/warehouses", warehouseId, "inventory-entries"],
    enabled: !!warehouseId,
  });

  const { data: rawTransfers, isLoading: transfersLoading } = useQuery<WarehouseTransferRaw[]>({
    queryKey: ["/api/warehouse-transfers"],
  });

  const allTransfers = useMemo(
    () => groupWarehouseTransfers(rawTransfers, warehouseId),
    [rawTransfers, warehouseId],
  );

  const transfers = useMemo(
    () => filterWarehouseTransfers(allTransfers, searchQuery),
    [allTransfers, searchQuery],
  );

  const deleteWarehouseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/warehouses/${warehouseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({
        title: t('warehouse.completed_delete_warehouse'),
        description: t('warehouse.completed_delete_warehouse_suc'),
      });
      window.location.href = "/warehouses";
    },
    onError: (error: any) => {
      toast({
        title: t('warehouse.error_delete'),
        description: error.message || t('warehouse.error_delete_warehouse'),
        variant: "destructive",
      });
    },
  });

  const exportTransferToPDF = async (transfer: WarehouseTransfer) => {
    await exportWarehouseTransferToPDF({
      transfer,
      warehouse,
      itemTypesData,
    });

    toast({
      title: t('warehouse.completed_loading_successfully'),
      description: t('warehouse.completed_save'),
    });
  };

  const inventoryItems = useMemo(() => {
    if (!itemTypesData) return [];
    return buildInventoryDisplayItems(
      itemTypesData,
      inventoryEntriesData || [],
      warehouse?.inventory as any
    );
  }, [itemTypesData, inventoryEntriesData, warehouse?.inventory]);

  const filteredInventoryItems = useMemo(() => {
    const normalized = inventorySearchQuery.trim().toLowerCase();
    if (!normalized) return inventoryItems;

    return inventoryItems.filter((item) => {
      const nameAr = item.nameAr.toLowerCase();
      const nameEn = item.name.toLowerCase();
      return nameAr.includes(normalized) || nameEn.includes(normalized);
    });
  }, [inventoryItems, inventorySearchQuery]);

  const filteredLinkedTechnicians = useMemo(() => {
    const allTechnicians = warehouse?.technicians || [];
    const normalized = technicianSearchQuery.trim().toLowerCase();

    if (!normalized) return allTechnicians;

    return allTechnicians.filter((technician) => {
      const fullName = technician.fullName.toLowerCase();
      const username = (technician.username || "").toLowerCase();
      const city = (technician.city || "").toLowerCase();
      return fullName.includes(normalized) || username.includes(normalized) || city.includes(normalized);
    });
  }, [warehouse?.technicians, technicianSearchQuery]);

  const handleExportToExcel = async () => {
    if (!warehouse) return;

    // Always fetch the latest item types so any newly added types appear in Excel
    await queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        query.queryKey[0].startsWith("/api/item-types"),
    });
    const fresh = await refetchItemTypes();
    const latestItemTypes = fresh.data ?? itemTypesData;

    const transfersData = buildTransferExportRows(allTransfers, latestItemTypes, language);

    await exportSingleWarehouseToExcel({
      warehouse: {
        name: warehouse.name,
        location: warehouse.location,
        description: warehouse.description
      },
      inventory: warehouse.inventory,
      itemTypes: latestItemTypes?.filter(t => t.isActive && t.isVisible),
      entries: inventoryEntriesData,
      transfers: transfersData
    });

    toast({
      title: t('warehouse.completed_export_successfully'),
      description: t('warehouse.exported_to_excel'),
    });
  };

  if (warehouseLoading) {
    return (
        <div className="-m-8 min-h-[calc(100vh-5rem)] bg-[#F8FAFB] relative overflow-hidden">
          <div className="relative z-10 p-8 space-y-6">
            <Skeleton className="h-24 w-full bg-white/60" />
            <Skeleton className="h-56 w-full bg-white/60" />
            <Skeleton className="h-80 w-full bg-white/60" />
          </div>
        </div>
    );
  }

  if (!warehouse) {
    return (
        <div className="-m-8 min-h-[calc(100vh-5rem)] bg-[#F8FAFB] flex items-center justify-center">
          <div className="text-center rassco-glass rassco-glass-static p-10 max-w-md w-full">
            <Warehouse className="h-14 w-14 mx-auto text-[#18B2B0] mb-4" />
            <h2 className="text-3xl font-bold mb-3 text-[#2D3135]">{t('warehouse.warehouse')}</h2>
            <p className="text-[#6B7280] mb-6">{t('warehouse.data_warehouse')}</p>
            <Link href="/warehouses">
              <Button className="bg-[#18B2B0] text-white hover:bg-[#149D9B]" data-testid="button-back-warehouses">
                {t('warehouse.item_25487')}
              </Button>
            </Link>
          </div>
        </div>
    );
  }

  const totalInventory = inventoryItems.reduce((sum, item) => sum + item.boxes + item.units, 0);
  const maxWarehouseCapacity = 100;
  const inventoryUsagePercent = Math.min(100, Math.round((totalInventory / maxWarehouseCapacity) * 100));
  const availableItemTypesCount = inventoryItems.filter((item) => item.boxes + item.units > 0).length;
  const totalItemTypesCount = inventoryItems.length;
  const availableItemTypesPercent = totalItemTypesCount > 0
    ? Math.min(100, Math.round((availableItemTypesCount / totalItemTypesCount) * 100))
    : 0;

  const getGaugeStyle = (total: number) => {
    if (total <= 3) return { color: "#E05252", glow: "", text: "text-[#E05252]" };
    if (total <= 9) return { color: "#F4B740", glow: "", text: "text-[#8a6410]" };
    return { color: "#18B2B0", glow: "", text: "text-[#149D9B]" };
  };

  return (
    <>
      <div className="-m-8 min-h-[calc(100vh-5rem)] bg-[#F8FAFB] text-[#2D3135] relative overflow-hidden">
        <div className="relative z-10 p-6 md:p-10 space-y-8">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 border-b border-[#E6E8EC] pb-6">
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/warehouses">
                <button className="flex items-center gap-2 text-[#6B7280] hover:text-[#2D3135] transition-colors text-sm" type="button" data-testid="button-back-warehouses">
                  <ArrowRight className="h-4 w-4" />
                  {t('warehouse.item_25487')}
                </button>
              </Link>
              <div className="hidden md:block h-6 w-px bg-[#E6E8EC]" />
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold text-[#2D3135]" data-testid="text-warehouse-name">{warehouse.name}</h2>
                <span
                  className={warehouse.isActive
                    ? "inline-flex items-center gap-2 bg-[#18B2B0]/10 text-[#149D9B] text-xs font-bold px-3 py-1 rounded-full border border-[#18B2B0]/25"
                    : "inline-flex items-center gap-2 bg-[#6B7280]/10 text-[#6B7280] text-xs font-bold px-3 py-1 rounded-full border border-[#6B7280]/25"
                  }
                  data-testid="badge-warehouse-status"
                >
                  <span className={warehouse.isActive ? "size-1.5 rounded-full bg-[#18B2B0]" : "size-1.5 rounded-full bg-[#6B7280]"} />
                  {warehouse.isActive ? t('warehouse.active') : t('warehouse.active_1')}
                </span>
              </div>
              <p className="text-[#6B7280] text-sm flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span data-testid="text-warehouse-location">{warehouse.location}</span>
              </p>
            </div>

            <button className="self-start xl:self-auto flex items-center justify-center rounded-2xl bg-white p-2.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#2D3135] transition-colors border border-[#E6E8EC] relative" type="button">
              <AlertTriangle className="h-5 w-5" />
              <span className="absolute top-2 right-2 size-2 bg-[#F4B740] rounded-full" />
            </button>
          </div>

          <WarehouseOverviewCards
            totalInventory={totalInventory}
            inventoryUsagePercent={inventoryUsagePercent}
            availableItemTypesCount={availableItemTypesCount}
            totalItemTypesCount={totalItemTypesCount}
            availableItemTypesPercent={availableItemTypesPercent}
            warehouseTechnicians={warehouse.technicians}
            filteredLinkedTechnicians={filteredLinkedTechnicians}
            technicianSearchQuery={technicianSearchQuery}
            onTechnicianSearchChange={setTechnicianSearchQuery}
            onClearTechnicianSearch={() => setTechnicianSearchQuery("")}
          />

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleExportToExcel}
              disabled={!warehouse || warehouseLoading}
              className="bg-[#18B2B0]/10 hover:bg-[#18B2B0]/20 text-[#149D9B] border border-[#18B2B0]/25"
              data-testid="button-export-excel"
            >
              <Download className="h-4 w-4 ml-2" />
              {t('warehouse.export_excel')}
            </Button>
            <Button
              onClick={() => setShowUpdateInventoryModal(true)}
              className="bg-[#18B2B0]/10 hover:bg-[#18B2B0]/20 text-[#149D9B] border border-[#18B2B0]/25"
              data-testid="button-update-inventory"
            >
              <RefreshCw className="h-4 w-4 ml-2" />
              {t('warehouse.update_inventory')}
            </Button>
            <Button
              onClick={() => setShowTransferModal(true)}
              className="bg-[#F4B740]/12 hover:bg-[#F4B740]/20 text-[#8a6410] border border-[#F4B740]/30"
              data-testid="button-transfer-to-technician"
            >
              <Send className="h-4 w-4 ml-2" />
              {t('warehouse.item_17640')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="bg-[#E05252]/10 hover:bg-[#E05252]/20 text-[#E05252] border border-[#E05252]/25 ms-auto"
              data-testid="button-delete-warehouse"
            >
              <Trash2 className="h-4 w-4 ml-2" />
              {t('warehouse.delete_warehouse')}
            </Button>
          </div>

          <WarehouseInventorySection
            inventorySearchQuery={inventorySearchQuery}
            onInventorySearchChange={setInventorySearchQuery}
            onClearInventorySearch={() => setInventorySearchQuery("")}
            filteredInventoryItems={filteredInventoryItems}
            getGaugeStyle={getGaugeStyle}
          />

          <WarehouseTransfersSection
            allTransfersCount={allTransfers.length}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={() => setSearchQuery("")}
            onExportAll={handleExportToExcel}
            transfersLoading={transfersLoading}
            transfers={transfers}
            itemTypesData={itemTypesData}
            onExportTransferPdf={exportTransferToPDF}
          />
        </div>
      </div>

      <WarehouseDetailsModals
        warehouseId={warehouseId}
        warehouse={warehouse}
        inventoryEntriesData={inventoryEntriesData || []}
        showUpdateInventoryModal={showUpdateInventoryModal}
        setShowUpdateInventoryModal={setShowUpdateInventoryModal}
        showTransferModal={showTransferModal}
        setShowTransferModal={setShowTransferModal}
        showDeleteDialog={showDeleteDialog}
        setShowDeleteDialog={setShowDeleteDialog}
        onDeleteWarehouse={() => deleteWarehouseMutation.mutate()}
      />
    </>
  );
}

