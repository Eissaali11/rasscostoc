import { useTranslation, t } from "@/lib/language";
import { useMemo, useState } from "react";
import { ChevronDown, Eye, Package, Repeat2, UserCog, Warehouse } from "lucide-react";
import type { ProductDistributionRow } from "../types";

type ProductsDistributionTableProps = {
  rows: ProductDistributionRow[];
  isLoading?: boolean;
  onViewDetails?: (itemTypeId: string) => void;
};

export function ProductsDistributionTable({ rows, isLoading = false, onViewDetails }: ProductsDistributionTableProps) {
  const [expandedItemTypeId, setExpandedItemTypeId] = useState<string | null>(null);

  const displayedRows = useMemo(() => rows.slice(0, 50), [rows]);

  const trendPath = (row: ProductDistributionRow) => {
  const { t } = useTranslation();
    const ratio = row.totalQuantity > 0 ? Math.round((row.technicianQuantity / row.totalQuantity) * 100) : 0;
    if (ratio >= 60) {
      return "M0 14 Q 10 8, 20 11 T 40 6 T 60 9 T 80 4";
    }
    if (ratio >= 35) {
      return "M0 10 Q 10 5, 20 15 T 40 10 T 60 14 T 80 7";
    }
    return "M0 6 Q 12 12, 25 9 T 45 14 T 65 10 T 80 15";
  };

  const groupedDetails = (row: ProductDistributionRow) => {
    const warehouses = row.locations.filter((location) => location.storageType === "warehouse");
    const technicians = row.locations.filter((location) => location.storageType === "technician");
    return { warehouses, technicians };
  };

  return (
    <section className="flex flex-col gap-4 mt-5">
      <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#E6E8EC] mb-2">
        <div className="col-span-3">{t('common.item_9548')}</div>
        <div className="col-span-2 text-center">{t('common.warehouses_home')}</div>
        <div className="col-span-2 text-center">{t('common.couriers_5')}</div>
        <div className="col-span-2 text-center">{t('common.total_6')}</div>
        <div className="col-span-2 text-center">{t('common.transaction_2')}</div>
        <div className="col-span-1 text-center">{t('common.item_11035')}</div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-[#6B7280] rassco-glass rassco-glass-static">{t('common.loading_data_3')}</div>
      ) : displayedRows.length === 0 ? (
        <div className="py-10 text-center text-[#6B7280] rassco-glass rassco-glass-static">{t('common.no_data_6')}</div>
      ) : (
        displayedRows.map((row) => {
          const isExpanded = expandedItemTypeId === row.itemTypeId;
          const { warehouses, technicians } = groupedDetails(row);

          return (
            <article
              key={row.itemTypeId}
              className={`rassco-glass rassco-glass-static p-4 transition-all relative overflow-hidden ${
                isExpanded ? "ring-2 ring-[#18B2B0]/30" : ""
              }`}
            >
              {isExpanded && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#18B2B0]" />}

              <div className="grid grid-cols-12 gap-4 items-center relative z-10">
                <div className="col-span-3 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#F3F4F6] border border-[#E6E8EC] flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-[#6B7280]" />
                  </div>
                  <div>
                    <h4 className="text-[#2D3135] font-bold text-base">{row.itemNameAr}</h4>
                    <p className="text-[#6B7280] text-xs font-mono mt-0.5">SKU: {row.itemCode}</p>
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-center gap-2">
                  <Warehouse className="h-4 w-4 text-[#6B7280]" />
                  <span className="text-[#2D3135] font-mono text-sm">{row.warehouseQuantity.toLocaleString("en-US")}</span>
                </div>

                <div className="col-span-2 flex items-center justify-center gap-2">
                  <UserCog className="h-4 w-4 text-[#F4B740]" />
                  <span className="text-[#2D3135] font-mono text-sm">{row.technicianQuantity.toLocaleString("en-US")}</span>
                </div>

                <div className="col-span-2 flex justify-center">
                  <span className="text-[#149D9B] font-bold font-mono text-base px-3 py-1 bg-[#18B2B0]/10 rounded border border-[#18B2B0]/20">
                    {row.totalQuantity.toLocaleString("en-US")}
                  </span>
                </div>

                <div className="col-span-2 flex justify-center items-center h-8">
                  <svg className="stroke-[#18B2B0]" width="80" height="20" viewBox="0 0 80 20">
                    <path d={trendPath(row)} fill="none" strokeLinecap="round" strokeWidth="1.5" />
                  </svg>
                </div>

                <div className="col-span-1 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onViewDetails?.(row.itemTypeId)}
                    className="w-8 h-8 rounded-lg bg-[#F3F4F6] hover:bg-[#E6E8EC] border border-[#E6E8EC] flex items-center justify-center text-[#6B7280] hover:text-[#2D3135] transition-colors"
                    title={t('common.details_4')}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg bg-[#18B2B0]/10 hover:bg-[#18B2B0]/20 border border-[#18B2B0]/20 flex items-center justify-center text-[#18B2B0] transition-colors"
                    title={t('common.transfer')}
                  >
                    <Repeat2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedItemTypeId(isExpanded ? null : row.itemTypeId)}
                    className="w-8 h-8 rounded-lg bg-[#18B2B0] border border-[#18B2B0] flex items-center justify-center text-white transition-colors"
                    title={isExpanded ? t('common.item_3201') : t('common.view_details_5')}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-[#E6E8EC] grid grid-cols-1 lg:grid-cols-2 gap-6 pl-4 pr-2">
                  <div>
                    <h5 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-[#6B7280]" />
                      {t('inventory.details_warehouses_count', { count: row.warehouseQuantity.toLocaleString("en-US") })}
                    </h5>
                    <div className="space-y-2">
                      {warehouses.length === 0 ? (
                        <div className="text-xs text-[#6B7280] bg-[#F3F4F6] px-3 py-2 rounded">{t('common.no_16')}</div>
                      ) : (
                        warehouses.map((location, index) => (
                          <div key={`${location.storageType}-${location.storageId}-${index}`} className="flex justify-between items-center text-sm bg-[#F3F4F6] px-3 py-2 rounded">
                            <span className="text-[#2D3135]">{location.storageName}</span>
                            <span className="font-mono text-[#2D3135]">{location.quantity.toLocaleString("en-US")}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-[#F4B740]" />
                      {t('inventory.technician_count', { count: row.technicianQuantity.toLocaleString("en-US") })}
                    </h5>
                    <div className="space-y-2">
                      {technicians.length === 0 ? (
                        <div className="text-xs text-[#6B7280] bg-[#F3F4F6] px-3 py-2 rounded">{t('common.no_17')}</div>
                      ) : (
                        technicians
                          .slice()
                          .sort((left, right) => right.quantity - left.quantity)
                          .slice(0, 8)
                          .map((location, index) => (
                            <div
                              key={`${location.storageType}-${location.storageId}-${index}`}
                              className={`flex justify-between items-center text-sm bg-[#F3F4F6] px-3 py-2 rounded ${
                                index === 0 ? "border-l-2 border-[#F4B740]/60" : ""
                              }`}
                            >
                              <span className="text-[#2D3135]">{location.storageName}</span>
                              <span className="font-mono text-[#2D3135]">{location.quantity.toLocaleString("en-US")}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}

