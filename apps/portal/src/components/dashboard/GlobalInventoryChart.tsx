import { useTranslation } from "@/lib/language";
import { motion } from "framer-motion";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { TrendingUp, Package, TruckIcon, Warehouse } from "lucide-react";
import type { TechnicianWithBothInventories, WarehouseWithStats } from "@shared/schema";

interface GlobalInventoryChartProps {
  technicians?: TechnicianWithBothInventories[];
  warehouses?: WarehouseWithStats[];
}

interface ProductData {
  name: string;
  nameAr: string;
  techniciansFixed: number;
  techniciansMoving: number;
  warehouses: number;
  total: number;
  color: string;
}

export const GlobalInventoryChart = ({ technicians, warehouses }: GlobalInventoryChartProps) => {
  const { t } = useTranslation();
  // Aggregate data from all sources
  const aggregateInventory = (): ProductData[] => {
    const products = [
      { name: "N950", nameAr: "N950", color: "#3b82f6" },
      { name: "I9000S", nameAr: "I9000S", color: "#8b5cf6" },
      { name: "I9100", nameAr: "I9100", color: "#ec4899" },
      { name: "RollPaper", nameAr: t('inventory.paper'), color: "#10b981" },
      { name: "Stickers", nameAr: t('inventory.stickers'), color: "#f59e0b" },
      { name: "Batteries", nameAr: t('inventory.batteries_1'), color: "#eab308" },
      { name: "MobilySIM", nameAr: t('inventory.mobily'), color: "#22c55e" },
      { name: "STCSIM", nameAr: "STC", color: "#a855f7" },
      { name: "ZainSIM", nameAr: t('inventory.zain'), color: "#f97316" },
    ];

    return products.map(product => {
      let techniciansFixed = 0;
      let techniciansMoving = 0;
      let warehousesTotal = 0;

      // Aggregate from technicians
      if (technicians) {
        technicians.forEach(tech => {
          const fixedInv = tech.fixedInventory as any;
          const movingInv = tech.movingInventory as any;

          switch (product.name) {
            case "N950":
              techniciansFixed += (fixedInv?.n950Boxes || 0) + (fixedInv?.n950Units || 0);
              techniciansMoving += (movingInv?.n950Boxes || 0) + (movingInv?.n950Units || 0);
              break;
            case "I9000S":
              techniciansFixed += (fixedInv?.i9000sBoxes || 0) + (fixedInv?.i9000sUnits || 0);
              techniciansMoving += (movingInv?.i9000sBoxes || 0) + (movingInv?.i9000sUnits || 0);
              break;
            case "I9100":
              techniciansFixed += (fixedInv?.i9100Boxes || 0) + (fixedInv?.i9100Units || 0);
              techniciansMoving += (movingInv?.i9100Boxes || 0) + (movingInv?.i9100Units || 0);
              break;
            case "RollPaper":
              techniciansFixed += (fixedInv?.rollPaperBoxes || 0) + (fixedInv?.rollPaperUnits || 0);
              techniciansMoving += (movingInv?.rollPaperBoxes || 0) + (movingInv?.rollPaperUnits || 0);
              break;
            case "Stickers":
              techniciansFixed += (fixedInv?.stickersBoxes || 0) + (fixedInv?.stickersUnits || 0);
              techniciansMoving += (movingInv?.stickersBoxes || 0) + (movingInv?.stickersUnits || 0);
              break;
            case "Batteries":
              techniciansFixed += (fixedInv?.newBatteriesBoxes || 0) + (fixedInv?.newBatteriesUnits || 0);
              techniciansMoving += (movingInv?.newBatteriesBoxes || 0) + (movingInv?.newBatteriesUnits || 0);
              break;
            case "MobilySIM":
              techniciansFixed += (fixedInv?.mobilySimBoxes || 0) + (fixedInv?.mobilySimUnits || 0);
              techniciansMoving += (movingInv?.mobilySimBoxes || 0) + (movingInv?.mobilySimUnits || 0);
              break;
            case "STCSIM":
              techniciansFixed += (fixedInv?.stcSimBoxes || 0) + (fixedInv?.stcSimUnits || 0);
              techniciansMoving += (movingInv?.stcSimBoxes || 0) + (movingInv?.stcSimUnits || 0);
              break;
            case "ZainSIM":
              techniciansFixed += (fixedInv?.zainSimBoxes || 0) + (fixedInv?.zainSimUnits || 0);
              techniciansMoving += (movingInv?.zainSimBoxes || 0) + (movingInv?.zainSimUnits || 0);
              break;
          }
        });
      }

      // Aggregate from warehouses
      if (warehouses) {
        warehouses.forEach(wh => {
          const inv = wh.inventory;
          if (!inv) return;

          switch (product.name) {
            case "N950":
              warehousesTotal += (inv.n950Boxes || 0) + (inv.n950Units || 0);
              break;
            case "I9000S":
              warehousesTotal += (inv.i9000sBoxes || 0) + (inv.i9000sUnits || 0);
              break;
            case "I9100":
              warehousesTotal += (inv.i9100Boxes || 0) + (inv.i9100Units || 0);
              break;
            case "RollPaper":
              warehousesTotal += (inv.rollPaperBoxes || 0) + (inv.rollPaperUnits || 0);
              break;
            case "Stickers":
              warehousesTotal += (inv.stickersBoxes || 0) + (inv.stickersUnits || 0);
              break;
            case "Batteries":
              warehousesTotal += (inv.newBatteriesBoxes || 0) + (inv.newBatteriesUnits || 0);
              break;
            case "MobilySIM":
              warehousesTotal += (inv.mobilySimBoxes || 0) + (inv.mobilySimUnits || 0);
              break;
            case "STCSIM":
              warehousesTotal += (inv.stcSimBoxes || 0) + (inv.stcSimUnits || 0);
              break;
            case "ZainSIM":
              warehousesTotal += (inv.zainSimBoxes || 0) + (inv.zainSimUnits || 0);
              break;
          }
        });
      }

      return {
        ...product,
        techniciansFixed,
        techniciansMoving,
        warehouses: warehousesTotal,
        total: techniciansFixed + techniciansMoving + warehousesTotal,
      };
    });
  };

  const data = aggregateInventory();
  const grandTotal = data.reduce((sum, item) => sum + item.total, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-2xl">
          <p className="text-white font-bold mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2 text-purple-400">
              <Package className="h-3 w-3" />
              <span>{t('inventory.item_14385')}{payload[0]?.value || 0}</span>
            </p>
            <p className="flex items-center gap-2 text-emerald-400">
              <TruckIcon className="h-3 w-3" />
              <span>{t('inventory.item_16029')}{payload[1]?.value || 0}</span>
            </p>
            <p className="flex items-center gap-2 text-orange-400">
              <Warehouse className="h-3 w-3" />
              <span>{t('inventory.warehouses_1')}{payload[2]?.value || 0}</span>
            </p>
            <div className="border-t border-white/20 mt-2 pt-2">
              <p className="text-white font-bold">
                {t('common.total_label', { total: (payload[0]?.value || 0) + (payload[1]?.value || 0) + (payload[2]?.value || 0) })}
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative bg-gradient-to-br from-white/10 to-white/[0.03] backdrop-blur-xl rounded-3xl border border-[#18B2B0]/30 p-8 overflow-hidden shadow-2xl mb-8"
    >
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#18B2B0]/10 to-transparent" />
      
      {/* Animated Glow */}
      <motion.div
        className="absolute inset-0 rounded-3xl"
        animate={{
          boxShadow: [
            "0 0 30px rgba(24, 178, 176, 0.1)",
            "0 0 50px rgba(24, 178, 176, 0.2)",
            "0 0 30px rgba(24, 178, 176, 0.1)",
          ]
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 5, 0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="p-4 bg-gradient-to-br from-[#18B2B0] to-teal-600 rounded-2xl shadow-lg"
            >
              <TrendingUp className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h2 className="text-3xl font-bold text-white">{t('inventory.total_inventory_system')}</h2>
              <p className="text-gray-400 text-sm">{t('inventory.view_couriers')}</p>
            </div>
          </div>
          <div className="bg-[#18B2B0]/20 backdrop-blur-sm border border-[#18B2B0]/30 rounded-2xl px-6 py-4">
            <p className="text-gray-400 text-sm">{t('inventory.total_2')}</p>
            <p className="text-4xl font-bold text-white">{grandTotal.toLocaleString()}</p>
            <p className="text-[#18B2B0] text-sm">{t('inventory.unit')}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <defs>
                <linearGradient id="colorFixed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.3}/>
                </linearGradient>
                <linearGradient id="colorMoving" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.3}/>
                </linearGradient>
                <linearGradient id="colorWarehouse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="nameAr" 
                stroke="#9ca3af" 
                angle={-45}
                textAnchor="end"
                height={100}
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    techniciansFixed: t('inventory.couriers_1'),
                    techniciansMoving: t('inventory.couriers_3'),
                    warehouses: t('inventory.warehouses_3')
                  };
                  return <span className="text-gray-300">{labels[value] || value}</span>;
                }}
              />
              <Bar 
                dataKey="techniciansFixed" 
                stackId="a"
                fill="url(#colorFixed)"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="techniciansMoving" 
                stackId="a"
                fill="url(#colorMoving)"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="warehouses" 
                stackId="a"
                fill="url(#colorWarehouse)"
                radius={[8, 8, 0, 0]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#18B2B0"
                strokeWidth={3}
                fill="none"
                dot={{ fill: '#18B2B0', r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-purple-500/10 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Package className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">{t('inventory.couriers_1')}</p>
                <p className="text-2xl font-bold text-white">
                  {data.reduce((sum, item) => sum + item.techniciansFixed, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/30 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <TruckIcon className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">{t('inventory.couriers_3')}</p>
                <p className="text-2xl font-bold text-white">
                  {data.reduce((sum, item) => sum + item.techniciansMoving, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-orange-500/10 backdrop-blur-sm border border-orange-500/30 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Warehouse className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">{t('inventory.warehouses_3')}</p>
                <p className="text-2xl font-bold text-white">
                  {data.reduce((sum, item) => sum + item.warehouses, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

