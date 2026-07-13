import { useTranslation } from "@/lib/language";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Minus, Edit, Trash2, FileSpreadsheet } from "lucide-react";
import { InventoryItemWithStatus } from "@shared/schema";
import AddItemModal from "./add-item-modal";
import WithdrawalModal from "./withdrawal-modal";
import AddStockModal from "./add-stock-modal";
import EditItemModal from "./edit-item-modal";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { exportInventoryToExcel } from "@/lib/exportToExcel";

interface InventoryTableProps {
  inventory?: InventoryItemWithStatus[];
  isLoading: boolean;
}

export default function InventoryTable({ inventory, isLoading }: InventoryTableProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemWithStatus | null>(null);

  const filteredInventory = inventory?.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge className="bg-success/10 text-success">{t('inventory.available')}</Badge>;
      case "low":
        return <Badge className="bg-warning/10 text-warning">{t('inventory.low')}</Badge>;
      case "out":
        return <Badge className="bg-destructive/10 text-destructive">{t('inventory.item_6365')}</Badge>;
      default:
        return <Badge variant="secondary">{t('inventory.item_11173')}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "devices":
        return "📱";
      case "sim":
        return "📶";
      case "papers":
        return "📄";
      default:
        return "📦";
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "devices":
        return t('inventory.devices_1');
      case "sim":
        return t('inventory.sims_1');
      case "papers":
        return t('inventory.item_7941');
      default:
        return t('inventory.item_11173');
    }
  };

  // Mutations
  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/transactions"),
      });
      setShowDeleteDialog(false);
      setSelectedItem(null);
      toast({ title: t('inventory.completed_delete_successfully') });
    },
    onError: () => {
      toast({ title: t('inventory.fail_delete'), variant: "destructive" });
    },
  });

  // Handlers
  const handleWithdraw = (item: InventoryItemWithStatus) => {
    setSelectedItem(item);
    setShowWithdrawModal(true);
  };

  const handleAddStock = (item: InventoryItemWithStatus) => {
    setSelectedItem(item);
    setShowAddStockModal(true);
  };

  const handleEdit = (item: InventoryItemWithStatus) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const handleDelete = (item: InventoryItemWithStatus) => {
    setSelectedItem(item);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (selectedItem) {
      deleteItemMutation.mutate(selectedItem.id);
    }
  };

  const handleExport = () => {
    if (inventory && inventory.length > 0) {
      exportInventoryToExcel({ inventory });
      toast({ title: t('inventory.completed_export_report_succes'), description: t('inventory.completed_save_file') });
    } else {
      toast({ title: t('inventory.no_data_5'), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex space-x-3 space-x-reverse">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">{t('inventory.inventory_5')}</h2>
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="relative">
                <Input
                  type="text"
                  placeholder={t('inventory.search_inventory')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                  data-testid="input-search"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              </div>
              
              <Button
                onClick={handleExport}
                variant="outline"
                className="flex items-center space-x-2 space-x-reverse bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 border-emerald-200 dark:border-emerald-800"
                data-testid="button-export-excel"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300">{t('inventory.export_report')}</span>
              </Button>
              
              <Button
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-2 space-x-reverse"
                data-testid="button-add-item"
              >
                <Plus className="h-4 w-4" />
                <span>{t('inventory.add_1')}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {!filteredInventory || filteredInventory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? t('inventory.no_results_1') : t('inventory.no_inventory')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-right p-4 font-medium text-foreground">{t('inventory.name')}</th>
                    <th className="text-right p-4 font-medium text-foreground">{t('inventory.type_1')}</th>
                    <th className="text-right p-4 font-medium text-foreground">{t('inventory.quantity_1')}</th>
                    <th className="text-right p-4 font-medium text-foreground">{t('inventory.unit_1')}</th>
                    <th className="text-right p-4 font-medium text-foreground">{t('inventory.name_technician')}</th>
                    <th className="text-right p-4 font-medium text-foreground">{t('inventory.city')}</th>
                    <th className="text-right p-4 font-medium text-foreground">{t('inventory.status')}</th>
                    <th className="text-right p-4 font-medium text-foreground">{t('inventory.item_14214')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-accent/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <div className="bg-primary/10 p-2 rounded-lg text-xl">
                            {getTypeIcon(item.type)}
                          </div>
                          <span className="font-medium text-foreground" data-testid={`text-item-name-${item.id}`}>
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground" data-testid={`text-item-type-${item.id}`}>
                        {getTypeName(item.type)}
                      </td>
                      <td className="p-4">
                        <span 
                          className={`font-semibold ${
                            item.status === 'out' ? 'text-destructive' : 
                            item.status === 'low' ? 'text-warning' : 'text-foreground'
                          }`}
                          data-testid={`text-item-quantity-${item.id}`}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground" data-testid={`text-item-unit-${item.id}`}>
                        {item.unit}
                      </td>
                      <td className="p-4 text-muted-foreground" data-testid={`text-technician-${item.id}`}>
                        {item.technicianName || '-'}
                      </td>
                      <td className="p-4 text-muted-foreground" data-testid={`text-city-${item.id}`}>
                        {item.city || '-'}
                      </td>
                      <td className="p-4" data-testid={`text-item-status-${item.id}`}>
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleWithdraw(item)}
                            disabled={item.quantity === 0}
                            className="hover:bg-destructive/10"
                            title={t('inventory.withdraw')}
                            data-testid={`button-withdraw-${item.id}`}
                          >
                            <Minus className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAddStock(item)}
                            className="hover:bg-success/10"
                            title={t('inventory.add_stock')}
                            data-testid={`button-add-stock-${item.id}`}
                          >
                            <Plus className="h-4 w-4 text-success" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            className="hover:bg-accent"
                            title={t('inventory.edit')}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            className="hover:bg-destructive/10"
                            title={t('inventory.delete')}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddItemModal open={showAddModal} onOpenChange={setShowAddModal} />
      <WithdrawalModal 
        open={showWithdrawModal} 
        onOpenChange={setShowWithdrawModal}
        selectedItem={selectedItem}
        inventory={inventory}
      />
      <AddStockModal 
        open={showAddStockModal} 
        onOpenChange={setShowAddStockModal}
        selectedItem={selectedItem}
      />
      <EditItemModal 
        open={showEditModal} 
        onOpenChange={setShowEditModal}
        selectedItem={selectedItem}
      />
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('inventory.item_28757')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('inventory.delete_item_confirm', { name: selectedItem?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse">
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteItemMutation.isPending}
            >
              {deleteItemMutation.isPending ? t('inventory.delete_1') : t('inventory.item_12725')}
            </AlertDialogAction>
            <AlertDialogCancel>{t('inventory.cancel_1')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

