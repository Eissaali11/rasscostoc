import { useTranslation } from "@/lib/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { extractTransferItems } from "@/features/warehouse-details/transfer-helpers";
import type {
  WarehouseItemTypeLite,
  WarehouseTransfer,
} from "@/features/warehouse-details/types";
import { FileDown, History, Search, XCircle } from "lucide-react";

type WarehouseTransfersSectionProps = {
  allTransfersCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onExportAll: () => void;
  transfersLoading: boolean;
  transfers: WarehouseTransfer[];
  itemTypesData?: WarehouseItemTypeLite[];
  onExportTransferPdf: (transfer: WarehouseTransfer) => void;
};

export function WarehouseTransfersSection({
  allTransfersCount,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onExportAll,
  transfersLoading,
  transfers,
  itemTypesData,
  onExportTransferPdf,
}: WarehouseTransfersSectionProps) {
  const { t, language } = useTranslation();
  const locale = language === "en" ? "en-US" : "ar-SA";
  return (
    <div className="rassco-glass rassco-glass-static overflow-hidden">
      <div className="flex flex-col gap-4 p-6 border-b border-[#E6E8EC] sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-[#2D3135] text-lg font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-[#18B2B0]" />
          {t('warehouse.log')}
          <span className="text-[#9AA1AB] text-sm font-normal mr-2">{allTransfersCount}{t('warehouse.operation')}</span>
        </h3>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <Input
              className="w-full bg-white border border-[#E6E8EC] rounded-xl py-2.5 pl-10 pr-10 text-sm text-[#2D3135] placeholder:text-[#9AA1AB] focus:border-[#18B2B0] focus:ring-1 focus:ring-[#18B2B0]/30"
              placeholder={t('warehouse.search_log')}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AA1AB] h-4 w-4" />
            {searchQuery.trim().length > 0 && (
              <button
                type="button"
                onClick={onClearSearch}
                aria-label={t('warehouse.scan_search_3')}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#6B7280] hover:text-[#2D3135] hover:bg-[#F3F4F6] transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            onClick={onExportAll}
            variant="ghost"
            className="bg-white hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#2D3135] border border-[#E6E8EC]"
          >
            <FileDown className="h-4 w-4 ml-2" />
            {t('warehouse.export')}
          </Button>
        </div>
      </div>

      {transfersLoading ? (
        <div className="p-6">
          <Skeleton className="h-64 w-full bg-[#F3F4F6]" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-16 text-[#6B7280]">
          {allTransfersCount === 0 ? t('warehouse.none_transfer') : t('warehouse.no_results_1')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#E6E8EC] hover:bg-transparent">
                <TableHead className="text-right text-[#6B7280]">{t('warehouse.technician')}</TableHead>
                <TableHead className="text-right text-[#6B7280]">{t('warehouse.phrase_e9adeb6e')}</TableHead>
                <TableHead className="text-right text-[#6B7280]">{t('warehouse.status')}</TableHead>
                <TableHead className="text-right text-[#6B7280]">{t('warehouse.date')}</TableHead>
                <TableHead className="text-right text-[#6B7280]">{t('warehouse.notes_1')}</TableHead>
                <TableHead className="text-right text-[#6B7280]">{t('warehouse.export')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => {
                const items = extractTransferItems(transfer, itemTypesData);

                return (
                  <TableRow key={transfer.id} className="border-[#E6E8EC] hover:bg-[#F8FAFB] transition-colors">
                    <TableCell className="text-[#2D3135] text-right">{transfer.technicianName}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-[#6B7280]">{items.length}{t('warehouse.item_8014')}{items.reduce((sum, item) => sum + item.quantity, 0)}{t('warehouse.unit_4')}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {transfer.status === "accepted" && <span className="bg-[#18B2B0]/10 text-[#149D9B] px-2 py-1 rounded text-xs border border-[#18B2B0]/25">{t('warehouse.completed')}</span>}
                      {transfer.status === "pending" && <span className="bg-[#F4B740]/12 text-[#8a6410] px-2 py-1 rounded text-xs border border-[#F4B740]/30">{t('warehouse.pending')}</span>}
                      {transfer.status === "rejected" && <span className="bg-[#E05252]/10 text-[#E05252] px-2 py-1 rounded text-xs border border-[#E05252]/25">{t('warehouse.rejected_f')}</span>}
                    </TableCell>
                    <TableCell className="text-[#6B7280] text-right text-sm">{new Date(transfer.createdAt).toLocaleString(locale)}</TableCell>
                    <TableCell className="text-[#6B7280] text-right text-sm max-w-[280px] truncate">{transfer.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onExportTransferPdf(transfer)}
                        className="text-[#E05252] hover:text-[#E05252] hover:bg-[#E05252]/10"
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

