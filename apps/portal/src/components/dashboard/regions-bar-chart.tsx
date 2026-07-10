import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";

interface RegionsBarChartProps {
  title: string;
  description?: string;
  data: Array<{ name: string; users: number; items: number }>;
  height?: number;
}

export function RegionsBarChart({ 
  title, 
  description, 
  data, 
  height = 300 
}: RegionsBarChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
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
            <BarChart data={data}>
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
              <Bar dataKey="users" fill="#18B2B0" name="المستخدمين" radius={[8, 8, 0, 0]} />
              <Bar dataKey="items" fill="#10B981" name="الأصناف" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
