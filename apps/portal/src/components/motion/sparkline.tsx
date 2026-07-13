import { useTranslation } from "@/lib/language";
type SparklineProps = {
  points?: number[];
  color?: string;
  className?: string;
};

export function Sparkline({
  points = [28, 36, 32, 48, 42, 58, 52, 64],
  color = "#18B2B0",
  className,
}: SparklineProps) {
  const w = 96;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1);

  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const area = `0,${h}${coords}${w},${h}`;

  return (
    <svg
      viewBox={`0 0 ${w}${h}`}
      className={`em-sparkline w-24 h-7 ${className ?? ""}`}
      aria-hidden
    >
      <polygon points={area}fill={color}opacity={0.12}/>
      <polyline
        points={coords}fill="none"
        stroke={color}strokeWidth={2}strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={120}/>
    </svg>
  );
}
