import { createEmptyDeviceGraph } from "./device-graph.js";
import {
  createExtractionAttemptId,
  createExtractionSessionId,
  nowIso,
} from "./ids.js";
import type {
  DocumentRecord,
  ExtractionAttempt,
  ExtractionSession,
  RegistryBundle,
} from "./types.js";

export function createDocumentRecord(
  input: Omit<DocumentRecord, "created_at"> & { created_at?: string },
): DocumentRecord {
  return {
    ...input,
    created_at: input.created_at ?? nowIso(),
  };
}

export function openExtractionSession(args: {
  document_id: string;
  extraction_session_id?: string;
  document_type?: string;
  document_type_confidence?: number;
  registry_bundle_id?: string;
  created_at?: string;
  seq?: number;
}): ExtractionSession {
  return {
    extraction_session_id:
      args.extraction_session_id ?? createExtractionSessionId(new Date(), args.seq ?? 1),
    document_id: args.document_id,
    document_type: args.document_type,
    document_type_confidence: args.document_type_confidence,
    registry_bundle_id: args.registry_bundle_id,
    status: "open",
    created_at: args.created_at ?? nowIso(),
    attempt_ids: [],
  };
}

export function createQueuedAttempt(args: {
  session: ExtractionSession;
  attempt_number: number;
  bundle: RegistryBundle;
  grouping_provider: string;
  vision_provider: string;
  vision_model?: string;
  ranking_strategy?: string;
}): { session: ExtractionSession; attempt: ExtractionAttempt } {
  if (args.session.status !== "open") {
    throw new Error("Cannot create attempt on a closed session");
  }
  const extraction_attempt_id = createExtractionAttemptId(args.attempt_number);
  if (args.session.attempt_ids.includes(extraction_attempt_id)) {
    throw new Error(`Attempt id already exists: ${extraction_attempt_id}`);
  }
  const document_type = args.session.document_type ?? args.bundle.document_type;
  const attempt: ExtractionAttempt = {
    extraction_attempt_id,
    extraction_session_id: args.session.extraction_session_id,
    document_id: args.session.document_id,
    status: "queued",
    document_type,
    document_type_confidence: args.session.document_type_confidence ?? 0,
    registry_bundle_id: args.bundle.registry_bundle_id,
    schema_version: args.bundle.schema_version,
    prompt_version: args.bundle.prompt_version,
    validation_rules_version: args.bundle.validation_rules_version,
    business_rules_version: args.bundle.business_rules_version,
    grouping_provider: args.grouping_provider,
    vision_provider: args.vision_provider,
    vision_model: args.vision_model,
    ranking_strategy: args.ranking_strategy,
    device_graph: createEmptyDeviceGraph({
      extraction_session_id: args.session.extraction_session_id,
      extraction_attempt_id,
      document_id: args.session.document_id,
      document_type,
    }),
  };
  const session: ExtractionSession = {
    ...args.session,
    attempt_ids: [...args.session.attempt_ids, extraction_attempt_id],
  };
  return { session, attempt };
}

const TERMINAL: ReadonlySet<ExtractionAttempt["status"]> = new Set([
  "succeeded",
  "failed",
  "partial",
]);

export function assertAttemptMutable(attempt: ExtractionAttempt): void {
  if (TERMINAL.has(attempt.status)) {
    throw new Error(
      `Attempt ${attempt.extraction_attempt_id} is immutable (status=${attempt.status})`,
    );
  }
}

export function markAttemptRunning(attempt: ExtractionAttempt, started_at = nowIso()): ExtractionAttempt {
  assertAttemptMutable(attempt);
  return { ...attempt, status: "running", started_at };
}

export function finalizeAttempt(
  attempt: ExtractionAttempt,
  args: {
    status: "succeeded" | "failed" | "partial";
    device_graph: ExtractionAttempt["device_graph"];
    devices?: ExtractionAttempt["devices"];
    error?: ExtractionAttempt["error"];
    finished_at?: string;
  },
): ExtractionAttempt {
  assertAttemptMutable(attempt);
  return {
    ...attempt,
    status: args.status,
    device_graph: structuredClone(args.device_graph),
    devices: args.devices ? structuredClone(args.devices) : undefined,
    error: args.error,
    finished_at: args.finished_at ?? nowIso(),
  };
}

/** Reprocess policy: new attempt; prior attempts never overwritten. */
export function nextAttemptNumber(session: ExtractionSession): number {
  return session.attempt_ids.length + 1;
}
