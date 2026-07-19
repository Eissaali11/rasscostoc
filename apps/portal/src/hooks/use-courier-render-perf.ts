import { useEffect, useRef } from "react";

type CourierPerfPage = "verification" | "raw_data" | "reports";

interface ClientTimingPayload {
  name: string;
  page: CourierPerfPage;
  renderMs: number;
  networkMs?: number;
  ttfbMs?: number;
  paintMs?: number;
  transferSize?: number;
}

/**
 * ERP-001 / Sprint 1.5: SQL is measured server-side (X-SQL-Time-Ms).
 * This hook records client Render, Network, TTFB, and first paint.
 */
export function useCourierRenderPerf(page: CourierPerfPage) {
  const started = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;

    const send = () => {
      if (sent.current) return;
      sent.current = true;

      const renderMs = Math.round(performance.now() - started.current);

      let networkMs: number | undefined;
      let ttfbMs: number | undefined;
      let transferSize: number | undefined;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const apiHit = [...resources]
        .reverse()
        .find((r) => typeof r.name === "string" && r.name.includes("/api/courier/requests"));
      if (apiHit) {
        networkMs = Math.round(apiHit.duration);
        ttfbMs = Math.round(apiHit.responseStart - apiHit.requestStart);
        transferSize = apiHit.transferSize || undefined;
      }

      let paintMs: number | undefined;
      const paints = performance.getEntriesByType("paint") as PerformanceEntry[];
      const fcp = paints.find((p) => p.name === "first-contentful-paint");
      if (fcp) paintMs = Math.round(fcp.startTime);

      const payload: ClientTimingPayload = {
        name: "courier_client_render_ms",
        page,
        renderMs,
        networkMs,
        ttfbMs,
        paintMs,
        transferSize,
      };

      void fetch("/api/observability/client-timing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(payload),
        credentials: "include",
        keepalive: true,
      }).catch(() => {
        /* ignore */
      });
    };

    // Allow list fetch + paint to settle briefly
    const t = window.setTimeout(send, 400);
    return () => window.clearTimeout(t);
  }, [page]);
}
