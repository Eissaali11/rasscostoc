import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { getRoleLabel } from "@shared/roles";
import { getAuthorizedNavigation } from "@/lib/navigation";
import logo from "@/assets/logo.png";
import {
  Bell,
  Boxes,
  CircleHelp,
  ClipboardList,
  Home,
  Settings,
  Shapes,
  ShieldCheck,
  Undo2,
  LogOut,
  ScrollText,
  Search,
  Users,
  Warehouse,
  Calculator,
  Menu,
  X,
} from "lucide-react";

type NeoShellLayoutProps = {
  title: string;
  children: ReactNode;
};

interface InventoryRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
}

interface ReceivedDeviceRequest {
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
  if (!fullName) return "م";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "م") + (parts[1]?.[0] || "");
}

export function NeoShellLayout({ title, children }: NeoShellLayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isAdminOrSupervisor = user?.role === "admin" || user?.role === "supervisor";
  const isTechnician = user?.role === "technician";

  const { data: requests = [] } = useQuery<InventoryRequest[]>({
    queryKey: user?.role === "admin" ? ["/api/inventory-requests"] : ["/api/supervisor/inventory-requests"],
    enabled: isAdminOrSupervisor,
  });

  const { data: receivedDevices = [] } = useQuery<ReceivedDeviceRequest[]>({
    queryKey: ["/api/received-devices"],
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
        groupMap.set(key, {
          requestId: key,
          status: transfer.status,
        });
      }
    });

    return Array.from(groupMap.values());
  }, [isTechnician, transfers]);

  const pendingNotificationsCount = isAdminOrSupervisor
    ? requests.filter((request) => request.status === "pending").length +
      receivedDevices.filter((device) => device.status === "pending").length
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

    // Check if token is expired or close to expiring (less than 10 seconds remaining)
    let isExpired = true;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const exp = payload.exp * 1000;
        if (Date.now() < exp - 10000) {
          isExpired = false;
        }
      } catch (err) {
        // Invalid token format
      }
    }

    if (isExpired && refreshToken) {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.token && data.refreshToken) {
            localStorage.setItem('auth-token', data.token);
            localStorage.setItem('refresh-token', data.refreshToken);
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

  return (
    <div dir="rtl" className="min-h-screen bg-[#102222] text-slate-100 flex overflow-x-hidden">
      {/* Backdrop overlay — closes drawer on click (all screen sizes) */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          isSidebarOpen
            ? "bg-black/60 backdrop-blur-sm pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar / Overlay Drawer */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-72 border-l border-slate-700/60 bg-[#1a3636] flex flex-col h-screen transition-transform duration-300 ease-in-out shadow-2xl ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6 flex items-center justify-between gap-3 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-xl bg-cyan-400/20 text-cyan-300 flex items-center justify-center overflow-hidden shrink-0">
              <img src={logo} alt="ستوك" className="h-14 w-14 object-contain" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">إدارة المخزون</h1>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="إغلاق القائمة الجانبية"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-5 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-700/40">
            <div className="size-11 rounded-full bg-cyan-300/20 text-cyan-200 flex items-center justify-center border border-cyan-300/40 font-semibold">
              {initials(user?.fullName)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user?.fullName || "المستخدم"}</span>
              <span className="text-xs text-slate-400">{getRoleLabel(user?.role || "technician")}</span>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isExternal = item.href.startsWith("http");
              const active =
                !isExternal &&
                (location === item.href ||
                  (item.href !== "/home" && location.startsWith(item.href)));

              if (isExternal) {
                return (
                  <a
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    onClick={(e) => handleExternalClick(e, item.href)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800/70 transition-colors font-medium"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </a>
                );
              }

              const showChildren = item.children && (location === item.href || (item.href !== "/home" && location.startsWith(item.href)));

              return (
                <div key={`${item.href}-${item.label}`} className="flex flex-col gap-1">
                  <Link
                    href={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={
                      active && !item.children
                        ? "flex items-center gap-3 px-4 py-3 rounded-xl bg-cyan-400/20 text-cyan-300 font-medium"
                        : "flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800/70 transition-colors font-medium"
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                  {showChildren && item.children && (
                    <div className="mr-6 border-r border-slate-700/60 pr-4 py-1 flex flex-col gap-1.5">
                      {item.children
                        .filter((child) => !child.roles || child.roles.includes(user?.role || ""))
                        .map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = location === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setIsSidebarOpen(false)}
                            className={
                              childActive
                                ? "flex items-center gap-2.5 px-3 py-2 rounded-lg bg-cyan-400/10 text-cyan-300 text-xs font-semibold"
                                : "flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors text-xs font-medium"
                            }
                          >
                            <ChildIcon className="h-3.5 w-3.5" />
                            {child.label}
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

        <div className="p-4 border-t border-slate-700/60">
          {user?.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800/70 transition-colors font-medium mb-1"
            >
              <Users className="h-4 w-4 text-cyan-400" />
              إدارة المستخدمين
            </Link>
          )}
          <a className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800/70 transition-colors font-medium" href="#">
            <CircleHelp className="h-4 w-4" />
            المساعدة
          </a>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-2 w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-300 hover:bg-rose-500/10 transition-colors font-medium disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "جاري الخروج..." : "تسجيل الخروج"}
          </button>
        </div>
      </aside>

      {/* Main content — full width now */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        <header className="h-20 border-b border-slate-700/60 bg-[#143030]/90 backdrop-blur-md flex items-center justify-between px-6 lg:px-8 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
              aria-label="فتح القائمة الجانبية"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="text-xl lg:text-2xl font-bold">{title}</h2>
          </div>
          <div className="flex items-center gap-5">
            <button
              className="relative p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-300"
              type="button"
              onClick={() => setLocation("/notifications")}
              aria-label="فتح الإشعارات"
            >
              <Bell className="h-5 w-5" />
              {pendingNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 bg-red-500 text-white text-[10px] leading-none font-bold rounded-full border border-[#143030] flex items-center justify-center">
                  {notificationBadgeLabel}
                </span>
              )}
            </button>
            <div className="text-slate-300">
              <Settings className="h-5 w-5" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}
