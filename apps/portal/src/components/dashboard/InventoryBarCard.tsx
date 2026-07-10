import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Activity } from "lucide-react";

interface InventoryData {
  n950Boxes?: number;
  n950Units?: number;
  i9000sBoxes?: number;
  i9000sUnits?: number;
  i9100Boxes?: number;
  i9100Units?: number;
  rollPaperBoxes?: number;
  rollPaperUnits?: number;
  stickersBoxes?: number;
  stickersUnits?: number;
  newBatteriesBoxes?: number;
  newBatteriesUnits?: number;
  mobilySimBoxes?: number;
  mobilySimUnits?: number;
  stcSimBoxes?: number;
  stcSimUnits?: number;
  zainSimBoxes?: number;
  zainSimUnits?: number;
}

interface InventoryBarCardProps {
  fixedInventory?: InventoryData;
  movingInventory?: InventoryData;
  title: string;
}

export const InventoryBarCard = ({ fixedInventory, movingInventory, title }: InventoryBarCardProps) => {
  const categories = [
    {
      name: "N950",
      fixed: (fixedInventory?.n950Boxes || 0) + (fixedInventory?.n950Units || 0),
      moving: (movingInventory?.n950Boxes || 0) + (movingInventory?.n950Units || 0),
      color: "#3b82f6",
    },
    {
      name: "I9000S",
      fixed: (fixedInventory?.i9000sBoxes || 0) + (fixedInventory?.i9000sUnits || 0),
      moving: (movingInventory?.i9000sBoxes || 0) + (movingInventory?.i9000sUnits || 0),
      color: "#8b5cf6",
    },
    {
      name: "I9100",
      fixed: (fixedInventory?.i9100Boxes || 0) + (fixedInventory?.i9100Units || 0),
      moving: (movingInventory?.i9100Boxes || 0) + (movingInventory?.i9100Units || 0),
      color: "#ec4899",
    },
    {
      name: "شرائح",
      fixed: 
        (fixedInventory?.mobilySimBoxes || 0) + (fixedInventory?.mobilySimUnits || 0) +
        (fixedInventory?.stcSimBoxes || 0) + (fixedInventory?.stcSimUnits || 0) +
        (fixedInventory?.zainSimBoxes || 0) + (fixedInventory?.zainSimUnits || 0),
      moving: 
        (movingInventory?.mobilySimBoxes || 0) + (movingInventory?.mobilySimUnits || 0) +
        (movingInventory?.stcSimBoxes || 0) + (movingInventory?.stcSimUnits || 0) +
        (movingInventory?.zainSimBoxes || 0) + (movingInventory?.zainSimUnits || 0),
      color: "#10b981",
    },
    {
      name: "ملحقات",
      fixed: 
        (fixedInventory?.rollPaperBoxes || 0) + (fixedInventory?.rollPaperUnits || 0) +
        (fixedInventory?.stickersBoxes || 0) + (fixedInventory?.stickersUnits || 0) +
        (fixedInventory?.newBatteriesBoxes || 0) + (fixedInventory?.newBatteriesUnits || 0),
      moving: 
        (movingInventory?.rollPaperBoxes || 0) + (movingInventory?.rollPaperUnits || 0) +
        (movingInventory?.stickersBoxes || 0) + (movingInventory?.stickersUnits || 0) +
        (movingInventory?.newBatteriesBoxes || 0) + (movingInventory?.newBatteriesUnits || 0),
      color: "#f59e0b",
    },
  ];

  const maxValue = Math.max(...categories.flatMap(c => [c.fixed, c.moving]));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0a0a0f]/95 backdrop-blur-xl border border-[#18B2B0]/30 p-4 rounded-xl shadow-2xl">
          <p className="text-white font-bold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <span className="text-gray-300">{entry.name}:</span>
              <span className="font-semibold" style={{ color: entry.color }}>
                {entry.value.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">الإجمالي:</span>
              <span className="text-[#18B2B0] font-bold">
                {payload.reduce((sum: number, entry: any) => sum + entry.value, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative bg-gradient-to-br from-white/10 to-white/[0.03] backdrop-blur-xl rounded-3xl border border-[#18B2B0]/30 p-8 overflow-hidden shadow-2xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
      
      <motion.div
        className="absolute inset-0 rounded-3xl"
        animate={{
          boxShadow: [
            "0 0 30px rgba(139, 92, 246, 0.1)",
            "0 0 50px rgba(139, 92, 246, 0.2)",
            "0 0 30px rgba(139, 92, 246, 0.1)",
          ]
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      <div className="relative">
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
            <Activity className="h-6 w-6 text-white" />
          </div>
          {title}
        </h3>

        <div className="h-[400px]" data-testid="chart-inventory-bar">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categories}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <defs>
                <linearGradient id="fixedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#18B2B0" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#18B2B0" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="movingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="name" 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 14 }}
                angle={-20}
                textAnchor="end"
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 14 }}
                domain={[0, maxValue > 0 ? maxValue * 1.1 : 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span className="text-white">{value}</span>}
              />
              <Bar 
                dataKey="fixed" 
                name="المخزون الثابت" 
                fill="url(#fixedGradient)"
                radius={[8, 8, 0, 0]}
              />
              <Bar 
                dataKey="moving" 
                name="المخزون المتحرك" 
                fill="url(#movingGradient)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          {categories.map((category, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
              data-testid={`category-${category.name}`}
            >
              <p className="text-gray-400 text-xs mb-1">{category.name}</p>
              <p className="text-white font-bold text-lg">
                {(category.fixed + category.moving).toLocaleString()}
              </p>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="text-[#18B2B0]">ث:{category.fixed}</span>
                <span className="text-emerald-400">م:{category.moving}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
