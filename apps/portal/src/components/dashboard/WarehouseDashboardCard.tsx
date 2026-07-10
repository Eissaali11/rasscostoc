import { motion } from "framer-motion";
import { WarehouseWithStats } from "@shared/schema";
import { Warehouse as WarehouseIcon, MapPin, AlertTriangle, CheckCircle, XCircle, Package, Smartphone, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CircularProgress } from "./CircularProgress";

interface WarehouseDashboardCardProps {
  warehouse: WarehouseWithStats;
  index: number;
}

interface ProductStatus {
  name: string;
  nameAr: string;
  boxes: number;
  units: number;
  total: number;
  alertLevel: 'good' | 'warning' | 'critical';
  icon: any;
  color: string;
}

export const WarehouseDashboardCard = ({ warehouse, index }: WarehouseDashboardCardProps) => {
  const inv = warehouse.inventory;
  
  const getAlertLevel = (total: number): 'good' | 'warning' | 'critical' => {
    if (total === 0) return 'critical';
    if (total < 20) return 'warning';
    return 'good';
  };

  const products: ProductStatus[] = [
    {
      name: "N950",
      nameAr: "N950",
      boxes: inv?.n950Boxes || 0,
      units: inv?.n950Units || 0,
      total: (inv?.n950Boxes || 0) + (inv?.n950Units || 0),
      alertLevel: getAlertLevel((inv?.n950Boxes || 0) + (inv?.n950Units || 0)),
      icon: Smartphone,
      color: "#3b82f6"
    },
    {
      name: "I9000S",
      nameAr: "I9000S",
      boxes: inv?.i9000sBoxes || 0,
      units: inv?.i9000sUnits || 0,
      total: (inv?.i9000sBoxes || 0) + (inv?.i9000sUnits || 0),
      alertLevel: getAlertLevel((inv?.i9000sBoxes || 0) + (inv?.i9000sUnits || 0)),
      icon: Smartphone,
      color: "#8b5cf6"
    },
    {
      name: "I9100",
      nameAr: "I9100",
      boxes: inv?.i9100Boxes || 0,
      units: inv?.i9100Units || 0,
      total: (inv?.i9100Boxes || 0) + (inv?.i9100Units || 0),
      alertLevel: getAlertLevel((inv?.i9100Boxes || 0) + (inv?.i9100Units || 0)),
      icon: Smartphone,
      color: "#ec4899"
    },
    {
      name: "Roll Paper",
      nameAr: "أوراق رول",
      boxes: inv?.rollPaperBoxes || 0,
      units: inv?.rollPaperUnits || 0,
      total: (inv?.rollPaperBoxes || 0) + (inv?.rollPaperUnits || 0),
      alertLevel: getAlertLevel((inv?.rollPaperBoxes || 0) + (inv?.rollPaperUnits || 0)),
      icon: Package,
      color: "#f59e0b"
    },
    {
      name: "Stickers",
      nameAr: "ملصقات",
      boxes: inv?.stickersBoxes || 0,
      units: inv?.stickersUnits || 0,
      total: (inv?.stickersBoxes || 0) + (inv?.stickersUnits || 0),
      alertLevel: getAlertLevel((inv?.stickersBoxes || 0) + (inv?.stickersUnits || 0)),
      icon: Package,
      color: "#14b8a6"
    },
    {
      name: "Batteries",
      nameAr: "بطاريات",
      boxes: inv?.newBatteriesBoxes || 0,
      units: inv?.newBatteriesUnits || 0,
      total: (inv?.newBatteriesBoxes || 0) + (inv?.newBatteriesUnits || 0),
      alertLevel: getAlertLevel((inv?.newBatteriesBoxes || 0) + (inv?.newBatteriesUnits || 0)),
      icon: Package,
      color: "#06b6d4"
    },
    {
      name: "Mobily SIM",
      nameAr: "موبايلي",
      boxes: inv?.mobilySimBoxes || 0,
      units: inv?.mobilySimUnits || 0,
      total: (inv?.mobilySimBoxes || 0) + (inv?.mobilySimUnits || 0),
      alertLevel: getAlertLevel((inv?.mobilySimBoxes || 0) + (inv?.mobilySimUnits || 0)),
      icon: Package,
      color: "#10b981"
    },
    {
      name: "STC SIM",
      nameAr: "STC",
      boxes: inv?.stcSimBoxes || 0,
      units: inv?.stcSimUnits || 0,
      total: (inv?.stcSimBoxes || 0) + (inv?.stcSimUnits || 0),
      alertLevel: getAlertLevel((inv?.stcSimBoxes || 0) + (inv?.stcSimUnits || 0)),
      icon: Package,
      color: "#8b5cf6"
    },
    {
      name: "Zain SIM",
      nameAr: "زين",
      boxes: inv?.zainSimBoxes || 0,
      units: inv?.zainSimUnits || 0,
      total: (inv?.zainSimBoxes || 0) + (inv?.zainSimUnits || 0),
      alertLevel: getAlertLevel((inv?.zainSimBoxes || 0) + (inv?.zainSimUnits || 0)),
      icon: Package,
      color: "#f97316"
    },
  ];

  const totalInventory = products.reduce((sum, p) => sum + p.total, 0);
  const criticalCount = products.filter(p => p.alertLevel === 'critical').length;
  const warningCount = products.filter(p => p.alertLevel === 'warning').length;

  const circularColor = index === 0 ? "#f97316" : index === 1 ? "#fb923c" : index === 2 ? "#fdba74" : "#fed7aa";

  return (
    <TooltipProvider>
      <Link href={`/warehouses/${warehouse.id}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.02, y: -4 }}
          className="group cursor-pointer"
          data-testid={`warehouse-card-${warehouse.id}`}
        >
          <div className="relative bg-gradient-to-br from-white/10 to-white/[0.03] backdrop-blur-xl rounded-2xl border border-orange-500/30 overflow-hidden shadow-xl hover:shadow-2xl hover:border-orange-500/60 transition-all duration-300">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Glow Effect */}
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(249, 115, 22, 0.0)",
                  "0 0 40px rgba(249, 115, 22, 0.2)",
                  "0 0 20px rgba(249, 115, 22, 0.0)",
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            <div className="relative p-6">
              {/* Header with Icon and Info */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg"
                    whileHover={{ rotate: 12, scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <WarehouseIcon className="h-6 w-6 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{warehouse.name}</h3>
                    {warehouse.location && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" />
                        <span>{warehouse.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {criticalCount > 0 && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                      <AlertTriangle className="h-3 w-3 ml-1" />
                      {criticalCount}
                    </Badge>
                  )}
                  {warningCount > 0 && (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                      {warningCount}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Circular Progress - Center */}
              <div className="flex justify-center mb-6">
                <CircularProgress
                  percentage={Math.min(100, (totalInventory / 1000) * 100)}
                  label="إجمالي المخزون"
                  value={totalInventory.toString()}
                  color={circularColor}
                  size={160}
                />
              </div>

              {/* Total Badge */}
              <div className="flex justify-center mb-6">
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 px-4 py-2 text-base">
                  {totalInventory} وحدة إجمالي
                </Badge>
              </div>

              {/* Products List */}
              <div className="grid grid-cols-3 gap-3">
                {products.map((product, idx) => {
                  const Icon = product.icon;
                  const AlertIcon = product.alertLevel === 'critical' ? XCircle : 
                                    product.alertLevel === 'warning' ? AlertTriangle : 
                                    CheckCircle;
                  const alertColor = product.alertLevel === 'critical' ? 'text-red-400' : 
                                     product.alertLevel === 'warning' ? 'text-yellow-400' : 
                                     'text-green-400';
                  
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 + idx * 0.03 }}
                      className="relative bg-white/5 rounded-xl p-3 border border-white/10 hover:border-orange-500/40 transition-all"
                      data-testid={`warehouse-product-${product.name}-${warehouse.id}`}
                    >
                      <div className="absolute -top-2 -right-2">
                        <AlertIcon className={`h-4 w-4 ${alertColor} drop-shadow-lg`} />
                      </div>

                      <div className="text-center">
                        <div className="flex justify-center mb-2">
                          <div 
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${product.color}20` }}
                          >
                            <Icon 
                              className="h-4 w-4" 
                              style={{ color: product.color }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mb-1 truncate">{product.nameAr}</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-base font-bold text-white cursor-help">{product.total}</p>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <div className="text-xs space-y-1">
                              <p className="flex items-center gap-1">
                                <Box className="h-3 w-3" />
                                كراتين: {product.boxes}
                              </p>
                              <p className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                مفرد: {product.units}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        
                        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (product.total / 50) * 100)}%` }}
                            transition={{ duration: 0.5, delay: index * 0.1 + idx * 0.03 }}
                            className="h-full rounded-full"
                            style={{ 
                              backgroundColor: product.alertLevel === 'critical' ? '#ef4444' : 
                                               product.alertLevel === 'warning' ? '#f59e0b' : 
                                               product.color 
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </TooltipProvider>
  );
};
