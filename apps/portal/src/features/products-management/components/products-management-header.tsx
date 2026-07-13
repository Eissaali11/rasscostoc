import { useTranslation } from "@/lib/language";
import { Search, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProductsManagementHeaderProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onExportExcel: () => void;
};

export function ProductsManagementHeader({ searchTerm, onSearchChange, onExportExcel }: ProductsManagementHeaderProps) {
  const { t } = useTranslation();
  return (
    <section className="mb-8 rassco-glass rassco-glass-static px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <h3 className="text-[#2D3135] text-2xl font-bold tracking-wide">{t('common.management_3')}</h3>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]" />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('common.item_22404')}
            className="w-full bg-white border-[#E6E8EC] text-[#2D3135] rounded-full pr-9 pl-4 focus-visible:ring-[#18B2B0]/30"
          />
        </div>

        <Button
          onClick={onExportExcel}
          className="bg-[#18B2B0] text-white hover:bg-[#149D9B] font-bold"
        >
          <Share className="h-4 w-4 ml-1" />
          {t('inventory.export_excel')}
        </Button>
      </div>
    </section>
  );
}
