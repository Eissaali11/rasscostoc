import { motion } from "framer-motion";

interface CircularProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  value: string;
  color?: string;
  glowColor?: string;
}

export const CircularProgress = ({
  percentage,
  size = 120,
  strokeWidth = 8,
  label,
  value,
  color = "#18B2B0",
  glowColor = "rgba(24, 178, 176, 0.4)"
}: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <defs>
          <filter id={`glow-${label}`}>
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
        />

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          filter={`url(#glow-${label})`}
          initial={{ strokeDashoffset: circumference, opacity: 0 }}
          animate={{
            strokeDashoffset: offset,
            opacity: 1,
            rotate: [0, 360]
          }}
          transition={{
            strokeDashoffset: { duration: 2, ease: "easeOut" },
            opacity: { duration: 0.5 },
            rotate: { duration: 20, repeat: Infinity, ease: "linear" }
          }}
        />

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth * 0.5}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          opacity={0.3}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: offset,
            rotate: [0, -360]
          }}
          transition={{
            strokeDashoffset: { duration: 2, ease: "easeOut" },
            rotate: { duration: 15, repeat: Infinity, ease: "linear" }
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="text-center w-full px-3 flex flex-col items-center justify-center gap-1"
        >
          <div
            className="text-2xl lg:text-3xl font-bold leading-none"
            style={{ color }}
          >
            {value}
          </div>
          <div
            className="text-xs lg:text-sm font-semibold leading-tight"
            style={{ color }}
          >
            {label}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
