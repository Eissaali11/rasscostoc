import type { ProductsKpi } from "../types";
import { Boxes, UserCog, Warehouse } from "lucide-react";

type ProductsKpiCardsProps = {
  kpis: ProductsKpi;
};

type RingProps = {
  value: number;
  colorClass: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
};

function KpiRing({ value, colorClass, icon: Icon, iconClass }: RingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center relative">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
        <path
          className="text-slate-700"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeDasharray="100, 100"
          strokeWidth="3"
        />
        <path
          className={colorClass}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="currentColor"
          strokeDasharray={`${clamped}, 100`}
          strokeWidth="3"
        />
      </svg>
      <Icon className={`h-4 w-4 ${iconClass}`} />
    </div>
  );
}

export function ProductsKpiCards({ kpis }: ProductsKpiCardsProps) {
  const technicianRatio = kpis.totalStock > 0 ? Math.round((kpis.totalTechnicianStock / kpis.totalStock) * 100) : 0;
  const warehouseRatio = kpis.totalStock > 0 ? Math.round((kpis.totalWarehouseStock / kpis.totalStock) * 100) : 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <article className="bg-slate-900/60 backdrop-blur-md border border-slate-700 rounded-xl p-6 relative overflow-hidden group hover:border-cyan-500/50 transition-all">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-cyan-500/20 rounded-full blur-2xl group-hover:bg-cyan-500/30 transition-all" />
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-slate-300 text-sm font-medium mb-1">المخزون الكلي</p>
            <h3 className="text-3xl font-bold text-white tracking-wider">{kpis.totalStock.toLocaleString("en-US")}</h3>
          </div>
          <KpiRing value={100} colorClass="text-cyan-500" icon={Boxes} iconClass="text-cyan-500" />
        </div>
      </article>

      <article className="bg-slate-900/60 backdrop-blur-md border border-slate-700 rounded-xl p-6 relative overflow-hidden group hover:border-orange-500/50 transition-all">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-500/20 rounded-full blur-2xl group-hover:bg-orange-500/30 transition-all" />
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-slate-300 text-sm font-medium mb-1">مخزون المندوبين</p>
            <h3 className="text-3xl font-bold text-white tracking-wider">{kpis.totalTechnicianStock.toLocaleString("en-US")}</h3>
          </div>
          <KpiRing value={technicianRatio} colorClass="text-orange-500" icon={UserCog} iconClass="text-orange-500" />
        </div>
      </article>

      <article className="bg-slate-900/60 backdrop-blur-md border border-slate-700 rounded-xl p-6 relative overflow-hidden group hover:border-purple-500/50 transition-all">
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl group-hover:bg-purple-500/30 transition-all" />
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-slate-300 text-sm font-medium mb-1">مخزون المستودعات</p>
            <h3 className="text-3xl font-bold text-white tracking-wider">{kpis.totalWarehouseStock.toLocaleString("en-US")}</h3>
          </div>
          <KpiRing value={warehouseRatio} colorClass="text-purple-500" icon={Warehouse} iconClass="text-purple-500" />
        </div>
      </article>
    </section>
  );
}

