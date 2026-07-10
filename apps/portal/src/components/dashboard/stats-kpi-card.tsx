import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatsKpiCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
  delay?: number;
}

export function StatsKpiCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = "primary",
  delay = 0
}: StatsKpiCardProps) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-600",
    warning: "bg-yellow-500/10 text-yellow-600",
    danger: "bg-red-500/10 text-red-600",
    info: "bg-blue-500/10 text-blue-600",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative overflow-hidden group"
    >
      <div className={`absolute inset-0 ${colorClasses[color as keyof typeof colorClasses] || 'bg-primary/10'} rounded-2xl opacity-10 group-hover:opacity-20 transition-opacity blur-xl`}></div>
      <Card className="relative overflow-hidden bg-white/10 backdrop-blur-xl border border-white/20 hover:border-white/30 transition-all duration-300 transform hover:scale-105">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">
            {title}
          </CardTitle>
          <div className={`p-2 rounded-full ${colorClasses[color as keyof typeof colorClasses] || colorClasses.primary}`}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{value}</div>
          {trend && (
            <p className={`text-xs ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% من الشهر الماضي
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
