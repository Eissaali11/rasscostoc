import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LanguageProvider, useTranslation } from "@/lib/language";
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
    titleKey: string,
  ) => () => (
    <NeoShellLayout titleKey={titleKey}>
      <Component />
    </NeoShellLayout>
  );
  
  // Show appropriate routes based on user role
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/home" />} />
      <Route path="/devices" component={() => <Redirect to="/home" />} />
      <Route path="/stock" component={LandingPage} />
      <Route path="/home" component={withShell(Dashboard, "titles.home")} />
      <Route path="/transactions" component={withShell(TransactionHistoryPage, "titles.transactions")} />
      <Route path="/operations-search" component={withShell(OperationsSearchPage, "titles.operations_search")} />
      <Route path="/withdrawn-devices" component={withShell(WithdrawnDevicesPage, "titles.withdrawn_devices")} />
      <Route path="/withdrawn-devices/management" component={withShell(WithdrawnDevicesManagementPage, "titles.withdrawn_management")} />
      <Route path="/withdrawn-devices/all" component={withShell(WithdrawnDevicesAllPage, "titles.withdrawn_all")} />
      <Route path="/withdrawn-devices/:id" component={withShell(WithdrawnDeviceDetailsPage, "titles.withdrawn_details")} />
      <Route path="/received-devices/submit" component={withShell(ReceivedDevicesSubmit, "titles.received_submit")} />
      <Route path="/received-devices/review" component={withShell(ReceivedDevicesReview, "titles.received_review")} />
      <Route path="/received-devices/:id" component={withShell(ReceivedDeviceDetails, "titles.received_details")} />
      <Route path="/notifications" component={withShell(NotificationsPage, "titles.notifications")} />
      <Route path="/products-management" component={withShell(ProductsManagementPage, "titles.products")} />
      <Route path="/products-management/:id/details" component={withShell(ProductDetailsPage, "titles.product_details")} />
      <Route path="/products-management/:id/smart-add" component={withShell(ProductSmartAddPage, "titles.product_smart_add")} />
      <Route path="/profile" component={withShell(ProfilePage, "titles.profile")} />
      <Route path="/technician-details/:id" component={withShell(TechnicianDetailsPage, "titles.technician_details")} />
      <Route path="/technician-details/:technicianId/item/:itemTypeId" component={withShell(TechnicianItemDetailsPage, "titles.product_details")} />
      <Route path="/employee-detailed-profile-template" component={withShell(EmployeeDetailedProfileTemplatePage, "titles.employee_profile")} />
      <Route path="/employee-edit-profile-template" component={withShell(EmployeeEditProfileTemplatePage, "titles.employee_edit")} />
      <Route path="/system-logs" component={withShell(SystemLogsPage, "titles.system_logs")} />
      {user?.role === "technician" && (
        <>
          <Route path="/my-fixed-inventory" component={withShell(MyFixedInventory, "titles.my_fixed")} />
          <Route path="/my-moving-inventory" component={withShell(MyMovingInventory, "titles.my_moving")} />
        </>
      )}
      {hasRoleOrAbove(user?.role || '', ROLES.SUPERVISOR) && (
        <>
          <Route path="/verification" component={withShell(VerificationPage, "titles.verification")} />
          <Route path="/admin-inventory-overview" component={withShell(AdminInventoryOverview, "titles.admin_inventory")} />
          <Route path="/warehouses" component={withShell(WarehousesPage, "titles.warehouses")} />
          <Route path="/warehouses/:id" component={withShell(WarehouseDetailsPage, "titles.warehouse_details")} />
          <Route path="/transfer-details/:id" component={withShell(TransferDetailsPage, "titles.transfer_details")} />
          <Route path="/operations" component={withShell(OperationsPage, "titles.operations")} />
          <Route path="/operation-details/:groupId" component={withShell(OperationDetailsPage, "titles.operation_details")} />
        </>
      )}
      <Route path="/accounting" component={withShell(AccountingDashboardPage, "titles.accounting")} />

      {user?.role === "admin" && (
        <>
          {/* Courier Module Routes */}
          <Route path="/courier" component={withShell(CourierDashboardPage, "titles.courier")} />
          <Route path="/courier/raw-data" component={withShell(CourierRawDataPage, "titles.courier_raw")} />
          <Route path="/courier/requests" component={withShell(CourierRequestsPage, "titles.courier_requests")} />
          <Route path="/courier/requests/:id" component={withShell(CourierRequestDetailPage, "titles.courier_request_detail")} />
          <Route path="/courier/pdf" component={withShell(CourierPdfUploadPage, "titles.courier_pdf")} />
          <Route path="/courier/pdf/:id" component={withShell(CourierPdfReviewPage, "titles.courier_pdf_review")} />
          <Route path="/courier/reports" component={withShell(CourierReportsPage, "titles.courier_reports")} />
          <Route path="/courier/export" component={withShell(CourierExportPage, "titles.courier_export")} />
          <Route path="/courier/ai-monitor" component={withShell(CourierAiMonitorPage, "titles.courier_ai")} />
          <Route path="/courier/audit-log" component={withShell(CourierAuditLogPage, "titles.courier_audit")} />
          <Route path="/courier/settings" component={withShell(CourierSettingsPage, "titles.courier_settings")} />
          <Route path="/courier/observability" component={withShell(CourierObservabilityPage, "titles.courier_observability")} />
        </>
      )}
      {user?.role === "admin" && (
        <>
          <Route path="/admin" component={withShell(AdminPage, "titles.admin")} />
          <Route path="/users" component={withShell(UsersPage, "titles.users")} />
          <Route path="/fixed-inventory" component={withShell(FixedInventoryDashboard, "titles.fixed_inventory")} />
          <Route path="/backup" component={withShell(BackupManagementPage, "titles.backup")} />
          <Route path="/item-types" component={withShell(ItemTypesManagement, "titles.item_types")} />
          <Route path="/item-types/:id/details" component={withShell(ItemTypeDetailsPage, "titles.item_type_details")} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t, dir } = useTranslation();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={dir}>
        <div className="flex items-center gap-2 text-rassco-text font-semibold">
          <Loader2 className="h-6 w-6 animate-spin text-rassco" />
          <span>{t("messages.loading")}</span>
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

