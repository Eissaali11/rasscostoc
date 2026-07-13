import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Minus, Plus, FileText, TriangleAlert, Settings, LogOut, User, Shield, History, Smartphone, Package, TruckIcon, Home, Languages, Activity, Database } from "lucide-react";
import { InventoryItemWithStatus, Transaction } from "@shared/schema";
import AddItemModal from "./add-item-modal";
import WithdrawalModal from "./withdrawal-modal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";

interface SidebarProps {
  inventory?: InventoryItemWithStatus[];
}

export default function Sidebar({ inventory }: SidebarProps) {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions?recent=true&limit=10"],
  });

  const lowStockItems = inventory?.filter(item => item.status === 'low') || [];
  const outOfStockItems = inventory?.filter(item => item.status === 'out') || [];
  const alertItems = [...lowStockItems, ...outOfStockItems];
  const selectedTransactionItem = selectedTransaction
    ? inventory?.find(item => item.id === selectedTransaction.itemId)
    : undefined;
  
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast({
        title: t('common.completed_successfully_3'),
        description: t('common.system_5'),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('common.error_3'),
        description: t('common.error_2'),
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleQuickWithdraw = () => {
    if (!inventory || inventory.length === 0) {
      toast({
        title: t('common.no_inventory'),
        description: t('common.add_withdraw'),
        variant: "destructive",
      });
      return;
    }
    
    const availableItems = inventory.filter(item => item.quantity > 0);
    if (availableItems.length === 0) {
      toast({
        title: t('common.item_25515'),
        description: t('common.item_41074', { var_0: inventory.length }),
        variant: "destructive",
      });
      return;
    }
    
    setShowWithdrawModal(true);
  };
  
  const handleGenerateReport = () => {
    if (!inventory || inventory.length === 0) {
      toast({
        title: t('common.no_report'),
        description: t('common.no_inventory_report'),
        variant: "destructive",
      });
      return;
    }

    // Create a simple report content
    const totalItems = inventory.length;
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockCount = inventory.filter(item => item.status === 'low').length;
    const outOfStockCount = inventory.filter(item => item.status === 'out').length;
    
    const reportContent = `
${t('inventory.inventory_report_dated', { date: new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') })}

${t('common.total_items_count', { count: totalItems })}
${t('common.total_qty_count', { count: totalQuantity })}
${t('common.low_stock_count', { count: lowStockCount })}
${t('common.out_stock_count', { count: outOfStockCount })}

${t('common.item_details_header')}
${inventory.map(item => 
  t('common.item_4190', { var_0: item.name, var_1: item.quantity, var_2: item.unit, var_3: item.status === 'available' ? t('common.item_7977_1') : item.status === 'low' ? t('common.item_7984') : t('common.item_6365') })
).join('\n')}
    `.trim();

    // Create and download the report
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('dashboard.report_filename')}${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: t('common.completed_report'),
      description: t('common.completed_loading_report_inven'),
    });
  };

  return (
    <div className="space-y-6">
      {/* User Info Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="p-2 bg-primary/10 rounded-full">
              {user?.role === 'admin' ? (
                <Shield className="h-5 w-5 text-primary" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {user?.role === 'admin' ? t('users.admin') : user?.role === 'supervisor' ? t('users.supervisor') : t('users.technician')}
              </p>
            </div>
            <Button 
              data-testid="button-logout"
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <Link href="/home">
            <Button
              variant="default"
              className="w-full mt-4 flex items-center justify-center space-x-2 space-x-reverse"
              data-testid="button-home"
            >
              <Home className="h-4 w-4" />
              <span>{t('sidebar.home')}</span>
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Language Switcher */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('language')}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={language === 'ar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => changeLanguage('ar')}
                data-testid="button-lang-ar"
                className="text-xs"
              >
                {t('arabic')}
              </Button>
              <Button
                variant={language === 'en' ? 'default' : 'outline'}
                size="sm"
                onClick={() => changeLanguage('en')}
                data-testid="button-lang-en"
                className="text-xs"
              >
                {t('english')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{t('sidebar.quick_actions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="destructive"
            className="w-full flex items-center justify-center space-x-2 space-x-reverse"
            onClick={handleQuickWithdraw}
            data-testid="button-quick-withdraw"
          >
            <Minus className="h-4 w-4" />
            <span>{t('actions.quick_withdraw')}</span>
          </Button>
          
          <Button
            className="w-full bg-success hover:bg-success/90 text-white flex items-center justify-center space-x-2 space-x-reverse"
            onClick={() => setShowAddModal(true)}
            data-testid="button-quick-add-stock"
          >
            <Plus className="h-4 w-4" />
            <span>{t('actions.quick_add')}</span>
          </Button>
          
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center space-x-2 space-x-reverse"
            onClick={handleGenerateReport}
            data-testid="button-generate-report"
          >
            <FileText className="h-4 w-4" />
            <span>{t('actions.generate_report')}</span>
          </Button>
          
          <Link href="/transactions">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center space-x-2 space-x-reverse"
              data-testid="button-transaction-history"
            >
              <History className="h-4 w-4" />
              <span>{t('actions.view_transactions')}</span>
            </Button>
          </Link>
          
          <Link href="/system-logs">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center space-x-2 space-x-reverse"
              data-testid="button-system-logs"
            >
              <Activity className="h-4 w-4" />
              <span>{t('common.log_operations')}</span>
            </Button>
          </Link>
          
          {user?.role === 'admin' && (
            <Link href="/item-types">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center space-x-2 space-x-reverse bg-gradient-to-r from-[#18B2B0]/20 to-[#1a1a2e] border-[#18B2B0]/50"
                data-testid="button-item-types-main"
              >
                <Package className="h-4 w-4 text-[#18B2B0]" />
                <span className="text-[#18B2B0]">{t('common.management_1')}</span>
              </Button>
            </Link>
          )}
          
          <Link href="/withdrawn-devices">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center space-x-2 space-x-reverse"
              data-testid="button-withdrawn-devices"
            >
              <Smartphone className="h-4 w-4" />
              <span>{t('common.devices_8')}</span>
            </Button>
          </Link>
          
          {user?.role === 'technician' && (
            <>
              <Link href="/my-fixed-inventory">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-my-fixed-inventory"
                >
                  <Package className="h-4 w-4" />
                  <span>{t('common.item_19116')}</span>
                </Button>
              </Link>

              <Link href="/my-moving-inventory">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-my-moving-inventory"
                >
                  <TruckIcon className="h-4 w-4" />
                  <span>{t('common.item_20760')}</span>
                </Button>
              </Link>
            </>
          )}
          
          {user?.role === 'admin' && (
            <>
              <Link href="/fixed-inventory">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-fixed-inventory"
                >
                  <Package className="h-4 w-4" />
                  <span>{t('common.inventory_1')}</span>
                </Button>
              </Link>
              
              <Link href="/admin">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-admin-panel"
                >
                  <Settings className="h-4 w-4" />
                  <span>{t('common.dashboard_management')}</span>
                </Button>
              </Link>
              
              <Link href="/backup">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-backup-management"
                >
                  <Database className="h-4 w-4" />
                  <span>{t('common.backup_backup_2')}</span>
                </Button>
              </Link>
              
              <Link href="/item-types">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-item-types"
                >
                  <Package className="h-4 w-4" />
                  <span>{t('common.management_1')}</span>
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{t('common.operations_4')}</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 bg-accent/30 rounded-lg">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : !transactions || !Array.isArray(transactions) || transactions.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {t('common.no_12')}
            </div>
          ) : (
            <div className="space-y-3">
              {(Array.isArray(transactions) ? transactions : []).slice(0, 3).map((transaction) => {
                const item = inventory?.find(i => i.id === transaction.itemId);
                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => setSelectedTransaction(transaction)}
                    className="w-full p-3 bg-accent/30 rounded-lg text-right transition-colors hover:bg-accent/50"
                    data-testid={`transaction-${transaction.id}`}
                  >
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <div className={`${
                        transaction.type === 'withdraw' 
                          ? 'bg-destructive/10 text-destructive' 
                          : 'bg-success/10 text-success'
                      } p-2 rounded-full`}>
                        {transaction.type === 'withdraw' ? (
                          <Minus className="h-3 w-3" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {transaction.type === 'withdraw' ? t('common.withdraw') : t('common.add')} {item?.name || t('common.item_12807')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.createdAt!).toLocaleString('ar')}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${
                        transaction.type === 'withdraw' ? 'text-destructive' : 'text-success'
                      }`}>
                        {transaction.type === 'withdraw' ? '-' : '+'}{transaction.quantity}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low Stock Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center space-x-2 space-x-reverse">
            <TriangleAlert className="h-5 w-5 text-warning" />
            <span>{t('common.inventory_10')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertItems.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {t('common.no_13')}
            </div>
          ) : (
            <div className="space-y-2">
              {alertItems.map((item) => (
                <div
                  key={item.id}
                  className={`${
                    item.status === 'out' 
                      ? 'bg-destructive/10 border-destructive/20' 
                      : 'bg-warning/10 border-warning/20'
                  } border rounded-lg p-3`}
                  data-testid={`alert-${item.id}`}
                >
                  <p className={`text-sm font-medium ${
                    item.status === 'out' ? 'text-destructive' : 'text-warning'
                  }`}>
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.status === 'out' 
                      ? t('common.item_38381')
                      : t('common.quantity_15', { var_0: item.quantity, var_1: item.unit })
                    }
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Modals */}
      <Dialog open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{t('common.details_operation_1')}</DialogTitle>
            <DialogDescription>
              {t('common.view_operation_log_operations')}
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('common.type_operation')}</span>
                <Badge variant={selectedTransaction.type === 'withdraw' ? 'destructive' : 'default'}>
                  {selectedTransaction.type === 'withdraw' ? t('common.withdraw') : t('common.add')}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t('common.item_7975')}</span>
                  <span className="font-medium text-right">{selectedTransactionItem?.name || t('common.item_12807')}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t('common.quantity_3')}</span>
                  <span className="font-medium">
                    {selectedTransaction.type === 'withdraw' ? '-' : '+'}{selectedTransaction.quantity}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t('common.reason')}</span>
                  <span className="font-medium text-right">{selectedTransaction.reason || t('common.item_11173')}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t('common.number_operation')}</span>
                  <span className="font-medium text-xs">{selectedTransaction.id}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t('common.time_2')}</span>
                  <span className="font-medium">{selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleString('ar-SA') : t('common.item_12798')}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AddItemModal open={showAddModal} onOpenChange={setShowAddModal} />
      <WithdrawalModal 
        open={showWithdrawModal} 
        onOpenChange={setShowWithdrawModal}
        selectedItem={null}
        inventory={inventory}
      />
    </div>
  );
}
