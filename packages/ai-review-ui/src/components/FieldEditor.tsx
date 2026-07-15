import type { DeviceRowView } from "../types.js";
import { ConfidenceBadge, Panel } from "./ui-bits.js";

export function FieldEditor(props: {
  device: DeviceRowView | null;
  selectedFieldKey: string | null;
  draftFields: Record<string, string>;
  onSelectField: (key: string) => void;
  onDraft: (key: string, value: string) => void;
  onCommit: () => void;
}) {
  if (!props.device) {
    return (
      <Panel title="الحقول">
        <p className="air-muted">اختر جهازًا من الجدول</p>
      </Panel>
    );
  }

  return (
    <Panel
      title={`حقول ${props.device.device_id}`}
      actions={
        <button type="button" className="air-btn" onClick={props.onCommit}>
          حفظ تصحيح محلي
        </button>
      }
    >
      <p className="air-muted" style={{ fontSize: "0.75rem", marginTop: 0 }}>
        التصحيح محلي في الذاكرة فقط — لا Apply ولا حفظ Courier.
      </p>
      <div className="air-field-list">
        {props.device.fields.map((f) => {
          const active = props.selectedFieldKey === f.key;
          const draft = props.draftFields[f.key];
          return (
            <div
              key={f.key}
              className={`air-field${active ? " active" : ""}`}
              onClick={() => props.onSelectField(f.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.onSelectField(f.key);
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`${f.label} — اضغط لإبراز الموقع في الصورة`}
            >
              <div className="air-field-top">
                <strong>{f.label}</strong>
                <ConfidenceBadge value={f.confidence} />
              </div>
              <input
                className="air-input"
                style={{ width: "100%" }}
                value={draft ?? f.value ?? ""}
                onChange={(e) => props.onDraft(f.key, e.target.value)}
                onFocus={() => props.onSelectField(f.key)}
                aria-describedby={`hint-${f.key}`}
              />
              <div id={`hint-${f.key}`} className="air-muted" style={{ fontSize: "0.7rem", marginTop: "0.25rem" }}>
                صور المصدر: {f.source_image_ids.join(", ") || "—"}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
