export type JobStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface ProgressDetails {
  processedRows: number;
  totalRows: number;
  etaSeconds?: number;
  currentStep?: string; // e.g., 'Reading' | 'Filtering' | 'Streaming' | 'Compressing' | 'Uploading' | 'Completed'
}

export interface ResultMetadata {
  url: string;
  size?: number;
  mime?: string;
  checksum?: string;
  expires?: string;
}

export interface JobPayload<T = any> {
  params: T;
}

export type JobHandler = (
  job: any,
  updateProgress: (progress: number, details?: ProgressDetails) => Promise<void>
) => Promise<ResultMetadata | string>;

