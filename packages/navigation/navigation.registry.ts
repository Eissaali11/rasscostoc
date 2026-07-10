import { NavigationItem } from "./navigation.types";

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: "dashboard",
    href: "/",
    label: "الصفحة الرئيسية",
    icon: "LayoutDashboard",
    roles: ["admin", "supervisor", "technician"],
  },
  {
    id: "inventory",
    href: "/inventory",
    label: "المخزون الثابت",
    icon: "Package",
    roles: ["admin", "technician"],
  },
  {
    id: "moving-inventory",
    href: "/moving-inventory",
    label: "المخزون المتحرك",
    icon: "Truck",
    roles: ["admin", "technician"],
  },
  {
    id: "users",
    href: "/users",
    label: "المستخدمين",
    icon: "Users",
    roles: ["admin"],
  },
];
