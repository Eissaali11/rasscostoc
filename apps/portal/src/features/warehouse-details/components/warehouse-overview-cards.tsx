import { Input } from "@/components/ui/input";
import { Search, User, XCircle } from "lucide-react";

type Technician = {
  id: string;
  fullName: string;
};

type TechnicianExtended = Technician & {
  username?: string;
  city?: string | null;
};

type WarehouseOverviewCardsProps = {
  totalInventory: number;
  inventoryUsagePercent: number;
  availableItemTypesCount: number;
  totalItemTypesCount: number;
  availableItemTypesPercent: number;
  warehouseTechnicians?: TechnicianExtended[];
  filteredLinkedTechnicians: Technician[];
  technicianSearchQuery: string;
  onTechnicianSearchChange: (value: string) => void;
  onClearTechnicianSearch: () => void;
};

export function WarehouseOverviewCards({
  totalInventory,
  inventoryUsagePercent,
  availableItemTypesCount,
  totalItemTypesCount,
  availableItemTypesPercent,
  warehouseTechnicians,
  filteredLinkedTechnicians,
  technicianSearchQuery,
  onTechnicianSearchChange,
  onClearTechnicianSearch,
}: WarehouseOverviewCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="text-white/50 text-sm mb-2">إجمالي المخزون</p>
          <div className="flex items-baseline gap-2">
            <p className="text-white text-3xl font-bold">{totalInventory}</p>
            <p className="text-sm text-white/60">قطعة</p>
          </div>
        </div>
        <div className="relative size-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <defs>
              <linearGradient id="summaryGradientWarehouse" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2ff" />
                <stop offset="100%" stopColor="#bc13fe" />
              </linearGradient>
            </defs>
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="url(#summaryGradientWarehouse)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="87.9"
              strokeDashoffset={`${87.9 - (87.9 * inventoryUsagePercent) / 100}`}
              className="drop-shadow-[0_0_8px_rgba(0,242,255,0.4)]"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-cyan-300 font-bold text-sm">{inventoryUsagePercent}%</span>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="text-white/50 text-sm mb-2">الأصناف الموجودة</p>
          <div className="flex items-baseline gap-2">
            <p className="text-white text-3xl font-bold">{availableItemTypesCount}</p>
            <p className="text-sm text-white/60">صنف من أصل {totalItemTypesCount}</p>
          </div>
        </div>
        <div className="relative size-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="url(#summaryGradientWarehouse)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="87.9"
              strokeDashoffset={`${87.9 - (87.9 * availableItemTypesPercent) / 100}`}
              className="drop-shadow-[0_0_8px_rgba(188,19,254,0.4)]"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-purple-300 font-bold text-sm">{availableItemTypesPercent}%</span>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-blue-400" />
            </div>
            <p className="text-white/70 text-sm">المندوبون المرتبطون</p>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-200 text-xs border border-cyan-400/30">
            {warehouseTechnicians?.length || 0}
          </span>
        </div>

        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-300/70" />
          <Input
            value={technicianSearchQuery}
            onChange={(event) => onTechnicianSearchChange(event.target.value)}
            placeholder="ابحث عن مندوب بالاسم أو اسم المستخدم أو المدينة"
            className="h-9 pr-10 pl-10 bg-black/25 border-cyan-400/25 text-white placeholder:text-gray-400 focus:border-cyan-300"
          />
          {technicianSearchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={onClearTechnicianSearch}
              aria-label="مسح البحث"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-cyan-300/70 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        {warehouseTechnicians && warehouseTechnicians.length > 0 ? (
          filteredLinkedTechnicians.length > 0 ? (
            <div className="max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {filteredLinkedTechnicians.map((technician) => (
                  <div
                    key={technician.id}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-xs text-cyan-100"
                  >
                    {technician.fullName}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 py-2 text-center bg-black/20 rounded-lg border border-white/10">
              لا توجد نتائج مطابقة
            </div>
          )
        ) : (
          <div className="text-xs text-gray-400 py-2 text-center bg-black/20 rounded-lg border border-white/10">
            لا يوجد مندوبون مرتبطون
          </div>
        )}
      </div>
    </div>
  );
}

