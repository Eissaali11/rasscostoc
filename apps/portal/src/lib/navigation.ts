import {
  Home,
  Boxes,
  Shapes,
  Search,
  ClipboardList,
  Warehouse,
  Undo2,
  Calculator,
  Users,
  ScrollText,
  ShieldCheck,
  Truck,
  LayoutDashboard,
  FileText,
  Database,
  ClipboardCheck,
  BarChart3,
  Download,
  BrainCircuit,
  History,
  Settings,
  Activity,
  QrCode,
  type LucideIcon
} from "lucide-react";
import { ROLES } from "@shared/roles";

export interface NavigationItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  children?: {
    id: string;
    href: string;
    label: string;
    icon: LucideIcon;
    roles?: string[];
  }[];
}

export const navigationRegistry: NavigationItem[] = [
  {
    id: "home",
    href: "/home",
    label: "الصفحة الرئيسية",
    icon: Home,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.TECHNICIAN]
  },
  {
    id: "verification",
    href: "/verification",
    label: "بوابة التحقق بالسيريال",
    icon: QrCode,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR]
  },
  {
    id: "courier",
    href: "/courier",
    label: "التوصيل والعمليات الميدانية",
    icon: Truck,
    roles: [ROLES.ADMIN],
    children: [
      {
        id: "courier-dashboard",
        href: "/courier",
        label: "لوحة التحكم",
        icon: LayoutDashboard,
        roles: [ROLES.ADMIN]
      },
      {
        id: "courier-ai-monitor",
        href: "/courier/ai-monitor",
        label: "مراقبة الذكاء الاصطناعي",
        icon: BrainCircuit,
        roles: [ROLES.ADMIN]
      },
      {
        id: "courier-observability",
        href: "/courier/observability",
        label: "مراقبة النظام والتتبع",
        icon: Activity,
        roles: [ROLES.ADMIN]
      },
      {
        id: "courier-audit-log",
        href: "/courier/audit-log",
        label: "سجل التدقيق",
        icon: History,
        roles: [ROLES.ADMIN]
      },
      {
        id: "courier-settings",
        href: "/courier/settings",
        label: "الإعدادات",
        icon: Settings,
        roles: [ROLES.ADMIN]
      }
    ]
  },
  {
    id: "inventory",
    href: "/admin-inventory-overview",
    label: "إدارة المخزون",
    icon: Boxes,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR]
  },
  {
    id: "my-inventory",
    href: "/my-fixed-inventory",
    label: "مخزوني الشخصي",
    icon: Boxes,
    roles: [ROLES.TECHNICIAN]
  },
  {
    id: "products",
    href: "/products-management",
    label: "إدارة المنتجات",
    icon: Shapes,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.TECHNICIAN]
  },
  {
    id: "search",
    href: "/operations-search",
    label: "البحث والاستعلام",
    icon: Search,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.TECHNICIAN]
  },
  {
    id: "operations",
    href: "/operations",
    label: "العمليات التشغيلية",
    icon: ClipboardList,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR]
  },
  {
    id: "warehouses",
    href: "/warehouses",
    label: "إدارة المستودعات",
    icon: Warehouse,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR]
  },
  {
    id: "withdrawn",
    href: "/withdrawn-devices",
    label: "الأصناف المرتجعة",
    icon: Undo2,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR]
  },
  {
    id: "accounting",
    href: "/accounting",
    label: "المحاسبة والمالية",
    icon: Calculator,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR]
  },
  {
    id: "logs",
    href: "/system-logs",
    label: "سجل النظام والرقابة",
    icon: ScrollText,
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR]
  },
  {
    id: "backup",
    href: "/backup",
    label: "النسخ الاحتياطية",
    icon: ShieldCheck,
    roles: [ROLES.ADMIN]
  },
  {
    id: "item-types",
    href: "/item-types",
    label: "إدارة أنواع الأصناف",
    icon: Shapes,
    roles: [ROLES.ADMIN]
  }
];

/**
 * Filter the registry to retrieve items authorized for the user's role
 */
export function getAuthorizedNavigation(userRole: string): NavigationItem[] {
  return navigationRegistry.filter(item => item.roles.includes(userRole));
}
