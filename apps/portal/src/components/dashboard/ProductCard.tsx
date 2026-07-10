import { motion } from "framer-motion";
import { Package, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  icon: React.ReactNode;
  title: string;
  boxes: number;
  units: number;
  color: string;
  gradient: string;
  index: number;
}

export const ProductCard = ({ icon, title, boxes, units, color, gradient, index }: ProductCardProps) => {
  const total = boxes + units;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="relative group"
    >
      <div className={`relative bg-gradient-to-br ${gradient} backdrop-blur-xl rounded-xl md:rounded-2xl border border-white/10 p-4 md:p-6 overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300`}>
        {/* Animated Background Glow */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${color}20, transparent 70%)`
          }}
        />
        
        {/* Shimmer Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        </div>

        <div className="relative z-10">
          {/* Header with Icon */}
          <div className="flex items-start justify-between mb-3 md:mb-4">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
              className={`p-2 md:p-3 rounded-lg md:rounded-xl bg-white/10 backdrop-blur-sm border border-white/20`}
              style={{ color }}
            >
              {icon}
            </motion.div>
            
            {total > 0 && (
              <Badge 
                className="bg-white/20 backdrop-blur-sm text-white border-white/30 font-bold px-2 py-0.5 md:px-3 md:py-1 text-xs md:text-sm"
                style={{ borderColor: color }}
              >
                {total} وحدة
              </Badge>
            )}
          </div>

          {/* Product Title */}
          <h4 className="text-white font-bold text-base md:text-lg mb-3 md:mb-4">{title}</h4>

          {/* Boxes and Units Display */}
          <div className="space-y-2 md:space-y-3">
            {/* Boxes */}
            <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm rounded-lg md:rounded-xl p-2 md:p-3 border border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 md:p-2 rounded-md md:rounded-lg bg-white/10">
                  <Package className="h-3 w-3 md:h-4 md:w-4 text-white" />
                </div>
                <span className="text-gray-300 text-xs md:text-sm">صناديق</span>
              </div>
              <motion.span 
                key={boxes}
                initial={{ scale: 1.2, color }}
                animate={{ scale: 1, color: "#fff" }}
                className="text-white font-bold text-lg md:text-xl"
              >
                {boxes}
              </motion.span>
            </div>

            {/* Units */}
            <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm rounded-lg md:rounded-xl p-2 md:p-3 border border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 md:p-2 rounded-md md:rounded-lg bg-white/10">
                  <Box className="h-3 w-3 md:h-4 md:w-4 text-white" />
                </div>
                <span className="text-gray-300 text-xs md:text-sm">وحدات</span>
              </div>
              <motion.span
                key={units}
                initial={{ scale: 1.2, color }}
                animate={{ scale: 1, color: "#fff" }}
                className="text-white font-bold text-lg md:text-xl"
              >
                {units}
              </motion.span>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-3 md:mt-4">
            <div className="flex items-center justify-between text-[10px] md:text-xs text-gray-400 mb-1">
              <span>مستوى المخزون</span>
              <span>{total > 50 ? 'ممتاز' : total > 20 ? 'جيد' : total > 0 ? 'منخفض' : 'فارغ'}</span>
            </div>
            <div className="h-1.5 md:h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (total / 100) * 100)}%` }}
                transition={{ delay: index * 0.1, duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${color}, ${color}dd)` }}
              />
            </div>
          </div>
        </div>

        {/* Corner Decoration */}
        <div 
          className="absolute top-0 right-0 w-24 h-24 opacity-10"
          style={{ 
            background: `radial-gradient(circle at top right, ${color}, transparent)` 
          }}
        />
      </div>
    </motion.div>
  );
};
