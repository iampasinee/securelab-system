import { BlobReader, ZipReader } from '@zip.js/zip.js';
import type { StagedUploadRecord } from '../types/stagedUpload';
import { getFilePreviewType } from './filePreview';

// These are preview budgets, not upload/submission limits. Entry data is never decompressed.
export const ZIP_PREVIEW_LIMITS = {
  maxArchiveBytes: 50 * 1024 * 1024,
  maxEntries: 1000,
  maxDepth: 20,
  maxPathLength: 512,
  maxReportedUncompressedBytes: 250 * 1024 * 1024,
  maxExpansionRatio: 1000,
} as const;

export const ZIP_PREVIEW_UNSAFE_MESSAGE = 'ไฟล์ ZIP มีขนาดหรือจำนวนรายการมากเกินกว่าจะแสดงโครงสร้างอย่างปลอดภัย';
export const ZIP_PREVIEW_UNAVAILABLE_MESSAGE = 'ไม่สามารถอ่านโครงสร้างไฟล์ ZIP ได้';

export interface ArchiveTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'folder';
  sizeBytes?: number;
  children: ArchiveTreeNode[];
}

export type ArchivePreviewResult =
  | {
    status: 'ready';
    tree: ArchiveTreeNode[];
    suspiciousPaths: string[];
    fileCount: number;
    folderCount: number;
    totalUncompressedBytes: number;
    entryCount: number;
  }
  | { status: 'unsafe' | 'unavailable'; message: string };

export const normalizeZipEntryPath = (path: string): { segments: string[]; suspicious: boolean } => {
  const normalized = path.replaceAll('\\', '/');
  const segments = normalized.split('/').filter(Boolean);
  const suspicious = normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    segments.some((segment) => segment === '.' || segment === '..');
  return { segments, suspicious };
};

const sortTree = (nodes: ArchiveTreeNode[]): void => {
  nodes.sort((a, b) => a.kind === b.kind ? a.name.localeCompare(b.name, 'th') : a.kind === 'folder' ? -1 : 1);
  nodes.forEach((node) => sortTree(node.children));
};

/** Reads ZIP central-directory metadata only. Never calls entry.getData() or writes files. */
export const inspectZipStructure = async (record: StagedUploadRecord): Promise<ArchivePreviewResult> => {
  if (getFilePreviewType(record) !== 'archive') {
    return { status: 'unavailable', message: ZIP_PREVIEW_UNAVAILABLE_MESSAGE };
  }
  if (record.blob.size > ZIP_PREVIEW_LIMITS.maxArchiveBytes) {
    return { status: 'unsafe', message: ZIP_PREVIEW_UNSAFE_MESSAGE };
  }

  const reader = new ZipReader(new BlobReader(record.blob));
  try {
    const tree: ArchiveTreeNode[] = [];
    const nodesByPath = new Map<string, ArchiveTreeNode>();
    const suspiciousPaths: string[] = [];
    let entryCount = 0;
    let fileCount = 0;
    let folderCount = 0;
    let totalUncompressedBytes = 0;

    for await (const entry of reader.getEntriesGenerator()) {
      entryCount += 1;
      if (entryCount > ZIP_PREVIEW_LIMITS.maxEntries) {
        return { status: 'unsafe', message: ZIP_PREVIEW_UNSAFE_MESSAGE };
      }
      // Encrypted central directories may fail during parsing; encrypted entries are not inspected.
      if (entry.encrypted) {
        return { status: 'unavailable', message: ZIP_PREVIEW_UNAVAILABLE_MESSAGE };
      }
      const { segments, suspicious } = normalizeZipEntryPath(entry.filename);
      if (!segments.length || entry.filename.length > ZIP_PREVIEW_LIMITS.maxPathLength ||
        segments.length > ZIP_PREVIEW_LIMITS.maxDepth) {
        return { status: 'unsafe', message: ZIP_PREVIEW_UNSAFE_MESSAGE };
      }
      if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 ||
        !Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0) {
        return { status: 'unsafe', message: ZIP_PREVIEW_UNSAFE_MESSAGE };
      }
      if (!entry.directory) {
        fileCount += 1;
        totalUncompressedBytes += entry.uncompressedSize;
        if (totalUncompressedBytes > ZIP_PREVIEW_LIMITS.maxReportedUncompressedBytes ||
          (entry.uncompressedSize > 1024 * 1024 &&
            entry.uncompressedSize > entry.compressedSize * ZIP_PREVIEW_LIMITS.maxExpansionRatio)) {
          return { status: 'unsafe', message: ZIP_PREVIEW_UNSAFE_MESSAGE };
        }
      }
      if (suspicious) {
        suspiciousPaths.push(entry.filename);
        continue;
      }

      let parent: ArchiveTreeNode | undefined;
      for (let index = 0; index < segments.length; index += 1) {
        const path = segments.slice(0, index + 1).join('/');
        const kind = index === segments.length - 1 && !entry.directory ? 'file' : 'folder';
        let node = nodesByPath.get(path);
        if (node && node.kind !== kind) {
          return { status: 'unavailable', message: ZIP_PREVIEW_UNAVAILABLE_MESSAGE };
        }
        if (!node) {
          node = { name: segments[index], path, kind, children: [] };
          nodesByPath.set(path, node);
          if (kind === 'folder') folderCount += 1;
          if (parent) parent.children.push(node);
          else tree.push(node);
        }
        if (index === segments.length - 1 && kind === 'file') node.sizeBytes = entry.uncompressedSize;
        parent = node;
      }
    }
    sortTree(tree);
    return { status: 'ready', tree, suspiciousPaths, fileCount, folderCount, totalUncompressedBytes, entryCount };
  } catch {
    return { status: 'unavailable', message: ZIP_PREVIEW_UNAVAILABLE_MESSAGE };
  } finally {
    await reader.close();
  }
};
