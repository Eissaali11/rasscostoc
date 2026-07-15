import type {
  AiReviewWorkspaceFixture,
  CandidateView,
  DeviceRowView,
  PageView,
} from "../types.js";
import { createDemoReviewFixture } from "./demo-workspace.js";
import { graphFromDevices } from "./graph-from-devices.js";

export type UxScenarioId = "UX-1" | "UX-2" | "UX-3" | "UX-4" | "UX-5";

const TONES = ["#1e3a5f", "#3d2b1f", "#1f3d2b", "#3a1f3d", "#2b3d1f", "#1f2b3d"];

function makePages(count: number, quality = 88): PageView[] {
  return Array.from({ length: count }, (_, i) => ({
    page: i + 1,
    label: `صفحة ${i + 1}`,
    preview_tone: TONES[i % TONES.length]!,
    image_id: `img:ux:p${i + 1}:r1`,
    quality_score: quality,
  }));
}

function makeDevice(
  index: number,
  opts: {
    sn?: string;
    qualityField?: number;
    status?: string;
    nearDup?: boolean;
    withBBox?: boolean;
  } = {},
): DeviceRowView {
  const id = `device-${index}`;
  const page = ((index - 1) % 50) + 1;
  const imageId = `img:ux:p${page}:r1`;
  const sn = opts.sn ?? `SN-UX-${String(index).padStart(4, "0")}`;
  const conf = opts.qualityField ?? 90;
  const near = opts.nearDup === true;
  return {
    device_id: id,
    device_index: index,
    status: opts.status ?? "Review",
    serial_number: sn,
    sim_serial: near ? `SIM-NEAR-SHARED` : `SIM-UX-${index}`,
    tid: near ? `TID-NEAR-${sn.slice(-3)}` : `TID-UX-${index}`,
    merchant: near ? "تاجر متشابه" : `تاجر ${index}`,
    branch: near ? "فرع متشابه" : `فرع ${index}`,
    image_count: 1,
    extraction_confidence: conf,
    match_confidence: Math.max(40, conf - 5),
    fields: [
      {
        key: "serial_number",
        label: "الرقم التسلسلي",
        value: sn,
        confidence: conf,
        source_image_ids: [imageId],
        bbox: opts.withBBox ? { x: 0.1, y: 0.15, w: 0.5, h: 0.08 } : undefined,
      },
      {
        key: "sim_serial",
        label: "الشريحة",
        value: near ? "SIM-NEAR-SHARED" : `SIM-UX-${index}`,
        confidence: Math.max(30, conf - 5),
        source_image_ids: [imageId],
      },
      {
        key: "tid",
        label: "TID",
        value: near ? `TID-NEAR-${sn.slice(-3)}` : `TID-UX-${index}`,
        confidence: Math.max(30, conf - 8),
        source_image_ids: [imageId],
      },
      {
        key: "merchant",
        label: "التاجر",
        value: near ? "تاجر متشابه" : `تاجر ${index}`,
        confidence: Math.max(30, conf - 10),
        source_image_ids: [imageId],
      },
      {
        key: "branch",
        label: "الفرع",
        value: near ? "فرع متشابه" : `فرع ${index}`,
        confidence: Math.max(30, conf - 12),
        source_image_ids: [imageId],
      },
    ],
  };
}

function candidatesFor(ambiguous: boolean): CandidateView[] {
  if (!ambiguous) {
    return [
      {
        technician_id: "TECH-001",
        technician_name: "أحمد",
        request_id: 1000,
        execution_id: "EXE-A",
        branch: "الرياض",
        city: "الرياض",
        custody_state: "open",
        installation_status: "pending",
        confidence: 92,
        confidence_band: "recommended_review",
        matched_reason: ["الرقم التسلسلي", "الفرع"],
        rejected_reason: [],
      },
    ];
  }
  return [
    {
      technician_id: "TECH-001",
      technician_name: "أحمد",
      request_id: 2001,
      execution_id: "EXE-B1",
      branch: "الرياض",
      city: "الرياض",
      custody_state: "open",
      installation_status: "pending",
      confidence: 64,
      confidence_band: "manual_review_required",
      matched_reason: ["الرقم التسلسلي"],
      rejected_reason: ["تعارض / تعدد مرشحين"],
    },
    {
      technician_id: "TECH-003",
      technician_name: "خالد",
      request_id: 2002,
      execution_id: "EXE-B2",
      branch: "الدمام",
      city: "الدمام",
      custody_state: "open",
      installation_status: "pending",
      confidence: 63,
      confidence_band: "manual_review_required",
      matched_reason: ["الرقم التسلسلي"],
      rejected_reason: ["تعارض / تعدد مرشحين"],
    },
  ];
}

function baseShell(
  label: string,
  pages: PageView[],
  devices: DeviceRowView[],
  ambiguous = false,
  conflictPairs: Array<[string, string]> = [],
): AiReviewWorkspaceFixture {
  const candidates_by_device: AiReviewWorkspaceFixture["candidates_by_device"] = {};
  const explanation_by_device: AiReviewWorkspaceFixture["explanation_by_device"] = {};
  for (const d of devices) {
    candidates_by_device[d.device_id] = candidatesFor(ambiguous);
    explanation_by_device[d.device_id] = ambiguous
      ? ["تمت المطابقة بواسطة:", "✓ الرقم التسلسلي", "درجة الثقة: ~63%", "تعارض: أكثر من فني"]
      : ["تمت المطابقة بواسطة:", "✓ الرقم التسلسلي", "✓ الفرع", "درجة الثقة: 92%"];
  }
  const { graph_nodes, graph_edges } = graphFromDevices(devices, { conflictPairs });
  return {
    document_id: `doc-${label}`,
    document_label: label,
    sessions: [
      {
        extraction_session_id: "extract_ux",
        label: "جلسة UX",
        attempts: [{ extraction_attempt_id: "attempt_1", label: "محاولة 1", status: "succeeded" }],
      },
    ],
    active_session_id: "extract_ux",
    active_attempt_id: "attempt_1",
    pages,
    devices,
    candidates_by_device,
    explanation_by_device,
    graph_nodes,
    graph_edges,
    review_history: [],
  };
}

/** UX gate scenarios for `/ai-review?scenario=UX-1` … `UX-5`. */
export function createUxScenarioFixture(id: UxScenarioId): AiReviewWorkspaceFixture {
  switch (id) {
    case "UX-1":
      return baseShell("UX-1 · جهاز واحد", makePages(3), [makeDevice(1, { withBBox: true })]);
    case "UX-2":
      return baseShell(
        "UX-2 · 10 أجهزة",
        makePages(12),
        Array.from({ length: 10 }, (_, i) => makeDevice(i + 1, { withBBox: i === 0 })),
      );
    case "UX-3":
      return baseShell(
        "UX-3 · 100 جهاز (ضغط جدول)",
        makePages(50),
        Array.from({ length: 100 }, (_, i) => makeDevice(i + 1)),
      );
    case "UX-4":
      return baseShell(
        "UX-4 · صور ضعيفة الجودة",
        makePages(8, 22),
        Array.from({ length: 5 }, (_, i) =>
          makeDevice(i + 1, { qualityField: 28, status: "Review", withBBox: true }),
        ),
      );
    case "UX-5":
      return baseShell(
        "UX-5 · أجهزة متشابهة جدًا",
        makePages(6),
        [
          makeDevice(1, { sn: "SN-NEAR-001", nearDup: true }),
          makeDevice(2, { sn: "SN-NEAR-001", nearDup: true }),
          makeDevice(3, { sn: "SN-NEAR-002", nearDup: true }),
          makeDevice(4, { sn: "SN-NEAR-002", nearDup: true }),
        ],
        true,
        [
          ["device-1:serial_number", "device-2:serial_number"],
          ["device-3:serial_number", "device-4:serial_number"],
        ],
      );
    default:
      return createDemoReviewFixture();
  }
}

export function parseUxScenarioId(raw: string | null | undefined): UxScenarioId | null {
  if (!raw) return null;
  const id = raw.toUpperCase() as UxScenarioId;
  return ["UX-1", "UX-2", "UX-3", "UX-4", "UX-5"].includes(id) ? id : null;
}
