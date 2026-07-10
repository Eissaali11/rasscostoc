import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";

interface TrendLineChartProps {
  title: string;
  description?: string;
  data: Array<{ name: string; [key: string]: any }>;
  dataKeys: Array<{ key: string; color: string; name: string }>;
  height?: number;
}

export function TrendLineChart({ 
  title, 
  description, 
  data, 
  dataKeys,
  height = 300 
}: TrendLineChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#18B2B0]/10 to-transparent rounded-2xl blur-2xl"></div>
      <Card className="relative col-span-full lg:col-span-2 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white">{title}</CardTitle>
          {description && <CardDescription className="text-gray-300">{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis 
                dataKey="name" 
                className="text-xs" 
                tick={{ fill: '#fff' }}
                stroke="rgba(255, 255, 255, 0.2)"
              />
              <YAxis 
                className="text-xs" 
                tick={{ fill: '#fff' }}
                stroke="rgba(255, 255, 255, 0.2)"
              />
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
              {dataKeys.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  stroke={item.color}
                  name={item.name}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
