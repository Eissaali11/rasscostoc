export const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  TECHNICIAN: 'technician',
  VIEWER: 'viewer',
  COURIER_SUPERVISOR: 'courier_supervisor',
  WAREHOUSE: 'warehouse',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS_AR = {
  [ROLES.ADMIN]: 'مدير النظام',
  [ROLES.SUPERVISOR]: 'مشرف عام',
  [ROLES.TECHNICIAN]: 'مندوب / فني',
  [ROLES.VIEWER]: 'مراقب / مشاهد',
  [ROLES.COURIER_SUPERVISOR]: 'مشرف عمليات التوصيل',
  [ROLES.WAREHOUSE]: 'أمين مستودع',
} as const;

export const ROLE_ORDER = {
  [ROLES.ADMIN]: 4,
  [ROLES.SUPERVISOR]: 3,
  [ROLES.COURIER_SUPERVISOR]: 3,
  [ROLES.WAREHOUSE]: 2,
  [ROLES.TECHNICIAN]: 1,
  [ROLES.VIEWER]: 1,
} as const;

export function hasRoleOrAbove(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_ORDER[userRole as UserRole] || 0;
  const requiredLevel = ROLE_ORDER[requiredRole as UserRole] || 0;
  return userLevel >= requiredLevel;
}

export function canManageUsers(userRole: string): boolean {
  return userRole === ROLES.ADMIN;
}

export function canViewReports(userRole: string): boolean {
  return hasRoleOrAbove(userRole, ROLES.SUPERVISOR);
}

export function canManageWarehouses(userRole: string): boolean {
  return hasRoleOrAbove(userRole, ROLES.SUPERVISOR);
}

export function isSupervisor(userRole: string): boolean {
  return userRole === ROLES.SUPERVISOR || userRole === ROLES.COURIER_SUPERVISOR;
}

export function isAdmin(userRole: string): boolean {
  return userRole === ROLES.ADMIN;
}

export function isTechnician(userRole: string): boolean {
  return userRole === ROLES.TECHNICIAN;
}

export function getRoleLabel(role: UserRole | string): string {
  return ROLE_LABELS_AR[role as UserRole] || 'غير معروف';
}

export const ROLE_BADGE_VARIANTS = {
  [ROLES.ADMIN]: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  [ROLES.SUPERVISOR]: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  [ROLES.COURIER_SUPERVISOR]: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
  [ROLES.WAREHOUSE]: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  [ROLES.TECHNICIAN]: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  [ROLES.VIEWER]: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800',
} as const;


