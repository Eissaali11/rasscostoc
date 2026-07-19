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
import { useTranslation } from "@/lib/language";
import { apiRequest } from "@/lib/queryClient";

interface BackupEntry {
  name: string;
  data: string;
  size: number;
  date: string;
  type: "local" | "cloud";
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
  type: "cloud";
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
      type: "local";
      data: string;
    }
  | {
      id: string;
      source: "server";
      name: string;
      createdAt: string | null;
      sizeBytes: number;
      type: "cloud";
    };

type TranslateFn = (key: string, options?: Record<string, any>) => string;

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

function formatRelativeTime(dateIso: string | null | undefined, t: TranslateFn): string {
  if (!dateIso) return t("settings.no_backups");

  const timestamp = new Date(dateIso).getTime();
  if (Number.isNaN(timestamp)) return t("settings.no_backups");

  const diffMs = Date.now() - timestamp;
  if (diffMs <= 0) return t("settings.just_now");

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return t("settings.just_now");
  if (diffMinutes < 60) return t("settings.minutes_ago", { count: diffMinutes });

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return t("settings.hours_ago", { count: diffHours });

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return t("settings.days_ago", { count: diffDays });

  const diffMonths = Math.floor(diffDays / 30);
  return t("settings.months_ago", { count: diffMonths });
}

function formatRestoreSummary(
  imported: RestoreResponse["imported"] | undefined,
  t: TranslateFn,
): string {
  if (!imported) return t("settings.restore_summary_default");

  const usersCount = imported.users ?? 0;
  const regionsCount = imported.regions ?? 0;
  const itemsCount = imported.inventoryItems ?? 0;
  const transactionsCount = imported.transactions ?? 0;
  const warehousesCount = imported.warehouses ?? 0;
  const warehouseInventoryCount = imported.warehouseInventory ?? 0;

  return t("settings.restore_summary", {
    users: usersCount,
    regions: regionsCount,
    warehouses: warehousesCount,
    warehouseInventory: warehouseInventoryCount,
    items: itemsCount,
    transactions: transactionsCount,
  });
}

export default function BackupManagementPage() {
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recentBackups, setRecentBackups] = useState<BackupEntry[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleType, setScheduleType] = useState<"daily" | "weekly">("daily");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dateLocale = language === "en" ? "en-US" : "ar-EG";

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
      type: "local",
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
        type: "cloud",
      }));

    return [...localRows, ...serverRows];
  }, [backupHistory?.items, recentBackups]);

  const latestBackupAt =
    storageStats?.lastBackupAt ||
    mergedBackupRows[0]?.createdAt ||
    null;

  const lastBackupLabel = useMemo(
    () => formatRelativeTime(latestBackupAt, t),
    [latestBackupAt, t],
  );

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/admin/backup', {
        credentials: 'include',
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error(t("settings.export_failed"));
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
        { name: filename, data: dataStr, size: dataBlob.size, date: new Date().toISOString(), type: "local" },
        ...prev,
      ]);

      toast({
        title: t("settings.export_success_title"),
        description: t("settings.export_success_desc"),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/backup/storage-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/backup/history"] }),
      ]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("settings.export_error_title"),
        description: error instanceof Error ? error.message : t("settings.export_error_desc"),
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
        title: t("settings.backup_restore_success"),
        description: formatRestoreSummary(restoreResult.imported, t),
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
        title: t("settings.restore_error_title"),
        description: error instanceof Error ? error.message : t("settings.restore_error_desc"),
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
        title: t("settings.file_not_selected"),
        description: t("settings.select_backup_first"),
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
      toast({
        title: t("settings.download_success_title"),
        description: t("settings.download_success_desc", { name: entry.name }),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t("settings.error"),
        description: t("settings.download_failed"),
      });
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
      toast({
        title: t("settings.backup_restore_success"),
        description: formatRestoreSummary(restoreResult.imported, t),
      });

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
        title: t("settings.restore_error_title"),
        description: error instanceof Error ? error.message : t("settings.restore_failed"),
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-[#F8FAFB] text-[#2D3135] relative overflow-x-hidden -m-8 p-8">

      <main className="relative">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-8 z-10">
          <div>
            <h2 className="text-3xl font-black text-[#2D3135] tracking-tight">{t("settings.backup_page_title")}</h2>
            <p className="text-[#6B7280] mt-1">{t("settings.backup_page_subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <label
              htmlFor="backup-file-input"
              className="bg-white border border-[#18B2B0]/30 text-[#18B2B0] hover:bg-[#18B2B0]/10 px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              {t("settings.import_backup")}
            </label>
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="bg-[#18B2B0] hover:bg-[#149D9B] text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold transition-all disabled:opacity-70"
              data-testid="button-export-quick"
            >
              <Download className="h-4 w-4" />
              {isExporting ? t("settings.exporting") : t("settings.create_instant_backup")}
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
          <section className="rassco-glass rassco-glass-static p-6">
            <div className="flex items-center gap-2 mb-6">
              <Upload className="text-[#18B2B0] h-5 w-5" />
              <h3 className="text-lg font-bold text-[#2D3135]">{t("settings.import_data")}</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              <label
                htmlFor="backup-file-input"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="lg:col-span-2 rounded-2xl border-2 border-dashed border-[#18B2B0]/30 p-10 flex flex-col items-center justify-center text-center group cursor-pointer bg-[#18B2B0]/5 hover:border-[#18B2B0]/50 hover:bg-[#18B2B0]/8 transition-colors"
              >
                <div className="w-16 h-16 rounded-full bg-[#18B2B0]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <CloudUpload className="text-[#18B2B0] h-8 w-8" />
                </div>
                <p className="text-lg font-bold mb-1 text-[#2D3135]">{t("settings.drop_backup_here")}</p>
                <p className="text-sm text-[#6B7280] mb-4">{t("settings.or_click_to_choose")}</p>
                {selectedFile ? (
                  <p className="text-xs text-[#149D9B] font-bold mb-3">{selectedFile.name}</p>
                ) : null}
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-white border border-[#18B2B0]/25 rounded text-[10px] text-[#18B2B0] font-bold uppercase tracking-wider">.sql</span>
                  <span className="px-3 py-1 bg-white border border-[#18B2B0]/25 rounded text-[10px] text-[#18B2B0] font-bold uppercase tracking-wider">.zip</span>
                  <span className="px-3 py-1 bg-white border border-[#18B2B0]/25 rounded text-[10px] text-[#18B2B0] font-bold uppercase tracking-wider">.bak</span>
                </div>
              </label>

              <div className="flex flex-col gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-bold text-[#6B7280]">{t("settings.processing_data")}</span>
                    <span className="text-[#18B2B0] font-bold">65%</span>
                  </div>
                  <div className="w-full h-3 bg-[#E6E8EC] rounded-full overflow-hidden">
                    <div className="h-full w-[65%] bg-[#18B2B0] rounded-full" />
                  </div>
                </div>

                <div className="bg-[#18B2B0]/5 p-4 rounded-xl border border-[#18B2B0]/15">
                  <div className="flex items-center gap-3 text-xs text-[#6B7280] leading-relaxed">
                    <CheckCircle2 className="text-[#18B2B0] h-4 w-4" />
                    <p>{t("settings.import_compat_warning")}</p>
                  </div>
                </div>

                <button
                  className="w-full py-3 bg-[#18B2B0] hover:bg-[#149D9B] text-white rounded-xl font-bold transition-all disabled:opacity-50"
                  disabled={isImporting || !selectedFile}
                  onClick={handleStartImport}
                  data-testid="button-import-backup"
                >
                  {isImporting ? t("settings.restoring") : t("settings.start_import")}
                </button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rassco-glass p-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280] text-sm">{t("settings.last_backup")}</span>
                <History className="text-[#18B2B0] h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-[#2D3135]">{lastBackupLabel}</div>
              <div className="text-xs text-[#149D9B] font-medium">
                {t("settings.saved_copies_count", {
                  count: storageStats?.exportsCount ?? mergedBackupRows.length,
                })}
              </div>
            </div>

            <div className="rassco-glass p-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280] text-sm">{t("settings.total_data_size")}</span>
                <Database className="text-[#18B2B0] h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-[#2D3135]" dir="ltr">
                <span className="inline-flex items-baseline gap-1.5">
                  <span>{totalStorageDisplay.value}</span>
                  <span>{totalStorageDisplay.unit}</span>
                </span>
              </div>
              <div className="text-xs text-[#149D9B] font-medium">{t("settings.unlimited_capacity")}</div>
            </div>

            <div className="rassco-glass p-6 flex flex-col gap-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280] text-sm">{t("settings.system_status")}</span>
                <CheckCircle2 className="text-[#18B2B0] h-4 w-4" />
              </div>
              <div className="text-2xl font-bold text-[#2D3135] pr-4">{t("settings.safe_and_connected")}</div>
              <div className="text-xs text-[#6B7280]">{t("settings.all_services_ok")}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rassco-glass rassco-glass-static overflow-hidden flex flex-col">
              <div className="p-6 border-b border-[#E6E8EC] flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#2D3135]">{t("settings.backup_history")}</h3>
                <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors" type="button" aria-label={t("settings.filter")}>
                  <Filter className="text-[#6B7280] h-4 w-4" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#F3F4F6] text-[#6B7280] text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">{t("settings.backup_name")}</th>
                      <th className="px-6 py-4 font-bold">{t("settings.date_time")}</th>
                      <th className="px-6 py-4 font-bold">{t("settings.size")}</th>
                      <th className="px-6 py-4 font-bold">{t("settings.type")}</th>
                      <th className="px-6 py-4 font-bold">{t("settings.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E8EC]">
                    {mergedBackupRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#6B7280]">
                          {t("settings.no_backups_yet")}
                        </td>
                      </tr>
                    ) : (
                      mergedBackupRows.map((row) => {
                        const sizeLabel = row.sizeBytes > 0
                          ? formatStorageValue(row.sizeBytes)
                          : null;

                        return (
                          <tr key={row.id} className="hover:bg-[#F8FAFB] transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-[#2D3135]">{row.name}</td>
                            <td className="px-6 py-4 text-sm text-[#6B7280]">
                              {row.createdAt ? new Date(row.createdAt).toLocaleString(dateLocale) : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm text-[#2D3135]" dir="ltr">
                              {sizeLabel ? `${sizeLabel.value} ${sizeLabel.unit}` : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={
                                  row.type === "cloud"
                                    ? "px-2 py-1 rounded bg-[#6B7280]/10 text-[#6B7280] text-xs border border-[#6B7280]/25"
                                    : "px-2 py-1 rounded bg-[#18B2B0]/10 text-[#149D9B] text-xs border border-[#18B2B0]/25"
                                }
                              >
                                {row.type === "cloud" ? t("settings.cloud") : t("settings.local")}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-3">
                                {row.source === "local" ? (
                                  <>
                                    <button
                                      className="text-[#18B2B0] hover:text-[#149D9B]"
                                      title={t("settings.restore")}
                                      onClick={() =>
                                        handleRestoreRecent({
                                          name: row.name,
                                          data: row.data,
                                          size: row.sizeBytes,
                                          date: row.createdAt,
                                          type: "local",
                                        })
                                      }
                                      type="button"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="text-[#6B7280] hover:text-[#2D3135]"
                                      title={t("settings.download")}
                                      onClick={() => handleRedownload({
                                        name: row.name,
                                        data: row.data,
                                        size: row.sizeBytes,
                                        date: row.createdAt,
                                        type: "local",
                                      })}
                                      type="button"
                                    >
                                      <Download className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="text-[#6B7280] hover:text-[#E05252]"
                                      title={t("settings.delete")}
                                      onClick={() => handleRemoveBackup(row.name)}
                                      type="button"
                                    >
                                      ×
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="text-[#D7DCE2] cursor-not-allowed"
                                      title={t("settings.restore_local_only")}
                                      type="button"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="text-[#D7DCE2] cursor-not-allowed"
                                      title={t("settings.download_local_only")}
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
              <div className="rassco-glass p-8 flex flex-col items-center justify-center text-center">
                <h4 className="text-sm font-bold mb-6 self-start text-[#2D3135]">{t("settings.cloud_storage_usage")}</h4>
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200" fill="none">
                    <circle cx="100" cy="100" r="88" stroke="#E6E8EC" strokeWidth="12" />
                    <circle
                      cx="100"
                      cy="100"
                      r="88"
                      stroke="#18B2B0"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={storageCircleCircumference}
                      strokeDashoffset={storageCircleOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-[#2D3135]" dir="ltr">{usedCapacityPercent}%</span>
                    <span className="text-[10px] text-[#6B7280] uppercase tracking-widest">{t("settings.used_capacity")}</span>
                  </div>
                </div>

                <div className="mt-8 w-full flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#18B2B0]" />
                    <span className="text-[#6B7280]">
                      {t("settings.used")} <span dir="ltr">({usedStorageDisplay.value} {usedStorageDisplay.unit})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#E6E8EC]" />
                    <span className="text-[#6B7280]">
                      {t("settings.available")} <span dir="ltr">({availableStorageDisplay.value} {availableStorageDisplay.unit})</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="rassco-glass p-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-bold text-[#2D3135]">{t("settings.auto_schedule")}</h4>
                  <button
                    type="button"
                    onClick={() => setScheduleEnabled((prev) => !prev)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${scheduleEnabled ? "bg-[#18B2B0]" : "bg-[#E6E8EC]"}`}
                    aria-label={t("settings.enable_schedule")}
                  >
                    <span
                      className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform ${scheduleEnabled ? "translate-x-[22px]" : "translate-x-[2px]"}`}
                    />
                  </button>
                </div>

                <div className="space-y-4">
                  <label className={`flex items-center p-3 rounded-xl border transition-all cursor-pointer ${scheduleType === "daily" ? "bg-[#18B2B0]/6 border-[#18B2B0]/35" : "border-[#E6E8EC] hover:border-[#18B2B0]/30"}`}>
                    <input
                      className="w-4 h-4"
                      name="schedule"
                      type="radio"
                      checked={scheduleType === "daily"}
                      onChange={() => setScheduleType("daily")}
                    />
                    <div className="mr-4">
                      <p className="text-sm font-bold text-[#2D3135]">{t("settings.daily")}</p>
                      <p className="text-[10px] text-[#6B7280]">{t("settings.daily_desc")}</p>
                    </div>
                  </label>

                  <label className={`flex items-center p-3 rounded-xl border transition-all cursor-pointer ${scheduleType === "weekly" ? "bg-[#18B2B0]/6 border-[#18B2B0]/35" : "border-[#E6E8EC] hover:border-[#18B2B0]/30"}`}>
                    <input
                      className="w-4 h-4"
                      name="schedule"
                      type="radio"
                      checked={scheduleType === "weekly"}
                      onChange={() => setScheduleType("weekly")}
                    />
                    <div className="mr-4">
                      <p className="text-sm font-bold text-[#2D3135]">{t("settings.weekly")}</p>
                      <p className="text-[10px] text-[#6B7280]">{t("settings.weekly_desc")}</p>
                    </div>
                  </label>
                </div>

                <button className="w-full mt-6 py-2.5 rounded-xl border border-[#18B2B0]/35 text-[#18B2B0] text-xs font-bold hover:bg-[#18B2B0] hover:text-white transition-all" type="button">
                  {t("settings.update_schedule")}
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-auto p-6 bg-white/60 border-t border-[#E6E8EC] flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2 space-x-reverse">
              <img
                alt="Avatar"
                className="w-8 h-8 rounded-full border-2 border-white"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBvXYfcdb50qRRpqJLf3yqj3XIlGo8-_Z5FEGNFkL0_e1HP9a5amoZwkHg9TjLfhy9c1Sj0NeZgzVuZFTsF_Ir6PnKrqX4CT1oLgLNofWm9ZSnP2qCQNjDnJTcC_5wteoddoipkth-hbqlWlH7eXLY1mFXRPVtJyrPtRw7-Eroe9plYHkEJDM1bMUl6cea0SyElv58ne8ZuFmElkIeb3xD8t92DbyFM0DKSdhrDY3GFXCv-0yjNCx6br9Q1zEX0TaKlg0df8mdUlRc"
              />
              <img
                alt="Avatar"
                className="w-8 h-8 rounded-full border-2 border-white"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAATPAnMuYkpNL44qjRYOzUNFAcuteUpUk4T51lZ5u4Kzi2LQLMtcysDOeUxlIykkDs8mb5qs_AQypgt3mBZngz4IBTOmBB_E-cK39c98u_ZgKiyNAn-D5NC0r97WMmft4vK1fsWjVLTl5L0cXget8dN0cnFfsjWsP_68PhWcMneFy142L5MzxkGZrw0gDhb3iVACihOoZXO9mvgxyNqlrmFXmlz5JasQrxLOq7IyhyG5NdeF6eBDSsJ5SpQTGRpBrvm1Q-bTVqt70"
              />
            </div>
            <p className="text-xs text-[#6B7280]">{t("settings.support_team_online")}</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#18B2B0]" />
              <span className="text-[10px] uppercase tracking-tighter text-[#6B7280] font-bold">AES-256 Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-[#18B2B0]" />
              <span className="text-[10px] uppercase tracking-tighter text-[#6B7280] font-bold">Region: EU-Central-1</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
