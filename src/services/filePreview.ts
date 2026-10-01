import type { StagedUploadRecord } from '../types/stagedUpload';
import { formatFileSize } from '../utils/fileSize';

export type FilePreviewType = 'text' | 'image' | 'archive' | 'metadata';

export const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;

const textExtensions = new Set([
  '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
  '.html', '.css', '.json', '.xml', '.txt', '.md', '.sql', '.sh', '.bat', '.ps1',
  '.yaml', '.yml',
]);

const imageMimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export const getFilePreviewType = (record: StagedUploadRecord): FilePreviewType => {
  if (!(record.blob instanceof Blob)) return 'metadata';
  const extension = record.extension.toLowerCase();
  const mimeType = record.blob.type.toLowerCase();
  // Both fields are user-controlled hints, never evidence of trusted content.
  // Unknown types and image/MIME mismatches fall back to metadata; no type executes.
  if (extension === '.svg') return 'metadata';
  if (extension === '.zip') {
    return !mimeType || mimeType === 'application/zip' ||
      mimeType === 'application/x-zip-compressed' || mimeType === 'application/octet-stream'
      ? 'archive' : 'metadata';
  }
  if (imageMimeTypes[extension]) {
    return mimeType === imageMimeTypes[extension] ? 'image' : 'metadata';
  }
  if (textExtensions.has(extension) && !/^(image|audio|video)\//.test(mimeType)) return 'text';
  return 'metadata';
};

export const getFilePreviewMetadata = (record: StagedUploadRecord) => ({
  filename: record.submissionName,
  originalName: record.originalName,
  extension: record.extension ? record.extension.slice(1).toUpperCase() : 'ไม่ทราบประเภท',
  mimeType: record.blob instanceof Blob && record.blob.type ? record.blob.type : 'ไม่ระบุ',
  size: formatFileSize(record.sizeBytes),
});

export const readTextPreview = async (record: StagedUploadRecord): Promise<string | null> => {
  if (getFilePreviewType(record) !== 'text' || record.sizeBytes > MAX_TEXT_PREVIEW_BYTES ||
    record.blob.size > MAX_TEXT_PREVIEW_BYTES) return null;
  return record.blob.text();
};

export const findCurrentAttemptPreviewFile = (
  records: StagedUploadRecord[], sessionKey: string, uploadId: string,
): StagedUploadRecord | undefined => records.find((record) =>
  record.sessionKey === sessionKey && record.uploadId === uploadId);
