import { motion } from "framer-motion";
import { TechnicianWithBothInventories } from "@shared/schema";
import { User, MapPin, AlertTriangle, CheckCircle, XCircle, Package, Smartphone, TruckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TechnicianDashboardCardProps {
  technician: TechnicianWithBothInventories;
  index: number;
}

interface ProductStatus {
  name: string;
  nameAr: string;
  fixedBoxes: number;
  fixedUnits: number;
  fixedTotal: number;
  movingBoxes: number;
  movingUnits: number;
  movingTotal: number;
  grandTotal: number;
  alertLevel: 'good' | 'warning' | 'critical';
  icon: any;
  color: string;
}

export const TechnicianDashboardCard = ({ technician, index }: TechnicianDashboardCardProps) => {
  const fixedInv = technician.fixedInventory as any;
  const movingInv = technician.movingInventory as any;
  
  // تحديد مستوى التنبيه لكل منتج (بناءً على المجموع الكلي)
  const getAlertLevel = (total: number): 'good' | 'warning' | 'critical' => {
    if (total === 0) return 'critical';
    if (total < 10) return 'warning';
    return 'good';
  };

  // إنشاء قائمة المنتجات مع حالاتها - دائماً تعرض جميع المنتجات حتى لو كان المخزون فارغ
  const products: ProductStatus[] = [
    {
      name: "N950",
      nameAr: "N950",
      fixedBoxes: fixedInv?.n950Boxes || 0,
      fixedUnits: fixedInv?.n950Units || 0,
      fixedTotal: (fixedInv?.n950Boxes || 0) + (fixedInv?.n950Units || 0),
      movingBoxes: movingInv?.n950Boxes || 0,
      movingUnits: movingInv?.n950Units || 0,
      movingTotal: (movingInv?.n950Boxes || 0) + (movingInv?.n950Units || 0),
      grandTotal: (fixedInv?.n950Boxes || 0) + (fixedInv?.n950Units || 0) + (movingInv?.n950Boxes || 0) + (movingInv?.n950Units || 0),
      alertLevel: getAlertLevel((fixedInv?.n950Boxes || 0) + (fixedInv?.n950Units || 0) + (movingInv?.n950Boxes || 0) + (movingInv?.n950Units || 0)),
      icon: Smartphone,
      color: "#3b82f6"
    },
    {
      name: "I9000S",
      nameAr: "I9000S",
      fixedBoxes: fixedInv?.i9000sBoxes || 0,
      fixedUnits: fixedInv?.i9000sUnits || 0,
      fixedTotal: (fixedInv?.i9000sBoxes || 0) + (fixedInv?.i9000sUnits || 0),
      movingBoxes: movingInv?.i9000sBoxes || 0,
      movingUnits: movingInv?.i9000sUnits || 0,
      movingTotal: (movingInv?.i9000sBoxes || 0) + (movingInv?.i9000sUnits || 0),
      grandTotal: (fixedInv?.i9000sBoxes || 0) + (fixedInv?.i9000sUnits || 0) + (movingInv?.i9000sBoxes || 0) + (movingInv?.i9000sUnits || 0),
      alertLevel: getAlertLevel((fixedInv?.i9000sBoxes || 0) + (fixedInv?.i9000sUnits || 0) + (movingInv?.i9000sBoxes || 0) + (movingInv?.i9000sUnits || 0)),
      icon: Smartphone,
      color: "#8b5cf6"
    },
    {
      name: "I9100",
      nameAr: "I9100",
      fixedBoxes: fixedInv?.i9100Boxes || 0,
      fixedUnits: fixedInv?.i9100Units || 0,
      fixedTotal: (fixedInv?.i9100Boxes || 0) + (fixedInv?.i9100Units || 0),
      movingBoxes: movingInv?.i9100Boxes || 0,
      movingUnits: movingInv?.i9100Units || 0,
      movingTotal: (movingInv?.i9100Boxes || 0) + (movingInv?.i9100Units || 0),
      grandTotal: (fixedInv?.i9100Boxes || 0) + (fixedInv?.i9100Units || 0) + (movingInv?.i9100Boxes || 0) + (movingInv?.i9100Units || 0),
      alertLevel: getAlertLevel((fixedInv?.i9100Boxes || 0) + (fixedInv?.i9100Units || 0) + (movingInv?.i9100Boxes || 0) + (movingInv?.i9100Units || 0)),
      icon: Smartphone,
      color: "#ec4899"
    },
    {
      name: "Roll Paper",
      nameAr: "أوراق رول",
      fixedBoxes: fixedInv?.rollPaperBoxes || 0,
      fixedUnits: fixedInv?.rollPaperUnits || 0,
      fixedTotal: (fixedInv?.rollPaperBoxes || 0) + (fixedInv?.rollPaperUnits || 0),
      movingBoxes: movingInv?.rollPaperBoxes || 0,
      movingUnits: movingInv?.rollPaperUnits || 0,
      movingTotal: (movingInv?.rollPaperBoxes || 0) + (movingInv?.rollPaperUnits || 0),
      grandTotal: (fixedInv?.rollPaperBoxes || 0) + (fixedInv?.rollPaperUnits || 0) + (movingInv?.rollPaperBoxes || 0) + (movingInv?.rollPaperUnits || 0),
      alertLevel: getAlertLevel((fixedInv?.rollPaperBoxes || 0) + (fixedInv?.rollPaperUnits || 0) + (movingInv?.rollPaperBoxes || 0) + (movingInv?.rollPaperUnits || 0)),
      icon: Package,
      color: "#f59e0b"
    },
    {
      name: "Stickers",
      nameAr: "ملصقات",
      fixedBoxes: fixedInv?.stickersBoxes || 0,
      fixedUnits: fixedInv?.stickersUnits || 0,
      fixedTotal: (fixedInv?.stickersBoxes || 0) + (fixedInv?.stickersUnits || 0),
      movingBoxes: movingInv?.stickersBoxes || 0,
      movingUnits: movingInv?.stickersUnits || 0,
      movingTotal: (movingInv?.stickersBoxes || 0) + (movingInv?.stickersUnits || 0),
      grandTotal: (fixedInv?.stickersBoxes || 0) + (fixedInv?.stickersUnits || 0) + (movingInv?.stickersBoxes || 0) + (movingInv?.stickersUnits || 0),
      alertLevel: getAlertLevel((fixedInv?.stickersBoxes || 0) + (fixedInv?.stickersUnits || 0) + (movingInv?.stickersBoxes || 0) + (movingInv?.stickersUnits || 0)),
      icon: Package,
      color: "#14b8a6"
    },
    {
      name: "Batteries",
      nameAr: "بطاريات",
      fixedBoxes: fixedInv?.newBatteriesBoxes || 0,
      fixedUnits: fixedInv?.newBatteriesUnits || 0,
      fixedTotal: (fixedInv?.newBatteriesBoxes || 0) + (fixedInv?.newBatteriesUnits || 0),
      movingBoxes: movingInv?.newBatteriesBoxes || 0,
      movingUnits: movingInv?.newBatteriesUnits || 0,
      movingTotal: (movingInv?.newBatteriesBoxes || 0) + (movingInv?.newBatteriesUnits || 0),
      grandTotal: (fixedInv?.newBatteriesBoxes || 0) + (fixedInv?.newBatteriesUnits || 0) + (movingInv?.newBatteriesBoxes || 0) + (movingInv?.newBatteriesUnits || 0),
      alertLevel: getAlertLevel((fixedInv?.newBatteriesBoxes || 0) + (fixedInv?.newBatteriesUnits || 0) + (movingInv?.newBatteriesBoxes || 0) + (movingInv?.newBatteriesUnits || 0)),
      icon: Package,
      color: "#06b6d4"
    },
    {
      name: "Mobily SIM",
      nameAr: "موبايلي",
      fixedBoxes: fixedInv?.mobilySimBoxes || 0,
      fixedUnits: fixedInv?.mobilySimUnits || 0,
      fixedTotal: (fixedInv?.mobilySimBoxes || 0) + (fixedInv?.mobilySimUnits || 0),
      movingBoxes: movingInv?.mobilySimBoxes || 0,
      movingUnits: movingInv?.mobilySimUnits || 0,
      movingTotal: (movingInv?.mobilySimBoxes || 0) + (movingInv?.mobilySimUnits || 0),
      grandTotal: (fixedInv?.mobilySimBoxes || 0) + (fixedInv?.mobilySimUnits || 0) + (movingInv?.mobilySimBoxes || 0) + (movingInv?.mobilySimUnits || 0),
      alertLevel: getAlertLevel((fixedInv?.mobilySimBoxes || 0) + (fixedInv?.mobilySimUnits || 0) + (movingInv?.mobilySimBoxes || 0) + (movingInv?.mobilySimUnits || 0)),
      icon: Package,
      color: "#10b981"
    },
    {
      name: "STC SIM",
      nameAr: "STC",
      fixedBoxes: fixedInv?.stcSimBoxes || 0,
      fixedUnits: fixedInv?.stcSimUnits || 0,
      fixedTotal: (fixedInv?.stcSimBoxes || 0) + (fixedInv?.stcSimUnits || 0),
      movingBoxes: movingInv?.stcSimBoxes || 0,
      movingUnits: movingInv?.stcSimUnits || 0,
      movingTotal: (movingInv?.stcSimBoxes || 0) + (movingInv?.stcSimUnits || 0),
      grandTotal: (fixedInv?.stcSimBoxes || 0) + (fixedInv?.stcSimUnits || 0) + (movingInv?.stcSimBoxes || 0) + (movingInv?.stcSimUnits || 0),
      alertLevel: getAlertLevel((fixedInv?.stcSimBoxes || 0) + (fixedInv?.stcSimUnits || 0) + (movingInv?.stcSimBoxes || 0) + (movingInv?.stcSimUnits || 0)),
      icon: Package,
      color: "#8b5cf6"
    },
    {
      name: "Zain SIM",
      nameAr: "زين",
      fixedBoxes: fixedInv?.zainSimBoxes || 0,
      fixedUnits: fixedInv?.zainSimUnits || 0,
      fixedTotal: (fixedInv?.zainSimBoxes || 0) + (fixedInv?.zainSimUnits || 0),
      movingBoxes: movingInv?.zainSimBoxes || 0,
      movingUnits: movingInv?.zainSimUnits || 0,
      movingTotal: (movingInv?.zainSimBoxes || 0) + (movingInv?.zainSimUnits || 0),
      grandTotal: (fixedInv?.zainSimBoxes || 0) + (fixedInv?.zainSimUnits || 0) + (movingInv?.zainSimBoxes || 0) + (movingInv?.zainSimUnits || 0),
      alertLevel: getAlertLevel((fixedInv?.zainSimBoxes || 0) + (fixedInv?.zainSimUnits || 0) + (movingInv?.zainSimBoxes || 0) + (movingInv?.zainSimUnits || 0)),
      icon: Package,
      color: "#f97316"
    },
  ];

  const totalInventory = products.reduce((sum, p) => sum + p.grandTotal, 0);
  const totalFixed = products.reduce((sum, p) => sum + p.fixedTotal, 0);
  const totalMoving = products.reduce((sum, p) => sum + p.movingTotal, 0);
  const criticalCount = products.filter(p => p.alertLevel === 'critical').length;
  const warningCount = products.filter(p => p.alertLevel === 'warning').length;

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.005 }}
        className="group mb-4"
      >
        <Link href={`/technician-details/${technician.technicianId}`}>
          <div className="relative bg-gradient-to-r from-white/10 via-white/5 to-white/10 backdrop-blur-xl rounded-2xl border border-[#18B2B0]/30 overflow-hidden shadow-lg hover:shadow-2xl hover:border-[#18B2B0]/60 transition-all duration-300">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#18B2B0]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Glow Effect */}
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(24, 178, 176, 0.0)",
                  "0 0 40px rgba(24, 178, 176, 0.2)",
                  "0 0 20px rgba(24, 178, 176, 0.0)",
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            <div className="relative p-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Technician Info - Left Side */}
                <div className="lg:col-span-3">
                  <div className="flex items-center gap-4">
                    <motion.div 
                      className="p-3 bg-gradient-to-br from-[#18B2B0] to-[#0ea5a3] rounded-xl shadow-lg flex-shrink-0"
                      whileHover={{ rotate: 12, scale: 1.1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <User className="h-6 w-6 text-white" />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">
                        {technician.technicianName}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{technician.city}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className="bg-[#18B2B0]/20 text-[#18B2B0] border-[#18B2B0]/30 text-xs">
                          {totalInventory} وحدة
                        </Badge>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                              <Package className="h-3 w-3 ml-1" />
                              {totalFixed}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>المخزون الثابت</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                              <TruckIcon className="h-3 w-3 ml-1" />
                              {totalMoving}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>المخزون المتحرك</p>
                          </TooltipContent>
                        </Tooltip>
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
                  </div>
                </div>

                {/* Products Dashboard - Middle/Right Side */}
                <div className="lg:col-span-9">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
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
                          transition={{ delay: index * 0.05 + idx * 0.02 }}
                          className="relative bg-white/5 rounded-xl p-3 border border-white/10 hover:border-[#18B2B0]/40 transition-all"
                          data-testid={`product-${product.name}-${technician.technicianId}`}
                        >
                          {/* Alert Badge */}
                          <div className="absolute -top-2 -right-2">
                            <AlertIcon className={`h-5 w-5 ${alertColor} drop-shadow-lg`} />
                          </div>

                          {/* Product Info */}
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
                                <p className="text-lg font-bold text-white cursor-help">{product.grandTotal}</p>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <div className="text-xs">
                                  <p className="flex items-center gap-1">
                                    <Package className="h-3 w-3 text-purple-400" />
                                    <span>ثابت: {product.fixedTotal}</span>
                                  </p>
                                  <p className="flex items-center gap-1">
                                    <TruckIcon className="h-3 w-3 text-green-400" />
                                    <span>متحرك: {product.movingTotal}</span>
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                            
                            {/* Inventory Type Badges */}
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs px-1 py-0">
                                    {product.fixedTotal}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <p className="text-xs">ثابت: ك{product.fixedBoxes} م{product.fixedUnits}</p>
                                </TooltipContent>
                              </Tooltip>
                              <span className="text-xs text-gray-500">/</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs px-1 py-0">
                                    {product.movingTotal}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <p className="text-xs">متحرك: ك{product.movingBoxes} م{product.movingUnits}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            
                            {/* Mini Progress Bar */}
                            <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (product.grandTotal / 20) * 100)}%` }}
                                transition={{ duration: 0.5, delay: index * 0.05 + idx * 0.02 }}
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
            </div>
          </div>
        </Link>
      </motion.div>
    </TooltipProvider>
  );
};
