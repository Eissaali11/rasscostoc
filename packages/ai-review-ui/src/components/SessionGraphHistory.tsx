import type { GraphEdgeView, GraphNodeView, ReviewVersionView, SessionOption } from "../types.js";
import { Panel } from "./ui-bits.js";

const KIND_AR: Record<string, string> = {
  device: "جهاز",
  sn: "الرقم التسلسلي",
  serial_number: "الرقم التسلسلي",
  identifier: "معرّف",
  sim: "الشريحة",
  sim_serial: "الشريحة",
  tid: "TID",
  merchant: "التاجر",
  branch: "الفرع",
  commercial: "تجاري",
};

const EDGE_AR: Record<string, string> = {
  belongs_to_device: "ينتمي للجهاز",
  related_to: "مرتبط بـ",
  conflicts_with: "تعارض مع",
  co_located_on_page: "في نفس الصفحة مع",
};

export function GraphReadonly(props: {
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  focusDeviceId: string | null;
}) {
  const nodes = props.focusDeviceId
    ? props.nodes.filter((n) => !n.device_id || n.device_id === props.focusDeviceId)
    : props.nodes;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = props.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  const conflicts = edges.filter((e) => e.type === "conflicts_with");

  return (
    <Panel title="رسم الجهاز (قراءة فقط)">
      {conflicts.length > 0 ? (
        <div className="air-ambiguity" role="status">
          يوجد تعارض مرئي في العلاقات ({conflicts.length}) — لم يُخفَ.
        </div>
      ) : null}
      <div className="air-graph" aria-label="رسم بياني للأجهزة">
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`air-graph-node${n.kind === "device" ? " device" : ""}`}
          >
            <strong>{KIND_AR[n.kind] ?? n.kind}</strong> · {n.label}
          </div>
        ))}
        {edges.map((e) => (
          <div
            key={e.id}
            className={`air-graph-edge${e.type === "conflicts_with" ? " conflict" : ""}`}
          >
            {EDGE_AR[e.type] ?? e.type}: {e.from} ←→ {e.to}
          </div>
        ))}
        {nodes.length === 0 ? <p className="air-muted">لا عقد</p> : null}
      </div>
    </Panel>
  );
}

export function ReviewHistory(props: { history: ReviewVersionView[]; deviceId: string | null }) {
  const items = props.history.filter((h) => !props.deviceId || h.device_id === props.deviceId);
  return (
    <Panel title="سجل المراجعات (نسخ إصدارات)">
      <div className="air-history">
        {items.length === 0 ? (
          <p className="air-muted">لا إصدارات بعد</p>
        ) : (
          items.map((h) => (
            <div key={`${h.device_id}-${h.review_version}`} className="air-history-item">
              <div>
                v{h.review_version} · {h.device_id} · {h.edited_by}
              </div>
              <div className="air-muted">{h.edited_at}</div>
              {h.reason ? <div>{h.reason}</div> : null}
              {h.field_diffs.map((d) => (
                <div key={d.field} className="air-muted">
                  {d.field}: {String(d.before)} → {String(d.after)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

export function SessionAttemptBar(props: {
  sessions: SessionOption[];
  sessionId: string;
  attemptId: string;
  onChange: (sessionId: string, attemptId: string) => void;
}) {
  const session =
    props.sessions.find((s) => s.extraction_session_id === props.sessionId) ?? props.sessions[0];
  const attempts = session?.attempts ?? [];

  return (
    <div className="air-selects" role="group" aria-label="اختيار الجلسة والمحاولة">
      <label>
        الجلسة
        <select
          value={props.sessionId}
          onChange={(e) => {
            const sid = e.target.value;
            const s = props.sessions.find((x) => x.extraction_session_id === sid);
            const aid = s?.attempts[0]?.extraction_attempt_id ?? props.attemptId;
            props.onChange(sid, aid);
          }}
        >
          {props.sessions.map((s) => (
            <option key={s.extraction_session_id} value={s.extraction_session_id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        المحاولة
        <select
          value={props.attemptId}
          onChange={(e) => props.onChange(props.sessionId, e.target.value)}
        >
          {attempts.map((a) => (
            <option key={a.extraction_attempt_id} value={a.extraction_attempt_id}>
              {a.label} ({a.status})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
