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
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex flex-col gap-4 p-6 border-b border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-white text-lg font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-blue-300" />
          سجل النقل
          <span className="text-white/40 text-sm font-normal mr-2">{allTransfersCount} عملية</span>
        </h3>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <Input
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/40 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/50"
              placeholder="البحث في سجل النقل..."
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 h-4 w-4" />
            {searchQuery.trim().length > 0 && (
              <button
                type="button"
                onClick={onClearSearch}
                aria-label="مسح البحث"
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            onClick={onExportAll}
            variant="ghost"
            className="bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
          >
            <FileDown className="h-4 w-4 ml-2" />
            تصدير
          </Button>
        </div>
      </div>

      {transfersLoading ? (
        <div className="p-6">
          <Skeleton className="h-64 w-full bg-white/10" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          {allTransfersCount === 0 ? "لا توجد عمليات نقل حتى الآن" : "لا توجد نتائج مطابقة للبحث"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-right text-white/50">المندوب</TableHead>
                <TableHead className="text-right text-white/50">الأصناف</TableHead>
                <TableHead className="text-right text-white/50">الحالة</TableHead>
                <TableHead className="text-right text-white/50">التاريخ</TableHead>
                <TableHead className="text-right text-white/50">الملاحظات</TableHead>
                <TableHead className="text-right text-white/50">تصدير</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => {
                const items = extractTransferItems(transfer, itemTypesData);

                return (
                  <TableRow key={transfer.id} className="border-white/5 hover:bg-white/[0.03] transition-colors">
                    <TableCell className="text-white text-right">{transfer.technicianName}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-white/70">{items.length} أصناف ({items.reduce((sum, item) => sum + item.quantity, 0)} قطعة)</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {transfer.status === "accepted" && <span className="bg-green-500/10 text-emerald-400 px-2 py-1 rounded text-xs border border-green-500/20">مكتمل</span>}
                      {transfer.status === "pending" && <span className="bg-yellow-500/10 text-yellow-300 px-2 py-1 rounded text-xs border border-yellow-500/20">معلقة</span>}
                      {transfer.status === "rejected" && <span className="bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs border border-red-500/20">مرفوضة</span>}
                    </TableCell>
                    <TableCell className="text-white/50 text-right text-sm">{new Date(transfer.createdAt).toLocaleString("ar-SA")}</TableCell>
                    <TableCell className="text-white/50 text-right text-sm max-w-[280px] truncate">{transfer.notes || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onExportTransferPdf(transfer)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

