import type { ReactNode } from "react";
import { confidenceBandLabel, confidenceTone } from "../model/confidence.js";

export function ConfidenceBadge({ value }: { value: number }) {
  const tone = confidenceTone(value);
  const band = confidenceBandLabel(value);
  return (
    <span
      className={`air-badge ${tone}`}
      aria-label={`ثقة ${band} · ${value} بالمئة`}
      title={`${band} (${value}%)`}
    >
      {band} · {value}%
    </span>
  );
}

export function Panel({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="air-panel" aria-label={title}>
      <div className="air-panel-h">
        <span>{title}</span>
        {actions}
      </div>
      <div className="air-panel-b">{children}</div>
    </section>
  );
}
