import type { AiReviewWorkspaceFixture } from "../types.js";
import { graphFromDevices } from "./graph-from-devices.js";

/** In-memory demo workspace — no Courier / no live providers. */
export function createDemoReviewFixture(): AiReviewWorkspaceFixture {
  const devices: AiReviewWorkspaceFixture["devices"] = [
    {
      device_id: "device-1",
      device_index: 1,
      status: "Review",
      serial_number: "SN-EXACT-001",
      sim_serial: "SIM-EXACT-001",
      tid: "TID-EXACT-001",
      merchant: "تاجر الدقيقة",
      branch: "الرياض - العليا",
      image_count: 2,
      extraction_confidence: 91,
      match_confidence: 96,
      fields: [
        {
          key: "serial_number",
          label: "الرقم التسلسلي",
          value: "SN-EXACT-001",
          confidence: 97,
          source_image_ids: ["img:doc-demo-001:p1:r1"],
          bbox: { x: 0.12, y: 0.18, w: 0.55, h: 0.08 },
        },
        {
          key: "sim_serial",
          label: "الشريحة",
          value: "SIM-EXACT-001",
          confidence: 90,
          source_image_ids: ["img:doc-demo-001:p1:r1"],
          bbox: { x: 0.12, y: 0.32, w: 0.5, h: 0.07 },
        },
        {
          key: "tid",
          label: "TID",
          value: "TID-EXACT-001",
          confidence: 95,
          source_image_ids: ["img:doc-demo-001:p2:r1"],
          bbox: { x: 0.2, y: 0.4, w: 0.4, h: 0.08 },
        },
        {
          key: "merchant",
          label: "التاجر",
          value: "تاجر الدقيقة",
          confidence: 88,
          source_image_ids: ["img:doc-demo-001:p2:r1"],
          bbox: { x: 0.15, y: 0.55, w: 0.6, h: 0.1 },
        },
        {
          key: "branch",
          label: "الفرع",
          value: "الرياض - العليا",
          confidence: 85,
          source_image_ids: ["img:doc-demo-001:p2:r1"],
        },
      ],
    },
    {
      device_id: "device-2",
      device_index: 2,
      status: "Review",
      serial_number: "SN-DUP-900",
      sim_serial: null,
      tid: null,
      merchant: "تاجر مكرر",
      branch: "الدمام",
      image_count: 1,
      extraction_confidence: 72,
      match_confidence: 61,
      fields: [
        {
          key: "serial_number",
          label: "الرقم التسلسلي",
          value: "SN-DUP-900",
          confidence: 94,
          source_image_ids: ["img:doc-demo-001:p3:r1"],
          bbox: { x: 0.1, y: 0.2, w: 0.5, h: 0.09 },
        },
        {
          key: "merchant",
          label: "التاجر",
          value: "تاجر مكرر",
          confidence: 70,
          source_image_ids: ["img:doc-demo-001:p3:r1"],
        },
        {
          key: "branch",
          label: "الفرع",
          value: "الدمام",
          confidence: 65,
          source_image_ids: ["img:doc-demo-001:p3:r1"],
        },
      ],
    },
  ];

  const { graph_nodes, graph_edges } = graphFromDevices(devices, {
    conflictPairs: [["device-1:serial_number", "device-2:serial_number"]],
  });

  return {
    document_id: "doc-demo-001",
    document_label: "تقرير تركيب تجريبي (Fixture)",
    sessions: [
      {
        extraction_session_id: "extract_20260714_000100",
        label: "جلسة 1",
        attempts: [
          { extraction_attempt_id: "attempt_1", label: "محاولة 1 (prompt_v1)", status: "succeeded" },
          { extraction_attempt_id: "attempt_2", label: "محاولة 2 (prompt_v2)", status: "succeeded" },
        ],
      },
      {
        extraction_session_id: "extract_20260714_000200",
        label: "جلسة 2",
        attempts: [
          { extraction_attempt_id: "attempt_1", label: "محاولة 1", status: "partial" },
        ],
      },
    ],
    active_session_id: "extract_20260714_000100",
    active_attempt_id: "attempt_2",
    pages: [
      {
        page: 1,
        label: "صفحة 1",
        preview_tone: "#1e3a5f",
        image_id: "img:doc-demo-001:p1:r1",
        quality_score: 92,
      },
      {
        page: 2,
        label: "صفحة 2",
        preview_tone: "#3d2b1f",
        image_id: "img:doc-demo-001:p2:r1",
        quality_score: 78,
      },
      {
        page: 3,
        label: "صفحة 3",
        preview_tone: "#1f3d2b",
        image_id: "img:doc-demo-001:p3:r1",
        quality_score: 88,
      },
    ],
    devices,
    candidates_by_device: {
      "device-1": [
        {
          technician_id: "TECH-001",
          technician_name: "أحمد",
          request_id: 1001,
          execution_id: "EXE-1001",
          branch: "الرياض - العليا",
          city: "الرياض",
          custody_state: "open",
          installation_status: "pending",
          confidence: 96,
          confidence_band: "auto_match_candidate",
          matched_reason: ["الرقم التسلسلي", "اسم التاجر", "الفرع"],
          rejected_reason: [],
        },
      ],
      "device-2": [
        {
          technician_id: "TECH-001",
          technician_name: "أحمد",
          request_id: 3001,
          execution_id: "EXE-3001A",
          branch: "الرياض - العليا",
          city: "الرياض",
          custody_state: "open",
          installation_status: "pending",
          confidence: 62,
          confidence_band: "manual_review_required",
          matched_reason: ["الرقم التسلسلي", "اسم التاجر"],
          rejected_reason: ["تعارض / تعدد مرشحين — يلزم مراجعة"],
        },
        {
          technician_id: "TECH-003",
          technician_name: "خالد",
          request_id: 3002,
          execution_id: "EXE-3001B",
          branch: "الدمام",
          city: "الدمام",
          custody_state: "open",
          installation_status: "pending",
          confidence: 61,
          confidence_band: "manual_review_required",
          matched_reason: ["الرقم التسلسلي", "اسم التاجر"],
          rejected_reason: ["تعارض / تعدد مرشحين — يلزم مراجعة"],
        },
      ],
    },
    explanation_by_device: {
      "device-1": [
        "تمت المطابقة بواسطة:",
        "✓ الرقم التسلسلي",
        "✓ اسم التاجر",
        "✓ الفرع",
        "درجة الثقة: 96%",
      ],
      "device-2": [
        "تمت المطابقة بواسطة:",
        "✓ الرقم التسلسلي",
        "✓ اسم التاجر",
        "درجة الثقة: 62%",
        "تعارض: أكثر من فني محتمل",
      ],
    },
    graph_nodes,
    graph_edges,
    review_history: [
      {
        review_version: 1,
        device_id: "device-1",
        edited_by: "reviewer-demo",
        edited_at: "2026-07-14T08:00:00.000Z",
        reason: "تصحيح تجريبي",
        field_diffs: [{ field: "branch", before: "الرياض", after: "الرياض - العليا" }],
      },
    ],
  };
}
