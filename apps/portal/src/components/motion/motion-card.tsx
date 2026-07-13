import { useTranslation } from "@/lib/language";
import {motion}from "framer-motion";
import { type ReactNode } from "react";
import {cn}from "@/lib/utils";

type MotionCardProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  float?: boolean;
};

export function MotionCard({
  children,
  className,
  delay = 0,
  float = false,
}: MotionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "em-card enterprise-glass-card rounded-[22px] bg-white border-2 border-[#18B2B0] shadow-card text-rassco-text",
        float && "em-float",
        className
      )}
    >
      {children}</motion.div>
  );
}
