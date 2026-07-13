import { useTranslation } from "@/lib/language";
import { useEffect, useRef, useState } from "react";

type AnimatedCounterProps = {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
  pulseOnChange?: boolean;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedCounter({
  value,
  duration = 900,
  className,
  format = (n) => new Intl.NumberFormat("ar-SA").format(Math.round(n)),
  pulseOnChange = true,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const [pulse, setPulse] = useState(false);
  const prev = useRef(0);
  const frame = useRef<number>();

  useEffect(() => {
    const from = prev.current;
    const to = Number.isFinite(value) ? value : 0;
    const start = performance.now();

    if (pulseOnChange && from !== to && from !== 0) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 450);
      return () => {
        window.clearTimeout(t);
        if (frame.current) cancelAnimationFrame(frame.current);
      };
    }

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = from + (to - from) * easeOutCubic(progress);
      setDisplay(next);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        prev.current = to;
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, pulseOnChange]);

  return (
    <span className={`${className ?? ""} ${pulse ? "em-value-pulse" : ""} tabular-nums`}>
      {format(display)}</span>
  );
}
