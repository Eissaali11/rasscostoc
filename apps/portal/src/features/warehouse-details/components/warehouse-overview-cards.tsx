import { useTranslation } from "@/lib/language";
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
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="rassco-glass rassco-glass-static p-6 flex items-center justify-between">
        <div>
          <p className="text-[#6B7280] text-sm mb-2">{t('warehouse.total_inventory')}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-[#2D3135] text-3xl font-bold">{totalInventory}</p>
            <p className="text-sm text-[#6B7280]">{t('warehouse.piece')}</p>
          </div>
        </div>
        <div className="relative size-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#E6E8EC" strokeWidth="5" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#18B2B0"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="87.9"
              strokeDashoffset={`${87.9 - (87.9 * inventoryUsagePercent) / 100}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[#149D9B] font-bold text-sm">{inventoryUsagePercent}%</span>
          </div>
        </div>
      </div>

      <div className="rassco-glass rassco-glass-static p-6 flex items-center justify-between">
        <div>
          <p className="text-[#6B7280] text-sm mb-2">{t('warehouse.text_1')}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-[#2D3135] text-3xl font-bold">{availableItemTypesCount}</p>
            <p className="text-sm text-[#6B7280]">{t('warehouse.item_12835')}{totalItemTypesCount}</p>
          </div>
        </div>
        <div className="relative size-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#E6E8EC" strokeWidth="5" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#F4B740"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="87.9"
              strokeDashoffset={`${87.9 - (87.9 * availableItemTypesPercent) / 100}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[#8a6410] font-bold text-sm">{availableItemTypesPercent}%</span>
          </div>
        </div>
      </div>

      <div className="rassco-glass rassco-glass-static p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#18B2B0]/10 border border-[#18B2B0]/25 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-[#18B2B0]" />
            </div>
            <p className="text-[#2D3135] text-sm">{t('warehouse.technician_2')}</p>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-[#18B2B0]/10 text-[#149D9B] text-xs border border-[#18B2B0]/25">
            {warehouseTechnicians?.length || 0}
          </span>
        </div>

        <div className="relative mb-3">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
          <Input
            value={technicianSearchQuery}
            onChange={(event) => onTechnicianSearchChange(event.target.value)}
            placeholder={t('warehouse.technician_or_username_or_city')}
            className="h-9 pr-10 pl-10 bg-white border-[#E6E8EC] text-[#2D3135] placeholder:text-[#9AA1AB] focus:border-[#18B2B0]"
          />
          {technicianSearchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={onClearTechnicianSearch}
              aria-label={t('warehouse.scan_search_3')}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#6B7280] hover:text-[#2D3135] hover:bg-[#F3F4F6] transition-colors"
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
                    className="px-3 py-1.5 rounded-lg bg-[#18B2B0]/10 border border-[#18B2B0]/25 text-xs text-[#149D9B]"
                  >
                    {technician.fullName}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#9AA1AB] py-2 text-center bg-[#F3F4F6] rounded-lg border border-[#E6E8EC]">
              {t('warehouse.no_results')}
            </div>
          )
        ) : (
          <div className="text-xs text-[#9AA1AB] py-2 text-center bg-[#F3F4F6] rounded-lg border border-[#E6E8EC]">
            {t('warehouse.no_technician')}
          </div>
        )}
      </div>
    </div>
  );
}

