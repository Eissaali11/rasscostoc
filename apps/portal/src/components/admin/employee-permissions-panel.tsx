/**
 * OPS-PERM-S1-F5 — Permissions Center UI: the per-employee detail panel.
 *
 * Reads/writes exclusively through the frozen OPS-PERM-S1-F4 backend API
 * (GET/POST /api/admin/permissions/employees/:userId/*). Every write is re-validated
 * server-side (self-edit, target role, hard ceiling, optimistic concurrency) — this panel's own
 * "not available for this role" styling is a UX convenience derived from the snapshot's own
 * effective decisions (see isRowEditable), never the authority.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, Loader2, Lock, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/language";
import { apiRequest } from "@/lib/queryClient";
import { getRoleLabel } from "@shared/roles";
import type { UserSafe } from "@shared/schema";
import {
  actionLabel,
  dataScopeLabel,
  denyReasonLabel,
  grantSourceLabel,
  isRowEditable,
  overrideValueLabel,
  pageLabel,
  permissionLabel,
  type EmployeePermissionRow,
  type EmployeePermissionSnapshot,
  type OverrideValue,
  type PermissionChangeAuditEntry,
  type WriteOverrideResult,
} from "@/lib/permissions-center";

type WriteType = "grant" | "revoke" | "reset";
type PendingWrite = { type: WriteType; row: EmployeePermissionRow } | null;

interface EmployeePermissionsPanelProps {
  employee: UserSafe;
  usersById: Map<string, UserSafe>;
}

export function EmployeePermissionsPanel({ employee, usersById }: EmployeePermissionsPanelProps) {
  const { t, dir } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = employee.id;

  const snapshotQuery = useQuery<EmployeePermissionSnapshot>({
    queryKey: [`/api/admin/permissions/employees/${userId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/permissions/employees/${userId}`);
      return res.json();
    },
  });

  const auditQuery = useQuery<PermissionChangeAuditEntry[]>({
    queryKey: [`/api/admin/permissions/employees/${userId}/audit`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/permissions/employees/${userId}/audit`);
      return res.json();
    },
  });

  const [pendingWrite, setPendingWrite] = useState<PendingWrite>(null);
  const [reason, setReason] = useState("");

  const writeMutation = useMutation({
    mutationFn: async (input: { type: WriteType; page: string; action: string; reason?: string }) => {
      const res = await apiRequest("POST", `/api/admin/permissions/employees/${userId}/${input.type}`, {
        page: input.page,
        action: input.action,
        reason: input.reason,
      });
      return (await res.json()) as WriteOverrideResult;
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/admin/permissions/employees/${userId}`] }),
        queryClient.invalidateQueries({ queryKey: [`/api/admin/permissions/employees/${userId}/audit`] }),
      ]);
      const toastKey =
        variables.type === "grant" ? "grant_success" : variables.type === "revoke" ? "revoke_success" : "reset_success";
      toast({ title: t(`permissions_center.toast.${toastKey}`) });
      setPendingWrite(null);
      setReason("");
    },
    onError: (error: any) => {
      toast({
        title: t("permissions_center.toast.write_error"),
        description: error?.message || undefined,
        variant: "destructive",
      });
    },
  });

  const rowsByPage = useMemo(() => {
    const map = new Map<string, EmployeePermissionRow[]>();
    for (const row of snapshotQuery.data?.permissions ?? []) {
      const list = map.get(row.page) ?? [];
      list.push(row);
      map.set(row.page, list);
    }
    return map;
  }, [snapshotQuery.data]);

  const openConfirm = (type: WriteType, row: EmployeePermissionRow) => {
    setReason("");
    setPendingWrite({ type, row });
  };

  const closeDialog = (open: boolean) => {
    if (!open && !writeMutation.isPending) {
      setPendingWrite(null);
      setReason("");
    }
  };

  const confirmWrite = () => {
    if (!pendingWrite) return;
    writeMutation.mutate({
      type: pendingWrite.type,
      page: pendingWrite.row.page,
      action: pendingWrite.row.action,
      reason: reason.trim() || undefined,
    });
  };

  if (snapshotQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border bg-white p-12 text-rassco-text shadow-sm" dir={dir}>
        <Loader2 className="h-5 w-5 animate-spin text-rassco" />
        <span>{t("permissions_center.loading_snapshot")}</span>
      </div>
    );
  }

  if (snapshotQuery.error || !snapshotQuery.data) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center space-y-3 shadow-sm" dir={dir}>
        <p className="text-sm text-destructive">{(snapshotQuery.error as Error)?.message}</p>
        <Button variant="outline" onClick={() => snapshotQuery.refetch()}>
          {t("permissions_center.retry")}
        </Button>
      </div>
    );
  }

  const snapshot = snapshotQuery.data;
  const dialogPermission = pendingWrite ? permissionLabel(t, pendingWrite.row.page, pendingWrite.row.action) : "";

  return (
    <div className="space-y-4" dir={dir}>
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-rassco-text">{employee.fullName}</h2>
            <p className="text-sm text-muted-foreground">
              @{employee.username} · {getRoleLabel(employee.role)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={snapshot.isActive ? "default" : "destructive"} className={snapshot.isActive ? "bg-rassco text-white" : ""}>
              {snapshot.isActive ? t("permissions_center.active_badge") : t("permissions_center.inactive_badge")}
            </Badge>
          </div>
        </div>

        {!snapshot.isActive && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t("permissions_center.inactive_account_warning")}</span>
          </div>
        )}
        {!snapshot.regionId && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{t("permissions_center.no_region_warning")}</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="permissions">
        <TabsList>
          <TabsTrigger value="permissions" data-testid="tab-permissions">
            <ShieldCheck className="h-4 w-4 me-1.5" />
            {t("permissions_center.tabs.permissions")}
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="h-4 w-4 me-1.5" />
            {t("permissions_center.tabs.audit")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="space-y-4">
          {Array.from(rowsByPage.entries()).map(([page, rows]) => (
            <div key={page} className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-rassco-text mb-3">{pageLabel(t, page)}</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("permissions_center.table.action")}</TableHead>
                      <TableHead>{t("permissions_center.table.default")}</TableHead>
                      <TableHead>{t("permissions_center.table.assigned")}</TableHead>
                      <TableHead>{t("permissions_center.table.effective")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <PermissionRow
                        key={`${row.page}:${row.action}`}
                        row={row}
                        disabled={writeMutation.isPending}
                        onGrant={() => openConfirm("grant", row)}
                        onRevoke={() => openConfirm("revoke", row)}
                        onReset={() => openConfirm("reset", row)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="audit">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            {auditQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("permissions_center.loading_audit")}</span>
              </div>
            ) : !auditQuery.data || auditQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("permissions_center.audit.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("permissions_center.audit.date")}</TableHead>
                      <TableHead>{t("permissions_center.audit.permission")}</TableHead>
                      <TableHead>{t("permissions_center.audit.from")}</TableHead>
                      <TableHead>{t("permissions_center.audit.to")}</TableHead>
                      <TableHead>{t("permissions_center.audit.changed_by")}</TableHead>
                      <TableHead>{t("permissions_center.audit.reason")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditQuery.data.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(entry.changedAt).toLocaleString(dir === "rtl" ? "ar-SA" : "en-US")}
                        </TableCell>
                        <TableCell className="text-sm">{permissionLabel(t, entry.page, entry.action)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{overrideValueLabel(t, entry.oldValue as OverrideValue | null)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{overrideValueLabel(t, entry.newValue as OverrideValue | null)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {usersById.get(entry.changedBy)?.fullName || entry.changedBy}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                          {entry.reason || t("permissions_center.audit.no_reason")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={pendingWrite !== null} onOpenChange={closeDialog}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingWrite?.type === "grant" && t("permissions_center.confirm_dialog.grant_title")}
              {pendingWrite?.type === "revoke" && t("permissions_center.confirm_dialog.revoke_title")}
              {pendingWrite?.type === "reset" && t("permissions_center.confirm_dialog.reset_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingWrite?.type === "grant" &&
                t("permissions_center.confirm_dialog.grant_description", { permission: dialogPermission })}
              {pendingWrite?.type === "revoke" &&
                t("permissions_center.confirm_dialog.revoke_description", { permission: dialogPermission })}
              {pendingWrite?.type === "reset" &&
                t("permissions_center.confirm_dialog.reset_description", { permission: dialogPermission })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("permissions_center.confirm_dialog.reason_label")}
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("permissions_center.confirm_dialog.reason_placeholder")}
              disabled={writeMutation.isPending}
              data-testid="input-permission-change-reason"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={writeMutation.isPending}>
              {t("permissions_center.confirm_dialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmWrite();
              }}
              disabled={writeMutation.isPending}
              data-testid="button-confirm-permission-change"
            >
              {writeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
              {t("permissions_center.confirm_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PermissionRow({
  row,
  disabled,
  onGrant,
  onRevoke,
  onReset,
}: {
  row: EmployeePermissionRow;
  disabled: boolean;
  onGrant: () => void;
  onRevoke: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const editable = isRowEditable(row);

  return (
    <TableRow data-testid={`row-permission-${row.page}-${row.action}`}>
      <TableCell className="font-medium">{actionLabel(t, row.action)}</TableCell>
      <TableCell>
        <Badge variant={row.defaultGrant ? "secondary" : "outline"} className="whitespace-nowrap">
          {row.defaultGrant ? t("permissions_center.default_granted") : t("permissions_center.default_not_granted")}
        </Badge>
      </TableCell>
      <TableCell>
        {editable ? (
          <div className="inline-flex rounded-lg border overflow-hidden">
            <ToggleButton active={row.assigned === "revoke"} tone="destructive" disabled={disabled} onClick={onRevoke}>
              {t("permissions_center.toggle.revoke")}
            </ToggleButton>
            <ToggleButton active={row.assigned === null} tone="neutral" disabled={disabled} onClick={onReset}>
              {t("permissions_center.toggle.default")}
            </ToggleButton>
            <ToggleButton active={row.assigned === "grant"} tone="positive" disabled={disabled} onClick={onGrant}>
              {t("permissions_center.toggle.grant")}
            </ToggleButton>
          </div>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  {t("permissions_center.not_available_for_role")}
                </span>
              </TooltipTrigger>
              <TooltipContent>{t("permissions_center.not_available_hint")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
      <TableCell>
        {row.effective.allowed ? (
          <div className="flex items-center gap-1.5 text-sm text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-semibold">{t("permissions_center.effective_allowed")}</span>
            <span className="text-xs text-muted-foreground">
              ({grantSourceLabel(t, row.effective.reason)} · {dataScopeLabel(t, row.effective.scope)})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-rose-700">
            <ShieldX className="h-4 w-4" />
            <span className="font-semibold">{t("permissions_center.effective_denied")}</span>
            <span className="text-xs text-muted-foreground">({denyReasonLabel(t, row.effective.reason)})</span>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function ToggleButton({
  active,
  tone,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  tone: "destructive" | "neutral" | "positive";
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const toneClass = active
    ? tone === "destructive"
      ? "bg-rose-600 text-white"
      : tone === "positive"
        ? "bg-emerald-600 text-white"
        : "bg-slate-600 text-white"
    : "bg-white text-rassco-text hover:bg-slate-50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${toneClass}`}
    >
      {children}
    </button>
  );
}
