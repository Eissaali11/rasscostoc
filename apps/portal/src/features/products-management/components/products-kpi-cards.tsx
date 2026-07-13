import { useTranslation } from "@/lib/language";
import type { ProductsKpi } from "../types";
import { Boxes, UserCog, Warehouse } from "lucide-react";

type ProductsKpiCardsProps = {
  kpis: ProductsKpi;
};

type RingProps = {
  value: number;
  colorHex: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
};

function KpiRing({ value, colorHex, icon: Icon, iconClass }: RingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-12 h-12 rounded-full border-2 border-[#E6E8EC] flex items-center justify-center relative">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-[#E6E8EC]"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeDasharray="100, 100"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={colorHex}
          strokeDasharray={`${clamped}, 100`}
          strokeWidth="3"
        />
      </svg>
      <Icon className={`h-4 w-4 ${iconClass}`} />
    </div>
  );
}

export function ProductsKpiCards({ kpis }: ProductsKpiCardsProps) {
  const { t } = useTranslation();
  const technicianRatio = kpis.totalStock > 0 ? Math.round((kpis.totalTechnicianStock / kpis.totalStock) * 100) : 0;
  const warehouseRatio = kpis.totalStock > 0 ? Math.round((kpis.totalWarehouseStock / kpis.totalStock) * 100) : 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <article className="rassco-glass p-6 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#18B2B0]/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-[#6B7280] text-sm font-medium mb-1">{t('common.inventory_13')}</p>
            <h3 className="text-3xl font-bold text-[#2D3135] tracking-wider">{kpis.totalStock.toLocaleString("en-US")}</h3>
          </div>
          <KpiRing value={100} colorHex="#18B2B0" icon={Boxes} iconClass="text-[#18B2B0]" />
        </div>
      </article>

      <article className="rassco-glass p-6 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#F4B740]/12 rounded-full blur-2xl" />
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-[#6B7280] text-sm font-medium mb-1">{t('common.couriers_2')}</p>
            <h3 className="text-3xl font-bold text-[#2D3135] tracking-wider">{kpis.totalTechnicianStock.toLocaleString("en-US")}</h3>
          </div>
          <KpiRing value={technicianRatio} colorHex="#F4B740" icon={UserCog} iconClass="text-[#8a6410]" />
        </div>
      </article>

      <article className="rassco-glass p-6 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#6B7280]/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-[#6B7280] text-sm font-medium mb-1">{t('common.warehouses_3')}</p>
            <h3 className="text-3xl font-bold text-[#2D3135] tracking-wider">{kpis.totalWarehouseStock.toLocaleString("en-US")}</h3>
          </div>
          <KpiRing value={warehouseRatio} colorHex="#6B7280" icon={Warehouse} iconClass="text-[#6B7280]" />
        </div>
      </article>
    </section>
  );
}

