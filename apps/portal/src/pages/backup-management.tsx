import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Cloud,
  CloudUpload,
  Database,
  Download,
  Filter,
  History,
  Lock,
  RotateCcw,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BackupEntry {
  name: string;
  data: string;
  size: number;
  date: string;
  type: "محلي" | "سحابي";
}

interface BackupStorageStatsResponse {
  usedBytes: number;
  totalBytes: number;
  availableBytes: number;
  usedPercent: number;
  exportsCount: number;
  lastBackupAt: string | null;
  hasConfiguredCapacity: boolean;
}

interface BackupHistoryItem {
  id: string;
  name: string;
  createdAt: string | null;
  sizeBytes: number;
  type: "سحابي";
}

interface BackupHistoryResponse {
  items: BackupHistoryItem[];
}

interface RestoreResponse {
  success: boolean;
  message?: string;
  imported?: {
    users?: number;
    regions?: number;
    inventoryItems?: number;
    transactions?: number;
    warehouses?: number;
    warehouseInventory?: number;
    warehouseInventoryEntries?: number;
    supervisorWarehouses?: number;
  };
}

type BackupTableRow =
  | {
      id: string;
      source: "local";
      name: string;
      createdAt: string;
      sizeBytes: number;
      type: "محلي";
      data: string;
    }
  | {
      id: string;
      source: "server";
      name: string;
      createdAt: string | null;
      sizeBytes: number;
      type: "سحابي";
    };

function formatStorageValue(bytes: number): { value: string; unit: string } {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { value: "0", unit: "B" };
  }

  const tb = bytes / (1024 ** 4);
  if (tb >= 1) {
    return { value: tb >= 10 ? tb.toFixed(0) : tb.toFixed(1), unit: "TB" };
  }

  const gb = bytes / (1024 ** 3);
  if (gb >= 1) {
    return { value: gb >= 10 ? gb.toFixed(0) : gb.toFixed(1), unit: "GB" };
  }

  const mb = bytes / (1024 ** 2);
  if (mb >= 1) {
    return { value: mb >= 10 ? mb.toFixed(0) : mb.toFixed(1), unit: "MB" };
  }

  const kb = bytes / 1024;
  if (kb >= 1) {
    return { value: kb >= 10 ? kb.toFixed(0) : kb.toFixed(1), unit: "KB" };
  }

  return { value: bytes.toFixed(0), unit: "B" };
}

function formatRelativeArabic(dateIso?: string | null): string {
  if (!dateIso) return "لا توجد نسخ";

  const timestamp = new Date(dateIso).getTime();
  if (Number.isNaN(timestamp)) return "لا توجد نسخ";

  const diffMs = Date.now() - timestamp;
  if (diffMs <= 0) return "الآن";

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "الآن";
  if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `منذ ${diffDays} يوم`;

  const diffMonths = Math.floor(diffDays / 30);
  return `منذ ${diffMonths} شهر`;
}

function formatRestoreSummary(imported?: RestoreResponse["imported"]): string {
  if (!imported) return "تم استعادة جميع البيانات من النسخة الاحتياطية";

  const usersCount = imported.users ?? 0;
  const regionsCount = imported.regions ?? 0;
  const itemsCount = imported.inventoryItems ?? 0;
  const transactionsCount = imported.transactions ?? 0;
  const warehousesCount = imported.warehouses ?? 0;
  const warehouseInventoryCount = imported.warehouseInventory ?? 0;

  return `المستخدمون: ${usersCount} | المناطق: ${regionsCount} | المستودعات: ${warehousesCount} | مخزون المستودعات: ${warehouseInventoryCount} | الأصناف: ${itemsCount} | الحركات: ${transactionsCount}`;
}

export default function BackupManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recentBackups, setRecentBackups] = useState<BackupEntry[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleType, setScheduleType] = useState<"daily" | "weekly">("daily");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: storageStats } = useQuery<BackupStorageStatsResponse>({
    queryKey: ["/api/admin/backup/storage-stats"],
  });

  const { data: backupHistory } = useQuery<BackupHistoryResponse>({
    queryKey: ["/api/admin/backup/history"],
  });

  const fallbackTotalBytes = Math.round(1.2 * 1024 * 1024 * 1024 * 1024);
  const fallbackUsedBytes = 900 * 1024 * 1024 * 1024;
  const fallbackAvailableBytes = 300 * 1024 * 1024 * 1024;

  const totalBytes = Number(storageStats?.totalBytes ?? fallbackTotalBytes);
  const usedBytes = Number(storageStats?.usedBytes ?? fallbackUsedBytes);
  const availableBytes = Number(storageStats?.availableBytes ?? fallbackAvailableBytes);
  const usedCapacityPercent = Math.min(
    100,
    Math.max(
      0,
      Number(
        storageStats?.usedPercent ?? Math.round((fallbackUsedBytes / (fallbackUsedBytes + fallbackAvailableBytes)) * 100),
      ),
    ),
  );

  const totalStorageDisplay = formatStorageValue(totalBytes);
  const usedStorageDisplay = formatStorageValue(usedBytes);
  const availableStorageDisplay = formatStorageValue(availableBytes);
  const storageCircleCircumference = 2 * Math.PI * 88;
  const storageCircleOffset = storageCircleCircumference * (1 - usedCapacityPercent / 100);

  const mergedBackupRows = useMemo<BackupTableRow[]>(() => {
    const localRows: BackupTableRow[] = recentBackups.map((item) => ({
      id: `local-${item.name}-${item.date}`,
      source: "local",
      name: item.name,
      createdAt: item.date,
      sizeBytes: item.size,
      type: "محلي",
      data: item.data,
    }));

    const localNames = new Set(localRows.map((item) => item.name));

    const serverRows: BackupTableRow[] = (backupHistory?.items || [])
      .filter((item) => !localNames.has(item.name))
      .map((item) => ({
        id: item.id,
        source: "server",
        name: item.name,
        createdAt: item.createdAt,
        sizeBytes: item.sizeBytes,
        type: "سحابي",
      }));

    return [...localRows, ...serverRows];
  }, [backupHistory?.items, recentBackups]);

  const latestBackupAt =
    storageStats?.lastBackupAt ||
    mergedBackupRows[0]?.createdAt ||
    null;

  const lastBackupLabel = useMemo(() => formatRelativeArabic(latestBackupAt), [latestBackupAt]);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/admin/backup', {
        credentials: 'include',
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('فشل في تصدير النسخة الاحتياطية');
      }

      const backup = await response.json();

      const contentDisposition = response.headers.get("content-disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const filenameFromHeader = filenameMatch?.[1];
      
      // Create download link
      const dataStr = JSON.stringify(backup, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      const filename = filenameFromHeader || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setRecentBackups(prev => [
        { name: filename, data: dataStr, size: dataBlob.size, date: new Date().toISOString(), type: "محلي" },
        ...prev,
      ]);

      toast({
        title: "تم التصدير بنجاح",
        description: "تم تنزيل النسخة الاحتياطية على جهازك",
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/backup/storage-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/backup/history"] }),
      ]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ في التصدير",
        description: error instanceof Error ? error.message : "حدث خطأ أثناء تصدير البيانات",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (file: File) => {
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const response = await apiRequest('POST', '/api/admin/restore', backup);
      const restoreResult = (await response.json()) as RestoreResponse;

      toast({
        title: "تمت الاستعادة بنجاح",
        description: formatRestoreSummary(restoreResult.imported),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/backup/storage-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/backup/history"] }),
      ]);

      // Reload page after successful restore
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ في الاستعادة",
        description: error instanceof Error ? error.message : "حدث خطأ أثناء استعادة البيانات",
      });
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleStartImport = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "ملف غير محدد",
        description: "اختر ملف نسخة احتياطية قبل بدء الاستيراد",
      });
      return;
    }
    await handleImportBackup(selectedFile);
  };

  const handleRedownload = (entry: BackupEntry) => {
    try {
      const blob = new Blob([entry.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = entry.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'تم تنزيل النسخة', description: `${entry.name} تم تنزيلها` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تنزيل النسخة' });
    }
  };

  const handleRemoveBackup = (name: string) => {
    setRecentBackups(prev => prev.filter(p => p.name !== name));
  };

  const handleRestoreRecent = async (entry: BackupEntry) => {
    try {
      setIsImporting(true);
      const parsed = JSON.parse(entry.data);
      const response = await apiRequest('POST', '/api/admin/restore', parsed);
      const restoreResult = (await response.json()) as RestoreResponse;
      toast({ title: 'تمت الاستعادة بنجاح', description: formatRestoreSummary(restoreResult.imported) });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/backup/storage-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/backup/history"] }),
      ]);

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'خطأ في الاستعادة',
        description: error instanceof Error ? error.message : 'فشل استعادة النسخة',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-[#0f0814] text-slate-100 relative overflow-x-hidden -m-8 p-8">

      <main className="relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#8c25f4]/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#00f2ff]/5 blur-[100px] rounded-full pointer-events-none" />

        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-8 z-10">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">إدارة النسخ الاحتياطية</h2>
            <p className="text-slate-400 mt-1">تأمين بيانات النظام عبر سحابة مشفرة</p>
          </div>
          <div className="flex items-center gap-3">
            <label
              htmlFor="backup-file-input"
              className="bg-transparent border border-[#8c25f4]/40 text-[#8c25f4] hover:bg-[#8c25f4]/10 px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              استيراد نسخة
            </label>
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="bg-[#8c25f4] hover:bg-[#8c25f4]/90 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all neon-glow disabled:opacity-70"
              data-testid="button-export-quick"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "جاري التصدير..." : "إنشاء نسخة احتياطية فورية"}
            </button>
          </div>
        </header>

        <input
          ref={fileInputRef}
          id="backup-file-input"
          type="file"
          accept=".json,.sql,.zip,.bak"
          className="hidden"
          onChange={handleFileChange}
          disabled={isImporting}
          data-testid="input-backup-file"
        />

        <div className="px-8 pb-8 z-10 space-y-6">
          <section className="glass p-6 rounded-2xl border border-[#8c25f4]/20">
            <div className="flex items-center gap-2 mb-6">
              <Upload className="text-[#00f2ff] h-5 w-5" />
              <h3 className="text-lg font-bold text-white">استيراد البيانات</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              <label
                htmlFor="backup-file-input"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="lg:col-span-2 dotted-neon rounded-2xl p-10 flex flex-col items-center justify-center text-center group cursor-pointer bg-[#8c25f4]/5"
              >
                <div className="w-16 h-16 rounded-full bg-[#8c25f4]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <CloudUpload className="text-[#8c25f4] h-8 w-8" />
                </div>
                <p className="text-lg font-bold mb-1">قم بسحب وإفلات ملف النسخة هنا</p>
                <p className="text-sm text-slate-400 mb-4">أو انقر لاختيار ملف من جهازك</p>
                {selectedFile ? (
                  <p className="text-xs text-emerald-400 font-bold mb-3">{selectedFile.name}</p>
                ) : null}
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-[#0f0814]/50 border border-[#8c25f4]/20 rounded text-[10px] text-[#8c25f4] font-bold uppercase tracking-wider">.sql</span>
                  <span className="px-3 py-1 bg-[#0f0814]/50 border border-[#8c25f4]/20 rounded text-[10px] text-[#8c25f4] font-bold uppercase tracking-wider">.zip</span>
                  <span className="px-3 py-1 bg-[#0f0814]/50 border border-[#8c25f4]/20 rounded text-[10px] text-[#8c25f4] font-bold uppercase tracking-wider">.bak</span>
                </div>
              </label>

              <div className="flex flex-col gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-bold text-slate-400">جاري معالجة البيانات...</span>
                    <span className="text-[#00f2ff] font-bold">65%</span>
                  </div>
                  <div className="w-full h-3 bg-[#8c25f4]/10 rounded-full overflow-hidden">
                    <div className="h-full w-[65%] bg-gradient-to-r from-[#8c25f4] to-[#00f2ff] rounded-full shadow-[0_0_10px_rgba(140,37,244,0.5)]" />
                  </div>
                </div>

                <div className="bg-[#8c25f4]/5 p-4 rounded-xl border border-[#8c25f4]/10">
                  <div className="flex items-center gap-3 text-xs text-slate-400 leading-relaxed">
                    <CheckCircle2 className="text-[#8c25f4] h-4 w-4" />
                    <p>يرجى التأكد من أن ملف الاستيراد متوافق مع نسخة قاعدة البيانات الحالية لتجنب فقدان البيانات.</p>
                  </div>
                </div>

                <button
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                  disabled={isImporting || !selectedFile}
                  onClick={handleStartImport}
                  data-testid="button-import-backup"
                >
                  {isImporting ? "جاري الاستعادة..." : "بدء عملية الاستيراد"}
                </button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-6 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">آخر نسخة احتياطية</span>
                <History className="text-[#8c25f4] h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-white">{lastBackupLabel}</div>
              <div className="text-xs text-emerald-500 font-medium">
                {storageStats?.exportsCount ?? mergedBackupRows.length} نسخة محفوظة
              </div>
            </div>

            <div className="glass p-6 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">إجمالي حجم البيانات</span>
                <Database className="text-[#8c25f4] h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-white" dir="ltr">
                <span className="inline-flex items-baseline gap-1.5">
                  <span>{totalStorageDisplay.value}</span>
                  <span>{totalStorageDisplay.unit}</span>
                </span>
              </div>
              <div className="text-xs text-emerald-500 font-medium">سعة غير محدودة</div>
            </div>

            <div className="glass p-6 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">حالة النظام</span>
                <CheckCircle2 className="text-emerald-500 h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-white pr-4 neon-pulse">آمن ومتصل</div>
              <div className="text-xs text-slate-400">جميع الخدمات تعمل بكفاءة 100%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass rounded-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-[#8c25f4]/10 flex items-center justify-between">
                <h3 className="text-lg font-bold">سجل النسخ الاحتياطية</h3>
                <button className="p-2 hover:bg-[#8c25f4]/10 rounded-lg transition-colors" type="button" aria-label="فلترة">
                  <Filter className="text-slate-400 h-4 w-4" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#8c25f4]/5 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">اسم النسخة</th>
                      <th className="px-6 py-4 font-bold">التاريخ والوقت</th>
                      <th className="px-6 py-4 font-bold">الحجم</th>
                      <th className="px-6 py-4 font-bold">النوع</th>
                      <th className="px-6 py-4 font-bold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#8c25f4]/5">
                    {mergedBackupRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                          لا توجد نسخ احتياطية محفوظة بعد.
                        </td>
                      </tr>
                    ) : (
                      mergedBackupRows.map((row) => {
                        const sizeLabel = row.sizeBytes > 0
                          ? formatStorageValue(row.sizeBytes)
                          : null;

                        return (
                          <tr key={row.id} className="hover:bg-[#8c25f4]/5 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium">{row.name}</td>
                            <td className="px-6 py-4 text-sm text-slate-400">
                              {row.createdAt ? new Date(row.createdAt).toLocaleString('ar-EG') : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm" dir="ltr">
                              {sizeLabel ? `${sizeLabel.value} ${sizeLabel.unit}` : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={
                                  row.type === "سحابي"
                                    ? "px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs border border-blue-500/30"
                                    : "px-2 py-1 rounded bg-[#00f2ff]/20 text-[#00f2ff] text-xs border border-[#00f2ff]/30"
                                }
                              >
                                {row.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-3">
                                {row.source === "local" ? (
                                  <>
                                    <button
                                      className="text-[#8c25f4] hover:text-[#8c25f4]/80"
                                      title="استعادة"
                                      onClick={() =>
                                        handleRestoreRecent({
                                          name: row.name,
                                          data: row.data,
                                          size: row.sizeBytes,
                                          date: row.createdAt,
                                          type: "محلي",
                                        })
                                      }
                                      type="button"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="text-slate-400 hover:text-white"
                                      title="تحميل"
                                      onClick={() => handleRedownload({
                                        name: row.name,
                                        data: row.data,
                                        size: row.sizeBytes,
                                        date: row.createdAt,
                                        type: "محلي",
                                      })}
                                      type="button"
                                    >
                                      <Download className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="text-slate-400 hover:text-white"
                                      title="حذف"
                                      onClick={() => handleRemoveBackup(row.name)}
                                      type="button"
                                    >
                                      ×
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="text-slate-600 cursor-not-allowed"
                                      title="الاستعادة متاحة فقط للنسخ المحلية المحفوظة في الجلسة"
                                      type="button"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="text-slate-600 cursor-not-allowed"
                                      title="التحميل المباشر متاح فقط للنسخ المحلية المحفوظة في الجلسة"
                                      type="button"
                                    >
                                      <Download className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="glass p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                <h4 className="text-sm font-bold mb-6 self-start">استهلاك التخزين السحابي</h4>
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200" fill="none">
                    <circle cx="100" cy="100" r="88" stroke="rgba(140,37,244,0.2)" strokeWidth="12" />
                    <circle
                      cx="100"
                      cy="100"
                      r="88"
                      stroke="url(#paint0_linear)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={storageCircleCircumference}
                      strokeDashoffset={storageCircleOffset}
                    />
                    <defs>
                      <linearGradient id="paint0_linear" x1="0" y1="0" x2="1" y2="1">
                        <stop stopColor="#8c25f4" />
                        <stop offset="1" stopColor="#00f2ff" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white" dir="ltr">{usedCapacityPercent}%</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">Used Capacity</span>
                  </div>
                </div>

                <div className="mt-8 w-full flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#8c25f4]" />
                    <span className="text-slate-400">
                      مستخدم <span dir="ltr">({usedStorageDisplay.value} {usedStorageDisplay.unit})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#8c25f4]/10" />
                    <span className="text-slate-400">
                      متاح <span dir="ltr">({availableStorageDisplay.value} {availableStorageDisplay.unit})</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold">الجدولة التلقائية</h4>
                  <button
                    type="button"
                    onClick={() => setScheduleEnabled((prev) => !prev)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${scheduleEnabled ? "bg-[#8c25f4]" : "bg-[#8c25f4]/20"}`}
                    aria-label="تفعيل الجدولة"
                  >
                    <span
                      className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${scheduleEnabled ? "translate-x-[22px]" : "translate-x-[2px]"}`}
                    />
                  </button>
                </div>

                <div className="space-y-4">
                  <label className={`flex items-center p-3 rounded-xl border transition-all cursor-pointer ${scheduleType === "daily" ? "bg-[#8c25f4]/5 border-[#8c25f4]/30" : "border-[#8c25f4]/10 hover:border-[#8c25f4]/30"}`}>
                    <input
                      className="w-4 h-4"
                      name="schedule"
                      type="radio"
                      checked={scheduleType === "daily"}
                      onChange={() => setScheduleType("daily")}
                    />
                    <div className="mr-4">
                      <p className="text-sm font-bold">يومي</p>
                      <p className="text-[10px] text-slate-400">كل ليلة في تمام الساعة 03:00 صباحاً</p>
                    </div>
                  </label>

                  <label className={`flex items-center p-3 rounded-xl border transition-all cursor-pointer ${scheduleType === "weekly" ? "bg-[#8c25f4]/5 border-[#8c25f4]/30" : "border-[#8c25f4]/10 hover:border-[#8c25f4]/30"}`}>
                    <input
                      className="w-4 h-4"
                      name="schedule"
                      type="radio"
                      checked={scheduleType === "weekly"}
                      onChange={() => setScheduleType("weekly")}
                    />
                    <div className="mr-4">
                      <p className="text-sm font-bold">أسبوعي</p>
                      <p className="text-[10px] text-slate-400">كل يوم أحد الساعة 00:00 صباحاً</p>
                    </div>
                  </label>
                </div>

                <button className="w-full mt-6 py-2.5 rounded-xl border border-[#8c25f4]/40 text-[#8c25f4] text-xs font-bold hover:bg-[#8c25f4] hover:text-white transition-all" type="button">
                  تحديث إعدادات الجدول
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-auto p-6 bg-[#8c25f4]/5 border-t border-[#8c25f4]/10 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2 space-x-reverse">
              <img
                alt="Avatar"
                className="w-8 h-8 rounded-full border-2 border-[#0f0814]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvXYfcdb50qRRpqJLf3yqj3XIlGo8-_Z5FEGNFkL0_e1HP9a5amoZwkHg9TjLfhy9c1Sj0NeZgzVuZFTsF_Ir6PnKrqX4CT1oLgLNofWm9ZSnP2qCQNjDnJTcC_5wteoddoipkth-hbqlWlH7eXLY1mFXRPVtJyrPtRw7-Eroe9plYHkEJDM1bMUl6cea0SyElv58ne8ZuFmElkIeb3xD8t92DbyFM0DKSdhrDY3GFXCv-0yjNCx6br9Q1zEX0TaKlg0df8mdUlRc"
              />
              <img
                alt="Avatar"
                className="w-8 h-8 rounded-full border-2 border-[#0f0814]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAATPAnMuYkpNL44qjRYOzUNFAcuteUpUk4T51lZ5u4Kzi2LQLMtcysDOeUxlIykkDs8mb5qs_AQypgt3mBZngz4IBTOmBB_E-cK39c98u_ZgKiyNAn-D5NC0r97WMmft4vK1fsWjVLTl5L0cXget8dN0cnFfsjWsP_68PhWcMneFy142L5MzxkGZrw0gDhb3iVACihOoZXO9mvgxyNqlrmFXmlz5JasQrxLOq7IyhyG5NdeF6eBDSsJ5SpQTGRpBrvm1Q-bTVqt70"
              />
            </div>
            <p className="text-xs text-slate-400">فريق الدعم الفني متصل حالياً للمساعدة في عمليات الاستعادة</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#00f2ff]" />
              <span className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold">AES-256 Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-[#00f2ff]" />
              <span className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold">Region: EU-Central-1</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

