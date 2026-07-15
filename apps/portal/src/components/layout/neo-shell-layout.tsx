import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { getRoleLabel } from "@shared/roles";
import { getAuthorizedNavigation } from "@/lib/navigation";
import { useTranslation } from "@/lib/language";
import logoHorizontal from "@/assets/rassco-logo-horizontal.png";
import logoIcon from "@/assets/rassco-logo-icon.png";
import {
  Bell,
  CircleHelp,
  Languages,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";

type NeoShellLayoutProps = {
  /** i18n key under common (e.g. "titles.home") */
  titleKey: string;
  children: ReactNode;
};

interface InventoryRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
}

interface WarehouseTransfer {
  id: string;
  requestId?: string;
  technicianId: string;
  warehouseId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

interface GroupedTransfer {
  requestId: string;
  status: "pending" | "accepted" | "rejected";
}

function initials(fullName?: string | null): string {
  if (!fullName) return "U";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
}

const navIdle =
  "flex items-center gap-3 px-4 py-3 rounded-2xl text-white/85 hover:bg-[rgba(24,178,176,0.12)] hover:text-white transition-colors font-medium";
const navActive =
  "flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#18B2B0] text-white font-semibold shadow-[0_8px_20px_rgba(24,178,176,0.28)]";
const childNavIdle =
  "flex items-center gap-2.5 px-3 py-2 rounded-2xl text-white/70 hover:text-white hover:bg-[rgba(24,178,176,0.12)] transition-colors text-xs font-medium";
const childNavActive =
  "flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-[rgba(24,178,176,0.22)] text-white text-xs font-semibold";

export function NeoShellLayout({ titleKey, children }: NeoShellLayoutProps) {
  const { t, dir, language, changeLanguage } = useTranslation();
  const title = t(titleKey);
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isAdminOrSupervisor = user?.role === "admin" || user?.role === "supervisor";
  const isTechnician = user?.role === "technician";

  type PendingCountResponse = { count: number };

  const { data: pendingRequestsCount } = useQuery<PendingCountResponse>({
    queryKey:
      user?.role === "admin"
        ? ["/api/inventory-requests/pending/count"]
        : ["/api/supervisor/inventory-requests/pending/count"],
    enabled: isAdminOrSupervisor,
  });

  const { data: pendingReceivedDevicesCount } = useQuery<PendingCountResponse>({
    queryKey: ["/api/received-devices/pending/count"],
    enabled: isAdminOrSupervisor,
  });

  const { data: transfers = [] } = useQuery<WarehouseTransfer[]>({
    queryKey: ["/api/warehouse-transfers"],
    enabled: isTechnician && !!user?.id,
  });

  const { data: myInventoryRequests = [] } = useQuery<InventoryRequest[]>({
    queryKey: ["/api/inventory-requests/my"],
    enabled: isTechnician && !!user?.id,
  });

  const groupedTransfers = useMemo(() => {
    if (!isTechnician) return [] as GroupedTransfer[];
    const groupMap = new Map<string, GroupedTransfer>();
    transfers.forEach((transfer) => {
      const key =
        transfer.requestId ||
        `${transfer.technicianId}-${transfer.warehouseId}-${new Date(transfer.createdAt).getTime()}-${transfer.status}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { requestId: key, status: transfer.status });
      }
    });
    return Array.from(groupMap.values());
  }, [isTechnician, transfers]);

  const pendingNotificationsCount = isAdminOrSupervisor
    ? (pendingRequestsCount?.count || 0) + (pendingReceivedDevicesCount?.count || 0)
    : groupedTransfers.filter((group) => group.status === "pending").length +
      myInventoryRequests.filter((request) => request.status === "pending").length;

  const notificationBadgeLabel = pendingNotificationsCount > 99 ? "99+" : String(pendingNotificationsCount);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleExternalClick = async (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setIsSidebarOpen(false);

    let token = localStorage.getItem("auth-token");
    const refreshToken = localStorage.getItem("refresh-token");

    let isExpired = true;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const exp = payload.exp * 1000;
        if (Date.now() < exp - 10000) isExpired = false;
      } catch {
        // ignore
      }
    }

    if (isExpired && refreshToken) {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.token && data.refreshToken) {
            localStorage.setItem("auth-token", data.token);
            localStorage.setItem("refresh-token", data.refreshToken);
            token = data.token;
          }
        }
      } catch (err) {
        console.error("Failed to refresh token for SSO navigation:", err);
      }
    }

    const ssoUrl = token
      ? `${href}/api/auth/sso?token=${encodeURIComponent(token)}`
      : href;
    window.open(ssoUrl, "_blank", "noopener,noreferrer");
  };

  const navItems = getAuthorizedNavigation(user?.role || "technician");
  const sidebarSideClass = dir === "rtl" ? "right-0 border-l" : "left-0 border-r";
  const sidebarHiddenClass =
    dir === "rtl"
      ? isSidebarOpen
        ? "translate-x-0"
        : "translate-x-full"
      : isSidebarOpen
        ? "translate-x-0"
        : "-translate-x-full";
  const submenuPadClass = dir === "rtl" ? "mr-6 border-r pr-4" : "ml-6 border-l pl-4";

  return (
    <div dir={dir} className="min-h-screen bg-rassco-bg text-rassco-text flex overflow-x-hidden">
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          isSidebarOpen
            ? "bg-black/40 backdrop-blur-sm pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside
        className={`fixed top-0 bottom-0 z-50 w-72 ${sidebarSideClass} border-white/10 bg-[#5F6368] flex flex-col h-screen transition-transform duration-300 ease-in-out shadow-2xl ${sidebarHiddenClass}`}
      >
        <div className="p-5 flex items-center justify-between gap-3 border-b border-white/10">
          <Link
            href="/home"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-3 min-w-0 group"
            aria-label="RASSCO"
          >
            <div className="h-12 w-12 rounded-[18px] bg-white/95 shadow-[0_10px_24px_rgba(0,0,0,0.28)] flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-white/40 p-1">
              <img
                src={logoIcon}
                alt="RASSCO"
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="text-[17px] font-extrabold tracking-[0.14em] text-white group-hover:text-[#18B2B0] transition-colors">
                RASSCO
              </span>
              <span className="text-[11px] text-white/65 truncate mt-0.5">
                {t("app.name")}
              </span>
            </div>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-2xl text-white/70 hover:text-white hover:bg-[rgba(24,178,176,0.12)] transition-colors shrink-0"
            aria-label={t("close_sidebar")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-5 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/15 border border-white/10">
            <div className="size-11 rounded-full bg-[rgba(24,178,176,0.18)] text-white flex items-center justify-center border border-[#18B2B0]/40 font-semibold">
              {initials(user?.fullName)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">{user?.fullName || t("user")}</span>
              <span className="text-xs text-white/65">
                {getRoleLabel(user?.role || "technician")}
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isExternal = item.href.startsWith("http");
              const label = t(item.labelKey);
              const active =
                !isExternal &&
                (location === item.href ||
                  (item.href !== "/home" && location.startsWith(item.href)));

              if (isExternal) {
                return (
                  <a
                    key={`${item.href}-${item.labelKey}`}
                    href={item.href}
                    onClick={(e) => handleExternalClick(e, item.href)}
                    className={navIdle}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                );
              }

              const showChildren =
                item.children &&
                (location === item.href ||
                  (item.href !== "/home" && location.startsWith(item.href)));

              return (
                <div key={`${item.href}-${item.labelKey}`} className="flex flex-col gap-1">
                  <Link
                    href={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={active && !item.children ? navActive : navIdle}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                  {showChildren && item.children && (
                    <div className={`${submenuPadClass} border-white/15 py-1 flex flex-col gap-1.5`}>
                      {item.children
                        .filter((child) => !child.roles || child.roles.includes(user?.role || ""))
                        .map((child) => {
                          const ChildIcon = child.icon;
                          const isChildActive = location === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => setIsSidebarOpen(false)}
                              className={isChildActive ? childNavActive : childNavIdle}
                            >
                              <ChildIcon className="h-3.5 w-3.5" />
                              {t(child.labelKey)}
                            </Link>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          {user?.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setIsSidebarOpen(false)}
              className={`${navIdle} mb-1`}
            >
              <Users className="h-4 w-4 text-[#18B2B0]" />
              {t("manage_users")}
            </Link>
          )}
          <a className={navIdle} href="#">
            <CircleHelp className="h-4 w-4" />
            {t("help")}
          </a>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-2 w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[#E05252] hover:bg-[rgba(224,82,82,0.12)] transition-colors font-medium disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut
              ? t("messages.logging_out", { ar: "جاري الخروج...", en: "Signing out..." })
              : t("logout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        <header className="relative h-20 border-b border-rassco-border bg-white/95 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0 z-10">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-2xl text-rassco-gray hover:bg-[rgba(24,178,176,0.12)] hover:text-[#18B2B0] transition-colors shrink-0"
              aria-label={t("open_sidebar")}
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-rassco-text truncate max-w-[42vw] sm:max-w-[28vw] lg:max-w-none">
              {title}
            </h2>
          </div>

          <Link
            href="/home"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-20 rounded-2xl px-3 py-1.5 hover:bg-[rgba(24,178,176,0.08)] transition-colors"
            aria-label="RASSCO Home"
          >
            <img
              src={logoHorizontal}
              alt="RASSCO"
              className="h-10 sm:h-11 w-auto max-w-[168px] sm:max-w-[200px] object-contain drop-shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
              draggable={false}
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-10">
            <button
              type="button"
              onClick={() => changeLanguage(language === "ar" ? "en" : "ar")}
              className="px-3 py-1.5 rounded-2xl border border-rassco-border text-xs font-bold bg-rassco-bg text-rassco-text hover:border-[#18B2B0] hover:text-[#18B2B0] transition-all uppercase tracking-wide flex items-center gap-1.5"
              title={language === "ar" ? "Switch to English" : t("arabic")}
              data-testid="button-language-toggle"
            >
              <Languages className="h-3.5 w-3.5" />
              <span>{language === "ar" ? "EN" : "AR"}</span>
            </button>
            <button
              className="relative p-2 rounded-full hover:bg-[rgba(24,178,176,0.12)] transition-colors text-rassco-gray hover:text-[#18B2B0]"
              type="button"
              onClick={() => setLocation("/notifications")}
              aria-label={t("notifications")}
            >
              <Bell className="h-5 w-5" />
              {pendingNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 bg-rassco-danger text-white text-[10px] leading-none font-bold rounded-full border border-white flex items-center justify-center">
                  {notificationBadgeLabel}
                </span>
              )}
            </button>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-[rgba(24,178,176,0.12)] transition-colors text-rassco-gray hover:text-[#18B2B0]"
              onClick={() => setLocation("/profile")}
              aria-label={t("settings")}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 rassco-light-surface enterprise-atmosphere">
          {children}
        </div>
      </main>
    </div>
  );
}
