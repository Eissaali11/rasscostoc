import { useTranslation } from "@/lib/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductScanRecord, StorageBucketType } from "../types";
import { ScanLine } from "lucide-react";

type StorageOption = {
  id: string;
  label: string;
};

type ProductsScanReceiverProps = {
  scannedValue: string;
  onScannedValueChange: (value: string) => void;
  operationType: "ADD_STOCK" | "DEDUCT_STOCK" | "TRANSFER_TO_TECHNICIAN" | "WITHDRAW_FROM_TECHNICIAN";
  onOperationTypeChange: (value: "ADD_STOCK" | "DEDUCT_STOCK" | "TRANSFER_TO_TECHNICIAN" | "WITHDRAW_FROM_TECHNICIAN") => void;
  packagingType: "box" | "unit";
  onPackagingTypeChange: (value: "box" | "unit") => void;
  quantity: number;
  onQuantityChange: (value: number) => void;
  storageType: StorageBucketType;
  onStorageTypeChange: (value: StorageBucketType) => void;
  storageId: string;
  onStorageIdChange: (value: string) => void;
  transferWarehouseId: string;
  onTransferWarehouseIdChange: (value: string) => void;
  transferTechnicianId: string;
  onTransferTechnicianIdChange: (value: string) => void;
  warehouseOptions: StorageOption[];
  technicianOptions: StorageOption[];
  onReceive: () => void;
  latestScans: ProductScanRecord[];
};

export function ProductsScanReceiver({
  scannedValue,
  onScannedValueChange,
  operationType,
  onOperationTypeChange,
  packagingType,
  onPackagingTypeChange,
  quantity,
  onQuantityChange,
  storageType,
  onStorageTypeChange,
  storageId,
  onStorageIdChange,
  transferWarehouseId,
  onTransferWarehouseIdChange,
  transferTechnicianId,
  onTransferTechnicianIdChange,
  warehouseOptions,
  technicianOptions,
  onReceive,
  latestScans,
}: ProductsScanReceiverProps) {
  const { t } = useTranslation();
  const storageOptions = storageType === "warehouse" ? warehouseOptions : technicianOptions;
  const isTransferMode = operationType === "TRANSFER_TO_TECHNICIAN" || operationType === "WITHDRAW_FROM_TECHNICIAN";
  const operationLabel =
    operationType === "ADD_STOCK"
      ? t('common.add')
      : operationType === "DEDUCT_STOCK"
        ? t('common.item_7945_1')
        : operationType === "TRANSFER_TO_TECHNICIAN"
          ? t('common.transfer_5')
          : t('common.withdraw_technician_1');

  return (
    <section className="rassco-glass rassco-glass-static p-5 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#2D3135] text-lg font-bold">{t('common.scanner')}</h3>
        <div className="inline-flex items-center gap-2 text-[#18B2B0] text-sm font-semibold">
          <ScanLine className="h-4 w-4" />
          {t('inventory.flutter_no')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        <Input
          value={scannedValue}
          onChange={(event) => onScannedValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onReceive();
            }
          }}
          placeholder={t('common.code_name')}
          className="md:col-span-2 bg-white border-[#E6E8EC] text-[#2D3135]"
        />

        <Select
          value={operationType}
          onValueChange={(value) =>
            onOperationTypeChange(value as "ADD_STOCK" | "DEDUCT_STOCK" | "TRANSFER_TO_TECHNICIAN" | "WITHDRAW_FROM_TECHNICIAN")
          }
        >
          <SelectTrigger className="bg-white border-[#E6E8EC] text-[#2D3135]">
            <SelectValue placeholder={t('common.type_transaction')} />
          </SelectTrigger>
          <SelectContent className="bg-white border-[#E6E8EC] text-[#2D3135]">
            <SelectItem value="ADD_STOCK">{t('common.add_11')}</SelectItem>
            <SelectItem value="DEDUCT_STOCK">{t('common.item_14344')}</SelectItem>
            <SelectItem value="TRANSFER_TO_TECHNICIAN">{t('common.transfer_warehouse')}</SelectItem>
            <SelectItem value="WITHDRAW_FROM_TECHNICIAN">{t('common.withdraw_warehouse')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={packagingType} onValueChange={(value) => onPackagingTypeChange(value as "box" | "unit")}>
          <SelectTrigger className="bg-white border-[#E6E8EC] text-[#2D3135]">
            <SelectValue placeholder={t('common.type_10')} />
          </SelectTrigger>
          <SelectContent className="bg-white border-[#E6E8EC] text-[#2D3135]">
            <SelectItem value="box">{t('common.box')}</SelectItem>
            <SelectItem value="unit">{t('common.unit_1')}</SelectItem>
          </SelectContent>
        </Select>

        {isTransferMode ? (
          <>
            <Select value={transferWarehouseId} onValueChange={onTransferWarehouseIdChange}>
              <SelectTrigger className="bg-white border-[#E6E8EC] text-[#2D3135]">
                <SelectValue placeholder={t('common.warehouse_10')} />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#E6E8EC] text-[#2D3135]">
                {warehouseOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={transferTechnicianId} onValueChange={onTransferTechnicianIdChange}>
              <SelectTrigger className="bg-white border-[#E6E8EC] text-[#2D3135]">
                <SelectValue placeholder={t('common.technician_11')} />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#E6E8EC] text-[#2D3135]">
                {technicianOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : (
          <>
            <Select value={storageType} onValueChange={(value) => onStorageTypeChange(value as StorageBucketType)}>
              <SelectTrigger className="bg-white border-[#E6E8EC] text-[#2D3135]">
                <SelectValue placeholder={t('common.type_11')} />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#E6E8EC] text-[#2D3135]">
                <SelectItem value="warehouse">{t('common.warehouses')}</SelectItem>
                <SelectItem value="technician">{t('common.couriers_6')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={storageId} onValueChange={onStorageIdChange}>
              <SelectTrigger className="bg-white border-[#E6E8EC] text-[#2D3135]">
                <SelectValue placeholder={t('common.signed_4')} />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#E6E8EC] text-[#2D3135]">
                {storageOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => onQuantityChange(Number(event.target.value || 1))}
            className="w-24 bg-white border-[#E6E8EC] text-[#2D3135]"
          />
          <Button onClick={onReceive} className="bg-[#18B2B0] border border-[#18B2B0] text-white hover:bg-[#149D9B]">
            {t('common.item_11097')}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-[#6B7280] mt-2">{t('common.item_17609')}{operationLabel}</p>

      <div className="mt-4 border-t border-[#E6E8EC] pt-4">
        <p className="text-xs text-[#6B7280] mb-2">{t('common.scan_3')}</p>
        <div className="max-h-36 overflow-y-auto space-y-2">
          {latestScans.length === 0 ? (
            <div className="text-xs text-[#9AA1AB]">{t('common.no_scan')}</div>
          ) : (
            latestScans.slice(0, 8).map((scan) => (
              <div key={scan.id} className="text-xs bg-[#F3F4F6] border border-[#E6E8EC] rounded px-3 py-2 flex items-center justify-between">
                <span className="text-[#2D3135]">
                  {scan.itemNameAr} • {scan.storageName} • {scan.packagingType === "box" ? t('common.box') : t('common.unit_1')}
                </span>
                <span className={`font-mono font-semibold ${scan.operationType === "ADD_STOCK" ? "text-[#149D9B]" : "text-[#E05252]"}`}>
                  {scan.operationType === "ADD_STOCK" || scan.operationType === "TRANSFER_TO_TECHNICIAN" ? "+" : "-"}
                  {scan.quantity}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

