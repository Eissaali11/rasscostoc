import type {
  DocumentRecord,
  ExtractionAttempt,
  ExtractionSession,
  FeedbackRecord,
  ReviewVersion,
} from "../../domain/types.js";
import type {
  AttemptRepository,
  DocumentRepository,
  FeedbackRepository,
  ReviewRepository,
  SessionRepository,
} from "../../ports/repositories.js";

const TERMINAL = new Set(["succeeded", "failed", "partial"]);

export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly store = new Map<string, DocumentRecord>();

  async save(doc: DocumentRecord): Promise<void> {
    this.store.set(doc.document_id, structuredClone(doc));
  }

  async getById(document_id: string): Promise<DocumentRecord | null> {
    const hit = this.store.get(document_id);
    return hit ? structuredClone(hit) : null;
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly store = new Map<string, ExtractionSession>();

  async save(session: ExtractionSession): Promise<void> {
    this.store.set(session.extraction_session_id, structuredClone(session));
  }

  async getById(extraction_session_id: string): Promise<ExtractionSession | null> {
    const hit = this.store.get(extraction_session_id);
    return hit ? structuredClone(hit) : null;
  }

  async listByDocument(document_id: string): Promise<ExtractionSession[]> {
    return [...this.store.values()]
      .filter((s) => s.document_id === document_id)
      .map((s) => structuredClone(s));
  }
}

export class InMemoryAttemptRepository implements AttemptRepository {
  private key(sessionId: string, attemptId: string): string {
    return `${sessionId}::${attemptId}`;
  }

  private readonly store = new Map<string, ExtractionAttempt>();

  async save(attempt: ExtractionAttempt): Promise<void> {
    const k = this.key(attempt.extraction_session_id, attempt.extraction_attempt_id);
    const existing = this.store.get(k);
    if (existing && TERMINAL.has(existing.status)) {
      throw new Error(
        `Refusing to overwrite immutable attempt ${attempt.extraction_attempt_id}`,
      );
    }
    this.store.set(k, structuredClone(attempt));
  }

  async getById(
    extraction_session_id: string,
    extraction_attempt_id: string,
  ): Promise<ExtractionAttempt | null> {
    const hit = this.store.get(this.key(extraction_session_id, extraction_attempt_id));
    return hit ? structuredClone(hit) : null;
  }

  async listBySession(extraction_session_id: string): Promise<ExtractionAttempt[]> {
    return [...this.store.values()]
      .filter((a) => a.extraction_session_id === extraction_session_id)
      .map((a) => structuredClone(a));
  }
}

export class InMemoryReviewRepository implements ReviewRepository {
  private readonly store: ReviewVersion[] = [];

  async append(review: ReviewVersion): Promise<void> {
    this.store.push(structuredClone(review));
  }

  async listByDevice(
    extraction_attempt_id: string,
    device_id: string,
  ): Promise<ReviewVersion[]> {
    return this.store
      .filter(
        (r) =>
          r.extraction_attempt_id === extraction_attempt_id && r.device_id === device_id,
      )
      .map((r) => structuredClone(r));
  }
}

export class InMemoryFeedbackRepository implements FeedbackRepository {
  private readonly store: FeedbackRecord[] = [];

  async save(record: FeedbackRecord): Promise<void> {
    this.store.push(structuredClone(record));
  }

  async listBySession(extraction_session_id: string): Promise<FeedbackRecord[]> {
    return this.store
      .filter((r) => r.extraction_session_id === extraction_session_id)
      .map((r) => structuredClone(r));
  }
}

export type MemoryPersistence = {
  documents: InMemoryDocumentRepository;
  sessions: InMemorySessionRepository;
  attempts: InMemoryAttemptRepository;
  reviews: InMemoryReviewRepository;
  feedback: InMemoryFeedbackRepository;
};

export function createMemoryPersistence(): MemoryPersistence {
  return {
    documents: new InMemoryDocumentRepository(),
    sessions: new InMemorySessionRepository(),
    attempts: new InMemoryAttemptRepository(),
    reviews: new InMemoryReviewRepository(),
    feedback: new InMemoryFeedbackRepository(),
  };
}
