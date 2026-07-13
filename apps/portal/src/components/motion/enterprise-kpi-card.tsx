import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { type MouseEvent, type ReactNode, useCallback } from "react";
import { AnimatedCounter } from "./animated-counter";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/utils";

type Accent = "primary" | "warning" | "danger" | "gray";

const accentMap: Record<
  Accent,
  { bar: string; iconBg: string; iconText: string; spark: string }
> = {
  primary: {
    bar: "bg-primary",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
    spark: "#0066CC",
  },
  warning: {
    bar: "bg-warning",
    iconBg: "bg-warning/15",
    iconText: "text-warning",
    spark: "#F59E0B",
  },
  danger: {
    bar: "bg-destructive",
    iconBg: "bg-destructive/10",
    iconText: "text-destructive",
    spark: "#EF4444",
  },
  gray: {
    bar: "bg-secondary",
    iconBg: "bg-secondary/10",
    iconText: "text-secondary",
    spark: "#64748B",
  },
};

export type EnterpriseKpiCardProps = {
  title: string;
  value: number;
  icon: LucideIcon;
  accent?: Accent;
  delay?: number;
  footer?: ReactNode;
  sparkPoints?: number[];
  valueClassName?: string;
  format?: (n: number) => string;
  onClick?: () => void;
  live?: boolean;
};

export function EnterpriseKpiCard({
  title,
  value,
  icon: Icon,
  accent = "primary",
  delay = 0,
  footer,
  sparkPoints,
  valueClassName,
  format,
  onClick,
  live = true,
}: EnterpriseKpiCardProps) {
  const theme = accentMap[accent];

  const onRipple = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--rx", `${x}%`);
    e.currentTarget.style.setProperty("--ry", `${y}%`);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "em-kpi em-ripple em-float enterprise-glass-card rounded-[22px] bg-white border-2 border-primary/30 shadow-md relative overflow-hidden text-foreground",
        delay > 0.15 && "em-float-delay-1",
        delay > 0.3 && "em-float-delay-2",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
      onMouseDown={onRipple}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <div className={cn("absolute top-0 inset-x-0 h-1.5", theme.bar)} />
      {live && (
        <span
          className={cn(
            "absolute top-4 left-4 size-2.5 rounded-full em-live-pulse",
            theme.bar
          )}
          aria-hidden
        />
      )}

      <div className="relative z-[1] p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-base font-semibold text-muted-foreground leading-snug">
            {title}
          </span>
          <div
            className={cn(
              "em-kpi-icon size-12 rounded-2xl flex items-center justify-center shrink-0",
              theme.iconBg
            )}
          >
            <Icon className={cn("h-6 w-6", theme.iconText)} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <AnimatedCounter
            value={value}
            format={format}
            className={cn(
              "text-4xl md:text-[2.75rem] font-bold tracking-tight text-foreground leading-none",
              valueClassName
            )}
          />
          <Sparkline points={sparkPoints} color={theme.spark} />
        </div>

        {footer && (
          <div className="pt-3 border-t border-border text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </motion.div>
  );
}
