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
      <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/80 mb-2">
        <div className="col-span-3">المنتج</div>
        <div className="col-span-2 text-center">المستودعات الرئيسية</div>
        <div className="col-span-2 text-center">بعهد المندوبين</div>
        <div className="col-span-2 text-center">الإجمالي الكلي</div>
        <div className="col-span-2 text-center">الحركة (7 أيام)</div>
        <div className="col-span-1 text-center">إجراءات</div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-slate-500 bg-slate-900/60 border border-slate-700 rounded-xl">جاري تحميل بيانات المنتجات...</div>
      ) : displayedRows.length === 0 ? (
        <div className="py-10 text-center text-slate-500 bg-slate-900/60 border border-slate-700 rounded-xl">لا توجد بيانات منتجات متاحة.</div>
      ) : (
        displayedRows.map((row) => {
          const isExpanded = expandedItemTypeId === row.itemTypeId;
          const { warehouses, technicians } = groupedDetails(row);

          return (
            <article
              key={row.itemTypeId}
              className={`bg-slate-900/60 backdrop-blur-md border rounded-xl p-4 transition-all relative overflow-hidden ${
                isExpanded ? "border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.08)]" : "border-slate-700 hover:border-white/20"
              }`}
            >
              {isExpanded && <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400" />}

              <div className="grid grid-cols-12 gap-4 items-center relative z-10">
                <div className="col-span-3 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-base">{row.itemNameAr}</h4>
                    <p className="text-slate-400 text-xs font-mono mt-0.5">SKU: {row.itemCode}</p>
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-center gap-2">
                  <Warehouse className="h-4 w-4 text-purple-400" />
                  <span className="text-slate-300 font-mono text-sm">{row.warehouseQuantity.toLocaleString("en-US")}</span>
                </div>

                <div className="col-span-2 flex items-center justify-center gap-2">
                  <UserCog className="h-4 w-4 text-orange-400" />
                  <span className="text-slate-300 font-mono text-sm">{row.technicianQuantity.toLocaleString("en-US")}</span>
                </div>

                <div className="col-span-2 flex justify-center">
                  <span className="text-white font-bold font-mono text-base px-3 py-1 bg-cyan-500/10 rounded border border-cyan-500/20 text-cyan-400">
                    {row.totalQuantity.toLocaleString("en-US")}
                  </span>
                </div>

                <div className="col-span-2 flex justify-center items-center h-8">
                  <svg className="stroke-cyan-500" width="80" height="20" viewBox="0 0 80 20">
                    <path d={trendPath(row)} fill="none" strokeLinecap="round" strokeWidth="1.5" />
                  </svg>
                </div>

                <div className="col-span-1 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onViewDetails?.(row.itemTypeId)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                    title="التفاصيل"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center text-cyan-400 transition-colors"
                    title="تحويل"
                  >
                    <Repeat2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedItemTypeId(isExpanded ? null : row.itemTypeId)}
                    className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white transition-colors"
                    title={isExpanded ? "طي" : "عرض التفاصيل"}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-1 lg:grid-cols-2 gap-6 pl-4 pr-2">
                  <div>
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-purple-400" />
                      تفاصيل المستودعات ({row.warehouseQuantity.toLocaleString("en-US")})
                    </h5>
                    <div className="space-y-2">
                      {warehouses.length === 0 ? (
                        <div className="text-xs text-slate-500 bg-black/30 px-3 py-2 rounded">لا يوجد مخزون بالمستودعات.</div>
                      ) : (
                        warehouses.map((location, index) => (
                          <div key={`${location.storageType}-${location.storageId}-${index}`} className="flex justify-between items-center text-sm bg-black/30 px-3 py-2 rounded">
                            <span className="text-slate-300">{location.storageName}</span>
                            <span className="font-mono text-white">{location.quantity.toLocaleString("en-US")}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-orange-400" />
                      أعلى المندوبين عهدة ({row.technicianQuantity.toLocaleString("en-US")})
                    </h5>
                    <div className="space-y-2">
                      {technicians.length === 0 ? (
                        <div className="text-xs text-slate-500 bg-black/30 px-3 py-2 rounded">لا توجد عهدة مندوبين لهذا المنتج.</div>
                      ) : (
                        technicians
                          .slice()
                          .sort((left, right) => right.quantity - left.quantity)
                          .slice(0, 8)
                          .map((location, index) => (
                            <div
                              key={`${location.storageType}-${location.storageId}-${index}`}
                              className={`flex justify-between items-center text-sm bg-black/30 px-3 py-2 rounded ${
                                index === 0 ? "border-l-2 border-orange-500/50" : ""
                              }`}
                            >
                              <span className="text-slate-300">{location.storageName}</span>
                              <span className="font-mono text-white">{location.quantity.toLocaleString("en-US")}</span>
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

