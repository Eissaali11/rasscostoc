import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Warehouse, 
  Plus, 
  MapPin, 
  Package, 
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Download,
  Search,
  Edit
} from "lucide-react";
import CreateWarehouseModal from "@/components/create-warehouse-modal";
import EditWarehouseModal from "@/components/edit-warehouse-modal";
import { exportWarehousesToExcel } from "@/lib/exportToExcel";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useActiveItemTypes, getInventoryValueForItemType, legacyFieldMapping, InventoryEntry } from "@/hooks/use-item-types";

interface WarehouseInventory {
  id: string;
  warehouseId: string;
  n950Boxes: number;
  n950Units: number;
  i9000sBoxes: number;
  i9000sUnits: number;
  i9100Boxes: number;
  i9100Units: number;
  rollPaperBoxes: number;
  rollPaperUnits: number;
  stickersBoxes: number;
  stickersUnits: number;
  newBatteriesBoxes: number;
  newBatteriesUnits: number;
  mobilySimBoxes: number;
  mobilySimUnits: number;
  stcSimBoxes: number;
  stcSimUnits: number;
  zainSimBoxes: number;
  zainSimUnits: number;
  lebaraBoxes: number;
  lebaraUnits: number;
  entries?: InventoryEntry[];
}

interface WarehouseData {
  id: string;
  name: string;
  location: string;
  description: string | null;
  isActive: boolean;
  regionId: string | null;
  inventory: WarehouseInventory | null;
}


export default function WarehousesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: itemTypes, refetch: refetchItemTypes } = useActiveItemTypes();

  const { data: allWarehouses = [], isLoading } = useQuery<WarehouseData[]>({
    queryKey: user?.role === 'admin' ? ["/api/warehouses"] : ["/api/supervisor/warehouses"],
    enabled: !!user?.id && (user?.role === 'admin' || user?.role === 'supervisor'),
  });

  const warehouses = allWarehouses.filter(warehouse => 
    warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    warehouse.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportWarehouses = async () => {
    if (warehouses && warehouses.length > 0) {
      try {
        // Always fetch the latest item types so any newly added types appear in Excel headers
        await queryClient.invalidateQueries({
          predicate: (query) =>
            typeof query.queryKey[0] === "string" &&
            query.queryKey[0].startsWith("/api/item-types"),
        });
        const fresh = await refetchItemTypes();
        const latestItemTypes = fresh.data ?? itemTypes;
        await exportWarehousesToExcel({ warehouses, itemTypes: latestItemTypes });
        toast({ 
          title: "تم تصدير التقرير بنجاح", 
          description: "تم حفظ ملف Excel في جهازك" 
        });
      } catch (error) {
        toast({ 
          title: "حدث خطأ أثناء التصدير", 
          description: "يرجى المحاولة مرة أخرى",
          variant: "destructive" 
        });
      }
    } else {
      toast({ 
        title: "لا توجد مستودعات للتصدير", 
        variant: "destructive" 
      });
    }
  };

  const calculateTotalItems = (inventory: WarehouseInventory | null) => {
    if (!inventory) return 0;
    
    if (itemTypes && itemTypes.length > 0) {
      let total = 0;
      for (const itemType of itemTypes.filter(t => t.isActive)) {
        const boxes = getInventoryValueForItemType(itemType.id, inventory.entries, inventory, 'boxes');
        const units = getInventoryValueForItemType(itemType.id, inventory.entries, inventory, 'units');
        total += boxes + units;
      }
      return total;
    }
    
    return (
      inventory.n950Boxes + inventory.n950Units +
      inventory.i9000sBoxes + inventory.i9000sUnits +
      inventory.i9100Boxes + inventory.i9100Units +
      inventory.rollPaperBoxes + inventory.rollPaperUnits +
      inventory.stickersBoxes + inventory.stickersUnits +
      inventory.newBatteriesBoxes + inventory.newBatteriesUnits +
      inventory.mobilySimBoxes + inventory.mobilySimUnits +
      inventory.stcSimBoxes + inventory.stcSimUnits +
      inventory.zainSimBoxes + inventory.zainSimUnits +
      inventory.lebaraBoxes + inventory.lebaraUnits
    );
  };

  const calculateLowStockCount = (inventory: WarehouseInventory | null) => {
    if (!inventory) return 0;
    const threshold = 5;
    
    if (itemTypes && itemTypes.length > 0) {
      let count = 0;
      for (const itemType of itemTypes.filter(t => t.isActive)) {
        const boxes = getInventoryValueForItemType(itemType.id, inventory.entries, inventory, 'boxes');
        const units = getInventoryValueForItemType(itemType.id, inventory.entries, inventory, 'units');
        if ((boxes + units) < threshold) count++;
      }
      return count;
    }
    
    let count = 0;
    if ((inventory.n950Boxes + inventory.n950Units) < threshold) count++;
    if ((inventory.i9000sBoxes + inventory.i9000sUnits) < threshold) count++;
    if ((inventory.i9100Boxes + inventory.i9100Units) < threshold) count++;
    if ((inventory.rollPaperBoxes + inventory.rollPaperUnits) < threshold) count++;
    if ((inventory.stickersBoxes + inventory.stickersUnits) < threshold) count++;
    if ((inventory.newBatteriesBoxes + inventory.newBatteriesUnits) < threshold) count++;
    if ((inventory.mobilySimBoxes + inventory.mobilySimUnits) < threshold) count++;
    if ((inventory.stcSimBoxes + inventory.stcSimUnits) < threshold) count++;
    if ((inventory.zainSimBoxes + inventory.zainSimUnits) < threshold) count++;
    if ((inventory.lebaraBoxes + inventory.lebaraUnits) < threshold) count++;
    
    return count;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4
      }
    }
  };

  return (
    <>
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-[#18B2B0] to-[#16a09e] rounded-2xl shadow-lg shadow-[#18B2B0]/30">
                  <Warehouse className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">
                    إدارة المستودعات
                  </h1>
                  <p className="text-gray-400 text-sm">
                    نظام متكامل لإدارة المخزون
                  </p>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
                <button
                  onClick={handleExportWarehouses}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 backdrop-blur-xl border border-white/20 text-white font-medium rounded-xl hover:bg-white/20 hover:shadow-lg hover:shadow-white/10 transition-all duration-300 flex-1 sm:flex-none text-sm sm:text-base"
                  data-testid="button-export-warehouses"
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  <span>تصدير إلى Excel</span>
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#18B2B0] to-[#16a09e] text-white font-medium rounded-xl hover:shadow-lg hover:shadow-[#18B2B0]/50 transition-all duration-300 transform hover:scale-105 flex-1 sm:flex-none text-sm sm:text-base"
                  data-testid="button-create-warehouse"
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة مستودع جديد</span>
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="ابحث عن مستودع بالاسم أو الموقع..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder:text-gray-400 focus:border-[#18B2B0] focus:ring-[#18B2B0] rounded-xl shadow-sm text-right"
                data-testid="input-search-warehouses"
              />
            </div>
          </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden border border-white/20 bg-white/10 backdrop-blur-xl">
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-6 w-3/4 bg-white/20" />
                  <Skeleton className="h-4 w-full bg-white/20" />
                  <Skeleton className="h-4 w-1/2 bg-white/20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 bg-white/20" />
                    <Skeleton className="h-8 w-20 bg-white/20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : warehouses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-[#18B2B0] to-teal-500 text-white mb-6 shadow-2xl">
              <Warehouse className="h-12 w-12" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-3">
              لا توجد مستودعات
            </h3>
            <p className="text-lg text-white/70 mb-6 max-w-md mx-auto">
              ابدأ بإضافة أول مستودع لإدارة المخزون بكفاءة
            </p>
            <Button 
              onClick={() => setShowCreateModal(true)}
              size="lg"
              className="bg-gradient-to-r from-[#18B2B0] to-teal-500 hover:from-[#16a09e] hover:to-teal-600 shadow-lg text-base sm:text-lg px-6 sm:px-8 transition-all"
              data-testid="button-create-warehouse-empty"
            >
              <Plus className="h-5 w-5 ml-2" />
              إضافة مستودع جديد
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {warehouses.map((warehouse) => {
              const totalItems = calculateTotalItems(warehouse.inventory);
              const lowStockCount = calculateLowStockCount(warehouse.inventory);

              return (
                <motion.div key={warehouse.id} variants={itemVariants} className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#18B2B0]/10 to-transparent rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity blur-xl"></div>
                  <Link href={`/warehouses/${warehouse.id}`}>
                    <Card 
                      className="relative group hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden border border-white/20 hover:border-[#18B2B0]/50 bg-white/10 backdrop-blur-xl transform hover:scale-105"
                      data-testid={`card-warehouse-${warehouse.id}`}
                    >
                      <div className="h-2 bg-gradient-to-r from-[#18B2B0] via-teal-400 to-cyan-400" />
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 text-right">
                            <h3 className="text-2xl font-black text-white group-hover:text-[#18B2B0] transition-colors" data-testid={`text-warehouse-name-${warehouse.id}`}>
                              {warehouse.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-3 text-gray-300">
                              <MapPin className="h-4 w-4 text-[#18B2B0]" />
                              <span data-testid={`text-warehouse-location-${warehouse.id}`}>{warehouse.location}</span>
                            </div>
                          </div>
                          <motion.div 
                            className="p-3 rounded-xl bg-gradient-to-br from-[#18B2B0] to-teal-500 text-white shadow-lg"
                            whileHover={{ rotate: 360, scale: 1.1 }}
                            transition={{ duration: 0.6 }}
                          >
                            <Warehouse className="h-7 w-7" />
                          </motion.div>
                        </div>

                        {warehouse.description && (
                          <p className="text-sm text-gray-300 line-clamp-2 bg-white/5 p-3 rounded-lg border border-white/10" data-testid={`text-warehouse-description-${warehouse.id}`}>
                            {warehouse.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                          <motion.div 
                            className="text-center p-4 rounded-xl bg-white/5 border border-emerald-500/30"
                            whileHover={{ scale: 1.05 }}
                          >
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <Package className="h-5 w-5 text-emerald-400" />
                            </div>
                            <p className="text-3xl font-black text-emerald-400" data-testid={`text-total-items-${warehouse.id}`}>{totalItems}</p>
                            <p className="text-xs text-gray-300 font-semibold mt-1">إجمالي القطع</p>
                          </motion.div>
                          <motion.div 
                            className="text-center p-4 rounded-xl bg-white/5 border border-orange-500/30"
                            whileHover={{ scale: 1.05 }}
                          >
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <AlertTriangle className="h-5 w-5 text-orange-400" />
                            </div>
                            <p className="text-3xl font-black text-orange-400" data-testid={`text-low-stock-${warehouse.id}`}>{lowStockCount}</p>
                            <p className="text-xs text-gray-300 font-semibold mt-1">مخزون منخفض</p>
                          </motion.div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-white/10">
                          <div className="flex gap-2">
                            <Badge 
                              variant={warehouse.isActive ? "default" : "secondary"}
                              className={warehouse.isActive ? "bg-gradient-to-r from-[#18B2B0] to-teal-500 shadow-md text-white" : ""}
                              data-testid={`badge-status-${warehouse.id}`}
                            >
                              {warehouse.isActive ? "● نشط" : "○ غير نشط"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedWarehouse(warehouse);
                                setShowEditModal(true);
                              }}
                              className="border-[#18B2B0] text-[#18B2B0] hover:bg-[#18B2B0] hover:text-white h-6 px-3"
                              data-testid={`button-edit-warehouse-${warehouse.id}`}
                            >
                              <Edit className="h-3 w-3 ml-1" />
                              تعديل
                            </Button>
                          </div>
                          <span className="text-sm text-[#18B2B0] font-bold group-hover:translate-x-[-4px] transition-transform flex items-center gap-2">
                            عرض التفاصيل
                            <Sparkles className="h-4 w-4" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
        </div>

      <CreateWarehouseModal 
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      <EditWarehouseModal 
        open={showEditModal}
        onOpenChange={setShowEditModal}
        warehouse={selectedWarehouse}
      />
    </>
  );
}
