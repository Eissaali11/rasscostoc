import { Input } from "@/components/ui/input";
import { Package, Search, XCircle } from "lucide-react";

type InventoryDisplayItem = {
  id: string;
  nameAr: string;
  boxes: number;
  units: number;
};

type GaugeStyle = {
  color: string;
  glow: string;
  text: string;
};

type WarehouseInventorySectionProps = {
  inventorySearchQuery: string;
  onInventorySearchChange: (value: string) => void;
  onClearInventorySearch: () => void;
  filteredInventoryItems: InventoryDisplayItem[];
  getGaugeStyle: (total: number) => GaugeStyle;
};

export function WarehouseInventorySection({
  inventorySearchQuery,
  onInventorySearchChange,
  onClearInventorySearch,
  filteredInventoryItems,
  getGaugeStyle,
}: WarehouseInventorySectionProps) {
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-white text-xl font-bold flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-300" />
          المخزون الحالي
        </h3>
        <div className="relative w-full sm:w-80">
          <Input
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/40 focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/50"
            placeholder="البحث في المخزون..."
            value={inventorySearchQuery}
            onChange={(event) => onInventorySearchChange(event.target.value)}
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 h-4 w-4" />
          {inventorySearchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={onClearInventorySearch}
              aria-label="مسح البحث"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {filteredInventoryItems.length === 0 ? (
        <div className="text-center py-12 text-slate-400">لا توجد أصناف مطابقة للبحث.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
          {filteredInventoryItems.map((item, index) => {
            const total = item.boxes + item.units;
            const gauge = getGaugeStyle(total);
            const ratio = Math.min(100, Math.max(0, (total / 20) * 100));

            return (
              <div
                key={`${item.id}-${index}`}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
                data-testid={`inventory-item-${index}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-white font-medium text-lg">{item.nameAr}</h4>
                  <div className="relative size-10">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke={gauge.color}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="87.9"
                        strokeDashoffset={`${87.9 - (87.9 * ratio) / 100}`}
                        className={gauge.glow}
                      />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">كراتين:</span>
                    <span className="text-white" data-testid={`boxes-${index}`}>{item.boxes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">وحدات:</span>
                    <span className="text-white" data-testid={`units-${index}`}>{item.units}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-white/70 text-sm">الإجمالي:</span>
                  <span className={`${gauge.text} font-bold text-lg`} data-testid={`total-${index}`}>{total}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
