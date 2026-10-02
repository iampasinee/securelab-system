import React, { useEffect, useState } from 'react';
import { FileQuestion, Image as ImageIcon } from 'lucide-react';
import type { StagedUploadRecord } from '../../types/stagedUpload';
import {
  getFilePreviewMetadata,
  getFilePreviewType,
  MAX_TEXT_PREVIEW_BYTES,
  readTextPreview,
} from '../../services/filePreview';
import { Modal } from '../common/Modal';
import { ArchivePreview } from './ArchivePreview';
import { ImagePreview } from './ImagePreview';

interface FilePreviewModalProps {
  record: StagedUploadRecord | null;
  onClose: () => void;
}

/** React renders the source as escaped text. Uploaded HTML or scripts are never interpreted. */
export const FilePreviewText: React.FC<{ content: string }> = ({ content }) => (
  <pre tabIndex={0} aria-label="เนื้อหาไฟล์แบบอ่านอย่างเดียว" className="max-h-[58vh] min-w-0 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-5 whitespace-pre text-slate-100">
    <code>{content}</code>
  </pre>
);

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ record, onClose }) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const previewType = record ? getFilePreviewType(record) : 'metadata';
  const textPreviewTooLarge = Boolean(record && previewType === 'text' &&
    (record.sizeBytes > MAX_TEXT_PREVIEW_BYTES || record.blob.size > MAX_TEXT_PREVIEW_BYTES));
  const metadata = record ? getFilePreviewMetadata(record) : null;

  useEffect(() => {
    if (!record) return;
    let cancelled = false;
    setTextContent(null);
    setImageUrl(null);
    setLoadError(false);

    if (getFilePreviewType(record) === 'text' && record.sizeBytes <= MAX_TEXT_PREVIEW_BYTES &&
      record.blob.size <= MAX_TEXT_PREVIEW_BYTES) {
      void readTextPreview(record).then((content) => {
        if (!cancelled) setTextContent(content);
      }).catch(() => {
        if (!cancelled) setLoadError(true);
      });
    }

    let objectUrl: string | null = null;
    if (getFilePreviewType(record) === 'image') {
      try {
        objectUrl = URL.createObjectURL(record.blob);
        setImageUrl(objectUrl);
      } catch {
        setLoadError(true);
      }
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record?.uploadId, record?.blob]);

  // Escape closes only this preview if another dialog is open beneath it.
  useEffect(() => {
    if (!record) return;
    const closeTopModal = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', closeTopModal, true);
    return () => window.removeEventListener('keydown', closeTopModal, true);
  }, [Boolean(record), onClose]);

  return <Modal isOpen={Boolean(record)} onClose={onClose} title="ตัวอย่างไฟล์" maxWidth="4xl" footer={
    <button type="button" autoFocus onClick={onClose} className="min-h-9 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">ปิด</button>
  }>
    {record && metadata && <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">ดูตัวอย่างเพื่อการตรวจสอบเท่านั้น ไม่สามารถแก้ไขหรือเรียกใช้ไฟล์จาก SecureLab ได้</div>
      <dl className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-slate-500">ชื่อไฟล์สำหรับส่ง</dt><dd className="break-all font-semibold text-slate-900">{metadata.filename}</dd></div>
        <div className="min-w-0"><dt className="text-slate-500">ชื่อไฟล์ต้นฉบับ</dt><dd className="break-all">{metadata.originalName}</dd></div>
        <div className="min-w-0"><dt className="text-slate-500">ประเภท</dt><dd className="break-all">{metadata.extension} • {metadata.mimeType}</dd></div>
        <div><dt className="text-slate-500">ขนาด</dt><dd>{metadata.size}</dd></div>
      </dl>
      {loadError ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">ไม่สามารถอ่านไฟล์เพื่อแสดงตัวอย่างได้</div>
        : textPreviewTooLarge ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">ไฟล์มีขนาดใหญ่เกินกว่าจะแสดงตัวอย่าง (สูงสุด 1 MB)</div>
        : previewType === 'text' ? textContent === null ? <p role="status" className="py-8 text-center text-sm text-slate-500">กำลังอ่านไฟล์...</p> : <FilePreviewText content={textContent} />
        : previewType === 'image' ? imageUrl ? <ImagePreview key={`${record.sessionKey}:${record.uploadId}:${record.lastUpdated}`} url={imageUrl} filename={metadata.originalName} onError={() => setLoadError(true)} /> : <p role="status" className="py-8 text-center text-sm text-slate-500">กำลังเปิดภาพ...</p>
        : previewType === 'archive' ? <ArchivePreview key={`${record.sessionKey}:${record.uploadId}:${record.lastUpdated}`} record={record} />
        : <div role="status" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">{record.extension.toLowerCase() === '.svg' ? <ImageIcon className="h-5 w-5 shrink-0 text-slate-400" /> : <FileQuestion className="h-5 w-5 shrink-0 text-slate-400" />}<p>ไฟล์ประเภทนี้ไม่สามารถแสดงตัวอย่างใน SecureLab ได้ แต่สามารถส่งได้หากเป็นประเภทที่ข้อสอบอนุญาต</p></div>}
    </div>}
  </Modal>;
};
