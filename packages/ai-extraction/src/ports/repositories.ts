import type {
  DocumentRecord,
  ExtractionAttempt,
  ExtractionSession,
  FeedbackRecord,
  ReviewVersion,
} from "../domain/types.js";

export interface DocumentRepository {
  save(doc: DocumentRecord): Promise<void>;
  getById(document_id: string): Promise<DocumentRecord | null>;
}

export interface SessionRepository {
  save(session: ExtractionSession): Promise<void>;
  getById(extraction_session_id: string): Promise<ExtractionSession | null>;
  listByDocument(document_id: string): Promise<ExtractionSession[]>;
}

export interface AttemptRepository {
  save(attempt: ExtractionAttempt): Promise<void>;
  getById(
    extraction_session_id: string,
    extraction_attempt_id: string,
  ): Promise<ExtractionAttempt | null>;
  listBySession(extraction_session_id: string): Promise<ExtractionAttempt[]>;
}

export interface ReviewRepository {
  append(review: ReviewVersion): Promise<void>;
  listByDevice(
    extraction_attempt_id: string,
    device_id: string,
  ): Promise<ReviewVersion[]>;
}

export interface FeedbackRepository {
  save(record: FeedbackRecord): Promise<void>;
  listBySession(extraction_session_id: string): Promise<FeedbackRecord[]>;
}
