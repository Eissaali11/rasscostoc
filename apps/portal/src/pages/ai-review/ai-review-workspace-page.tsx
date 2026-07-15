import {
  AiReviewWorkspace,
  createDemoReviewFixture,
  createUxScenarioFixture,
  parseUxScenarioId,
} from "@stockpro/ai-review-ui";
import "@stockpro/ai-review-ui/styles.css";
import { useMemo } from "react";

/**
 * PR-006A-7 — Isolated AI Review Workspace host page.
 * Fixtures only. Optional: /ai-review?scenario=UX-1 … UX-5
 */
export default function AiReviewWorkspacePage() {
  const fixture = useMemo(() => {
    if (typeof window === "undefined") return createDemoReviewFixture();
    const raw = new URLSearchParams(window.location.search).get("scenario");
    const id = parseUxScenarioId(raw);
    return id ? createUxScenarioFixture(id) : createDemoReviewFixture();
  }, []);

  return <AiReviewWorkspace fixture={fixture} />;
}
