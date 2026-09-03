/**
 * OPS-PERM-S1-F5 — Permissions Center UI.
 *
 * Admin-only page (route-gated in App.tsx, same as every other /admin/* page) that surfaces the
 * OPS-PERM-S1-F4 Permission Engine: a searchable list of Supervisor-role employees on the left,
 * and the selected employee's full permission snapshot + audit history on the right
 * (EmployeePermissionsPanel). V1 scope, unchanged from F4: only Supervisor-role employees are
 * manageable here — see PermissionsService's "Admin manages SUPERVISOR permissions" comment.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock, Search, ShieldQuestion } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/language";
import { apiRequest } from "@/lib/queryClient";
import { getRoleLabel } from "@shared/roles";
import type { UserSafe } from "@shared/schema";
import { EmployeePermissionsPanel } from "@/components/admin/employee-permissions-panel";

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function PermissionsCenterPage() {
  const { t, dir } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const usersQuery = useQuery<UserSafe[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json();
    },
  });
  const users = usersQuery.data ?? [];

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const supervisors = useMemo(() => users.filter((u) => u.role === "supervisor"), [users]);

  const filteredSupervisors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return supervisors;
    return supervisors.filter(
      (u) =>
        u.fullName.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
    );
  }, [supervisors, searchTerm]);

  // Keep the selection valid if the underlying user list changes (e.g. the selected employee's
  // role was changed away from supervisor by another admin session).
  useEffect(() => {
    if (selectedUserId && usersQuery.data && !supervisors.some((u) => u.id === selectedUserId)) {
      setSelectedUserId(null);
    }
  }, [supervisors, selectedUserId, usersQuery.data]);

  const selectedEmployee = selectedUserId ? usersById.get(selectedUserId) ?? null : null;

  return (
    <div className="space-y-6" dir={dir}>
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-rassco/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-rassco" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-rassco-text">{t("titles.permissions_center")}</h1>
            <p className="text-sm text-muted-foreground">{t("permissions_center.subtitle")}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 border">
          {t("permissions_center.scope_note")}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("permissions_center.search_placeholder")}
              className="ps-9"
              data-testid="input-search-supervisors"
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-bold text-rassco-text">{t("permissions_center.supervisors_heading")}</span>
            <Badge variant="outline">{t("permissions_center.supervisors_count", { count: filteredSupervisors.length })}</Badge>
          </div>

          {usersQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t("permissions_center.loading_employees")}</span>
            </div>
          ) : usersQuery.error ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm text-destructive">{(usersQuery.error as Error).message}</p>
              <Button variant="outline" size="sm" onClick={() => usersQuery.refetch()}>
                {t("permissions_center.retry")}
              </Button>
            </div>
          ) : filteredSupervisors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {searchTerm ? t("permissions_center.no_supervisors_search") : t("permissions_center.no_supervisors")}
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-[65vh] overflow-y-auto">
              {filteredSupervisors.map((supervisor) => {
                const active = supervisor.id === selectedUserId;
                return (
                  <li key={supervisor.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(supervisor.id)}
                      data-testid={`button-select-supervisor-${supervisor.id}`}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors ${
                        active ? "bg-rassco/10 border border-rassco/40" : "hover:bg-muted/60 border border-transparent"
                      }`}
                    >
                      <div className="h-9 w-9 rounded-full bg-rassco/15 text-rassco flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(supervisor.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-rassco-text truncate">{supervisor.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getRoleLabel(supervisor.role)}
                          {!supervisor.isActive ? ` · ${t("permissions_center.inactive_badge")}` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedEmployee ? (
          <EmployeePermissionsPanel key={selectedEmployee.id} employee={selectedEmployee} usersById={usersById} />
        ) : (
          <div className="rounded-2xl border border-dashed bg-white/60 p-16 flex flex-col items-center justify-center text-center gap-3">
            <ShieldQuestion className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-rassco-text">{t("permissions_center.select_supervisor")}</p>
            <p className="text-sm text-muted-foreground max-w-sm">{t("permissions_center.select_supervisor_hint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
