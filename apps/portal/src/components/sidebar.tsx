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
  const { language, setLanguage, t } = useLanguage();
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
        title: "تم تسجيل الخروج بنجاح",
        description: "شكراً لك على استخدام النظام",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الخروج",
        description: "حدث خطأ غير متوقع",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleQuickWithdraw = () => {
    if (!inventory || inventory.length === 0) {
      toast({
        title: "لا توجد أصناف في المخزون",
        description: "يجب إضافة أصناف أولاً قبل السحب",
        variant: "destructive",
      });
      return;
    }
    
    const availableItems = inventory.filter(item => item.quantity > 0);
    if (availableItems.length === 0) {
      toast({
        title: "جميع الأصناف نافدة",
        description: `يوجد ${inventory.length} صنف ولكن جميعها بكمية صفر`,
        variant: "destructive",
      });
      return;
    }
    
    setShowWithdrawModal(true);
  };
  
  const handleGenerateReport = () => {
    if (!inventory || inventory.length === 0) {
      toast({
        title: "لا يمكن إنشاء التقرير",
        description: "لا توجد أصناف في المخزون لإنشاء تقرير",
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
تقرير المخزون - ${new Date().toLocaleDateString('ar-SA')}

إجمالي الأصناف: ${totalItems}
إجمالي الكميات: ${totalQuantity}
أصناف منخفضة المخزون: ${lowStockCount}
أصناف نافدة: ${outOfStockCount}

تفاصيل الأصناف:
${inventory.map(item => 
  `- ${item.name}: ${item.quantity} ${item.unit} (${item.status === 'available' ? 'متوفر' : item.status === 'low' ? 'منخفض' : 'نافد'})`
).join('\n')}
    `.trim();

    // Create and download the report
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_المخزون_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "تم إنشاء التقرير",
      description: "تم تحميل تقرير المخزون بنجاح",
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
                onClick={() => setLanguage('ar')}
                data-testid="button-lang-ar"
                className="text-xs"
              >
                {t('arabic')}
              </Button>
              <Button
                variant={language === 'en' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLanguage('en')}
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
              <span>سجل العمليات</span>
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
                <span className="text-[#18B2B0]">إدارة الأصناف</span>
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
              <span>الأجهزة المسحوبة</span>
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
                  <span>مخزوني الثابت</span>
                </Button>
              </Link>

              <Link href="/my-moving-inventory">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-my-moving-inventory"
                >
                  <TruckIcon className="h-4 w-4" />
                  <span>مخزوني المتحرك</span>
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
                  <span>المخزون الثابت</span>
                </Button>
              </Link>
              
              <Link href="/admin">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-admin-panel"
                >
                  <Settings className="h-4 w-4" />
                  <span>لوحة الإدارة</span>
                </Button>
              </Link>
              
              <Link href="/backup">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-backup-management"
                >
                  <Database className="h-4 w-4" />
                  <span>النسخ الاحتياطية</span>
                </Button>
              </Link>
              
              <Link href="/item-types">
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse"
                  data-testid="button-item-types"
                >
                  <Package className="h-4 w-4" />
                  <span>إدارة الأصناف</span>
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">العمليات الأخيرة</CardTitle>
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
              لا توجد عمليات حديثة
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
                          {transaction.type === 'withdraw' ? 'سحب' : 'إضافة'} {item?.name || 'صنف محذوف'}
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
            <span>تنبيهات المخزون</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertItems.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              لا توجد تنبيهات حالياً
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
                      ? 'نافد تماماً - يحتاج تجديد فوري'
                      : `الكمية: ${item.quantity} ${item.unit} (أقل من الحد الأدنى)`
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
            <DialogTitle>تفاصيل العملية</DialogTitle>
            <DialogDescription>
              عرض كامل لبيانات العملية المختارة من سجل العمليات الأخيرة
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">نوع العملية</span>
                <Badge variant={selectedTransaction.type === 'withdraw' ? 'destructive' : 'default'}>
                  {selectedTransaction.type === 'withdraw' ? 'سحب' : 'إضافة'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">الصنف</span>
                  <span className="font-medium text-right">{selectedTransactionItem?.name || 'صنف محذوف'}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">الكمية</span>
                  <span className="font-medium">
                    {selectedTransaction.type === 'withdraw' ? '-' : '+'}{selectedTransaction.quantity}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">السبب</span>
                  <span className="font-medium text-right">{selectedTransaction.reason || 'غير محدد'}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">رقم العملية</span>
                  <span className="font-medium text-xs">{selectedTransaction.id}</span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">وقت التنفيذ</span>
                  <span className="font-medium">{selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleString('ar-SA') : 'غير متوفر'}</span>
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
