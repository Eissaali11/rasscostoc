import { Search, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProductsManagementHeaderProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onExportExcel: () => void;
};

export function ProductsManagementHeader({ searchTerm, onSearchChange, onExportExcel }: ProductsManagementHeaderProps) {
  return (
    <section className="mb-8 border border-slate-700/80 bg-slate-900/60 backdrop-blur-md rounded-xl px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <h3 className="text-white text-2xl font-bold tracking-wide">إدارة وتوزيع المنتجات</h3>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="...ابحث باسم المنتج"
            className="w-full bg-white/5 border-slate-700 text-white rounded-full pr-9 pl-4 focus-visible:ring-cyan-500/50"
          />
        </div>

        <Button
          onClick={onExportExcel}
          className="bg-lime-400 text-black hover:bg-lime-300 font-bold shadow-[0_0_15px_rgba(132,204,22,0.45)]"
        >
          <Share className="h-4 w-4 ml-1" />
          تصدير Excel
        </Button>
      </div>
    </section>
  );
}
