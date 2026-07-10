import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { motion } from "framer-motion";

interface StockCompositionPieProps {
  title: string;
  description?: string;
  data: Array<{ name: string; value: number }>;
  colors?: string[];
  height?: number;
}

const DEFAULT_COLORS = ['#18B2B0', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function StockCompositionPie({ 
  title, 
  description, 
  data, 
  colors = DEFAULT_COLORS,
  height = 300 
}: StockCompositionPieProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#18B2B0]/10 to-transparent rounded-2xl blur-2xl"></div>
      <Card className="relative bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">{title}</CardTitle>
          {description && <CardDescription className="text-gray-300">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={{ stroke: 'rgba(255, 255, 255, 0.3)' }}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                style={{ fill: '#fff', fontSize: '12px' }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  color: '#fff'
                }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
