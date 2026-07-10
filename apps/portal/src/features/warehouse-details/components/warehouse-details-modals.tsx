import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import UpdateWarehouseInventoryModal from "@/components/update-warehouse-inventory-modal";
import TransferFromWarehouseModal from "@/components/transfer-from-warehouse-modal";
import type { InventoryEntry } from "@/hooks/use-item-types";
import type { WarehouseData } from "@/features/warehouse-details/types";

type WarehouseDetailsModalsProps = {
  warehouseId: string;
  warehouse: WarehouseData;
  inventoryEntriesData: InventoryEntry[];
  showUpdateInventoryModal: boolean;
  setShowUpdateInventoryModal: (open: boolean) => void;
  showTransferModal: boolean;
  setShowTransferModal: (open: boolean) => void;
  showDeleteDialog: boolean;
  setShowDeleteDialog: (open: boolean) => void;
  onDeleteWarehouse: () => void;
};

export function WarehouseDetailsModals({
  warehouseId,
  warehouse,
  inventoryEntriesData,
  showUpdateInventoryModal,
  setShowUpdateInventoryModal,
  showTransferModal,
  setShowTransferModal,
  showDeleteDialog,
  setShowDeleteDialog,
  onDeleteWarehouse,
}: WarehouseDetailsModalsProps) {
  return (
    <>
      <UpdateWarehouseInventoryModal
        open={showUpdateInventoryModal}
        onOpenChange={setShowUpdateInventoryModal}
        warehouseId={warehouseId}
        currentInventory={warehouse.inventory}
        currentEntries={inventoryEntriesData || []}
      />

      <TransferFromWarehouseModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        warehouseId={warehouseId}
        warehouseName={warehouse.name}
        currentInventory={warehouse.inventory}
        currentEntries={inventoryEntriesData || []}
        warehouseTechnicians={warehouse.technicians}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#0f0f15] border-[#18B2B0]/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              سيتم حذف المستودع نهائياً ولن يمكن استرجاعه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteWarehouse}
              className="bg-red-600 hover:bg-red-700"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
