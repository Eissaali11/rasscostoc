import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LanguageProvider } from "@/lib/language";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import AdminPage from "@/pages/admin";
import { TransactionHistoryPage } from "@/pages/transaction-history";
import WithdrawnDevicesPage from "./pages/withdrawn-devices";
import WithdrawnDevicesManagementPage from "./pages/withdrawn-devices-management";
import WithdrawnDevicesAllPage from "./pages/withdrawn-devices-all";
import WithdrawnDeviceDetailsPage from "@/pages/WithdrawnDeviceDetails";
import ReceivedDevicesSubmit from "@/pages/ReceivedDevicesSubmit";
import ReceivedDevicesReview from "@/pages/ReceivedDevicesReview";
import ReceivedDeviceDetails from "./pages/ReceivedDeviceDetails";
import UsersPage from "@/pages/users";
import FixedInventoryDashboard from "@/pages/fixed-inventory-dashboard";
import MyFixedInventory from "@/pages/my-fixed-inventory";
import MyMovingInventory from "@/pages/my-moving-inventory";
import AdminInventoryOverview from "@/pages/admin-inventory-overview";
import WarehousesPage from "@/pages/warehouses";
import WarehouseDetailsPage from "@/pages/warehouse-details";
import TransferDetailsPage from "@/pages/transfer-details";
import OperationsPage from "@/pages/operations";
import OperationDetailsPage from "@/pages/operation-details";
import OperationsSearchPage from "@/pages/operations-search";
import NotificationsPage from "@/pages/notifications";
import ProductsManagementPage from "./pages/products-management";
import ProductDetailsPage from "./pages/product-details";
import ProductSmartAddPage from "@/pages/product-smart-add";
import ProfilePage from "@/pages/profile";
import TechnicianDetailsPage from "@/pages/technician-details";
import VerificationPage from "@/pages/verification";
import TechnicianItemDetailsPage from "@/pages/technician-item-details";
import EmployeeDetailedProfileTemplatePage from "@/pages/employee-detailed-profile-template";
import EmployeeEditProfileTemplatePage from "@/pages/employee-edit-profile-template";
import SystemLogsPage from "@/pages/system-logs";
import BackupManagementPage from "@/pages/backup-management";
import ItemTypesManagement from "@/pages/item-types-management";
import ItemTypeDetailsPage from "@/pages/item-type-details";
import AccountingDashboardPage from "@/pages/accounting-dashboard";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import { NeoShellLayout } from "@/components/layout/neo-shell-layout";
import { Loader2 } from "lucide-react";
import { hasRoleOrAbove, ROLES } from "@shared/roles";
import { useEffect, type ComponentType } from "react";
import CourierDashboardPage from "@/pages/courier/courier-dashboard";
import CourierRawDataPage from "@/pages/courier/courier-raw-data";
import CourierRequestsPage from "@/pages/courier/courier-requests";
import CourierRequestDetailPage from "@/pages/courier/courier-request-detail";
import CourierPdfUploadPage from "@/pages/courier/courier-pdf-upload";
import CourierPdfReviewPage from "@/pages/courier/courier-pdf-review";
import CourierReportsPage from "@/pages/courier/courier-reports";
import CourierExportPage from "@/pages/courier/courier-export";
import CourierAiMonitorPage from "@/pages/courier/courier-ai-monitor";
import CourierAuditLogPage from "@/pages/courier/courier-audit-log";
import CourierSettingsPage from "@/pages/courier/courier-settings";
import CourierObservabilityPage from "@/pages/courier/courier-observability";

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  
  return null;
}

function AuthenticatedRouter() {
  const { user } = useAuth();

  const withShell = (
    Component: ComponentType,
    title: string,
  ) => () => (
    <NeoShellLayout title={title}>
      <Component />
    </NeoShellLayout>
  );
  
  // Show appropriate routes based on user role
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/home" />} />
      <Route path="/devices" component={() => <Redirect to="/home" />} />
      <Route path="/stock" component={LandingPage} />
      <Route path="/home" component={withShell(Dashboard, "الصفحة الرئيسية")} />
      <Route path="/transactions" component={withShell(TransactionHistoryPage, "سجل الحركات")} />
      <Route path="/operations-search" component={withShell(OperationsSearchPage, "البحث في العمليات")} />
      <Route path="/withdrawn-devices" component={withShell(WithdrawnDevicesPage, "الأصناف المرتجعة")} />
      <Route path="/withdrawn-devices/management" component={withShell(WithdrawnDevicesManagementPage, "إدارة الأصناف المرتجعة")} />
      <Route path="/withdrawn-devices/all" component={withShell(WithdrawnDevicesAllPage, "سجل العمليات المرتجعة")} />
      <Route path="/withdrawn-devices/:id" component={withShell(WithdrawnDeviceDetailsPage, "تفاصيل الجهاز المرتجع")} />
      <Route path="/received-devices/submit" component={withShell(ReceivedDevicesSubmit, "إدخال أجهزة مستقبلة")} />
      <Route path="/received-devices/review" component={withShell(ReceivedDevicesReview, "مراجعة الأجهزة المستقبلة")} />
      <Route path="/received-devices/:id" component={withShell(ReceivedDeviceDetails, "تفاصيل الجهاز المستلم")} />
      <Route path="/notifications" component={withShell(NotificationsPage, "مركز التنبيهات الذكي")} />
      <Route path="/products-management" component={withShell(ProductsManagementPage, "إدارة المنتجات")} />
      <Route path="/products-management/:id/details" component={withShell(ProductDetailsPage, "تفاصيل المنتج")} />
      <Route path="/products-management/:id/smart-add" component={withShell(ProductSmartAddPage, "مركز المسح والتحقق الذكي")} />
      <Route path="/profile" component={withShell(ProfilePage, "الملف الشخصي")} />
      <Route path="/technician-details/:id" component={withShell(TechnicianDetailsPage, "تفاصيل عهدة المندوب")} />
      <Route path="/technician-details/:technicianId/item/:itemTypeId" component={withShell(TechnicianItemDetailsPage, "تفاصيل المنتج")} />
      <Route path="/employee-detailed-profile-template" component={withShell(EmployeeDetailedProfileTemplatePage, "الملف التفصيلي للموظف")} />
      <Route path="/employee-edit-profile-template" component={withShell(EmployeeEditProfileTemplatePage, "تعديل بيانات الموظف")} />
      <Route path="/system-logs" component={withShell(SystemLogsPage, "سجل النظام")} />
      {user?.role === "technician" && (
        <>
          <Route path="/my-fixed-inventory" component={withShell(MyFixedInventory, "المخزون الثابت")} />
          <Route path="/my-moving-inventory" component={withShell(MyMovingInventory, "المخزون المتحرك")} />
        </>
      )}
      {hasRoleOrAbove(user?.role || '', ROLES.SUPERVISOR) && (
        <>
          <Route path="/verification" component={withShell(VerificationPage, "بوابة التحقق من الرقم التسلسلي")} />
          <Route path="/admin-inventory-overview" component={withShell(AdminInventoryOverview, "لوحة مخزون المندوبين")} />
          <Route path="/warehouses" component={withShell(WarehousesPage, "إدارة المستودعات")} />
          <Route path="/warehouses/:id" component={withShell(WarehouseDetailsPage, "تفاصيل المستودع")} />
          <Route path="/transfer-details/:id" component={withShell(TransferDetailsPage, "تفاصيل التحويل")} />
          <Route path="/operations" component={withShell(OperationsPage, "لوحة العمليات")} />
          <Route path="/operation-details/:groupId" component={withShell(OperationDetailsPage, "تفاصيل العملية")} />
        </>
      )}
      <Route path="/accounting" component={withShell(AccountingDashboardPage, "قسم المحاسبة")} />

      {user?.role === "admin" && (
        <>
          {/* Courier Module Routes */}
          <Route path="/courier" component={withShell(CourierDashboardPage, "لوحة التحكم")} />
          <Route path="/courier/raw-data" component={withShell(CourierRawDataPage, "البيانات الخام")} />
          <Route path="/courier/requests" component={withShell(CourierRequestsPage, "التحقق")} />
          <Route path="/courier/requests/:id" component={withShell(CourierRequestDetailPage, "تفاصيل الطلب")} />
          <Route path="/courier/pdf" component={withShell(CourierPdfUploadPage, "تقارير PDF")} />
          <Route path="/courier/pdf/:id" component={withShell(CourierPdfReviewPage, "مراجعة تقرير PDF")} />
          <Route path="/courier/reports" component={withShell(CourierReportsPage, "التقارير")} />
          <Route path="/courier/export" component={withShell(CourierExportPage, "تصدير Excel")} />
          <Route path="/courier/ai-monitor" component={withShell(CourierAiMonitorPage, "مراقبة الذكاء الاصطناعي")} />
          <Route path="/courier/audit-log" component={withShell(CourierAuditLogPage, "سجل التدقيق")} />
          <Route path="/courier/settings" component={withShell(CourierSettingsPage, "الإعدادات")} />
          <Route path="/courier/observability" component={withShell(CourierObservabilityPage, "مراقبة النظام والتتبع")} />
        </>
      )}
      {user?.role === "admin" && (
        <>
          <Route path="/admin" component={withShell(AdminPage, "إدارة المستخدمين والمناطق")} />
          <Route path="/users" component={withShell(UsersPage, "إدارة المستخدمين")} />
          <Route path="/fixed-inventory" component={withShell(FixedInventoryDashboard, "المخزون الثابت للمندوبين")} />
          <Route path="/backup" component={withShell(BackupManagementPage, "إدارة النسخ الاحتياطية")} />
          <Route path="/item-types" component={withShell(ItemTypesManagement, "إدارة الأصناف")} />
          <Route path="/item-types/:id/details" component={withShell(ItemTypeDetailsPage, "تفاصيل الصنف")} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>جاري التحميل...</span>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={() => <Redirect to="/login" />} />
        <Route path="/stock" component={LandingPage} />
        <Route path="/login" component={Login} />
        <Route component={() => <Redirect to="/login" />} />
      </Switch>
    );
  }
  
  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppContent />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;

