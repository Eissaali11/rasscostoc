import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Package, TruckIcon } from "lucide-react";

interface InventoryPieCardProps {
  fixedTotal: number;
  movingTotal: number;
}

export const InventoryPieCard = ({ fixedTotal, movingTotal }: InventoryPieCardProps) => {
  const data = [
    { name: "المخزون الثابت", value: fixedTotal, color: "#18B2B0" },
    { name: "المخزون المتحرك", value: movingTotal, color: "#10b981" },
  ];

  const total = fixedTotal + movingTotal;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percent = total > 0 ? ((payload[0].value / total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-[#0a0a0f]/95 backdrop-blur-xl border border-[#18B2B0]/30 p-4 rounded-xl shadow-2xl">
          <p className="text-white font-bold mb-1">{payload[0].name}</p>
          <p className="text-[#18B2B0] font-semibold">
            {payload[0].value.toLocaleString()} وحدة
          </p>
          <p className="text-gray-400 text-sm">{percent}% من الإجمالي</p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = () => (
    <div className="flex flex-col gap-3 mt-6">
      {data.map((entry, index) => (
        <div
          key={index}
          className="flex items-center justify-between bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10"
        >
          <div className="flex items-center gap-3">
            {index === 0 ? (
              <Package className="h-5 w-5" style={{ color: entry.color }} />
            ) : (
              <TruckIcon className="h-5 w-5" style={{ color: entry.color }} />
            )}
            <span className="text-white font-medium">{entry.name}</span>
          </div>
          <div className="text-left">
            <p className="text-white font-bold">{entry.value.toLocaleString()}</p>
            <p className="text-gray-400 text-xs">
              {total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'}%
            </p>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#18B2B0]/20 to-[#10b981]/20 rounded-lg p-3 border border-[#18B2B0]/30 mt-2">
        <span className="text-white font-bold">الإجمالي الكلي</span>
        <span className="text-[#18B2B0] font-bold text-lg">{total.toLocaleString()}</span>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative bg-gradient-to-br from-white/10 to-white/[0.03] backdrop-blur-xl rounded-3xl border border-[#18B2B0]/30 p-8 overflow-hidden shadow-2xl"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#18B2B0]/10 to-transparent" />
      
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
        <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-[#18B2B0] to-[#0ea5a3] rounded-xl">
            <Package className="h-6 w-6 text-white" />
          </div>
          توزيع المخزون
        </h3>

        {total > 0 ? (
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="h-[300px] flex items-center justify-center" data-testid="chart-inventory-pie">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <CustomLegend />
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">لا توجد بيانات متاحة</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
