export type StagedUploadStatus =
  | 'uploading'
  | 'ready'
  | 'invalid'
  | 'failed'
  | 'submitted';

export interface StagedUploadRecord {
  uploadId: string;
  uploadSequence: number;
  sessionKey: string;
  originalName: string;
  submissionName: string;
  sizeBytes: number;
  extension: string;
  lastUpdated: string;
  progress: number;
  status: StagedUploadStatus;
  errorReason?: string;
  blob: Blob;
}
