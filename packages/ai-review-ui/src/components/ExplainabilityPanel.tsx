import type { CandidateView } from "../types.js";
import { isAmbiguousMatch } from "../model/workspace-state.js";
import { ConfidenceBadge, Panel } from "./ui-bits.js";

export function ExplainabilityPanel(props: { lines: string[] }) {
  return (
    <Panel title="تفسير المطابقة">
      <ul className="air-explain" aria-live="polite">
        {props.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Panel>
  );
}

export function CandidatePanel(props: { candidates: CandidateView[] }) {
  const ambiguous = isAmbiguousMatch(props.candidates);
  return (
    <Panel title={`مرشحو الفنيين (${props.candidates.length})`}>
      {ambiguous ? (
        <div className="air-ambiguity" role="status">
          غموض في المطابقة: أكثر من مرشح — يلزم مراجعة يدوية. جميع المرشحين معروضون أدناه.
        </div>
      ) : null}
      {props.candidates.length === 0 ? (
        <p className="air-muted">لا مرشحين</p>
      ) : (
        props.candidates.map((c) => (
          <article
            key={`${c.technician_id}-${c.execution_id}`}
            className={`air-candidate${ambiguous ? " ambiguous" : ""}`}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong>
                {c.technician_name} ({c.technician_id})
              </strong>
              <ConfidenceBadge value={c.confidence} />
            </div>
            <div className="air-muted">
              طلب {c.request_id} · تنفيذ {c.execution_id} · {c.branch} · {c.city}
            </div>
            <div className="air-muted">
              عهدة: {c.custody_state} · تركيب: {c.installation_status} · {c.confidence_band}
            </div>
            <div style={{ marginTop: "0.35rem" }} aria-label="أسباب المطابقة">
              {c.matched_reason.length === 0 ? (
                <div className="air-muted">لا أسباب مطابقة</div>
              ) : (
                c.matched_reason.map((r) => <div key={r}>✓ matched_reason: {r}</div>)
              )}
              {c.rejected_reason.map((r) => (
                <div key={r} style={{ color: "var(--air-danger)" }}>
                  ✗ سبب عدم المطابقة: {r}
                </div>
              ))}
            </div>
          </article>
        ))
      )}
    </Panel>
  );
}
