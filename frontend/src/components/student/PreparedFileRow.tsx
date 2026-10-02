import React from 'react';
import { AlertCircle, CheckCircle2, Eye, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import type { StagedUploadRecord } from '../../types/stagedUpload';
import { getFilePreviewType } from '../../services/filePreview';
import { formatFileSize } from '../../utils/fileSize';

interface PreparedFileRowProps {
  file: StagedUploadRecord;
  canManage: boolean;
  statusLabel: string;
  statusClass: string;
  onPreview: (file: StagedUploadRecord, trigger: HTMLButtonElement) => void;
  onRename: (file: StagedUploadRecord) => void;
  onRequestDelete: (file: StagedUploadRecord, trigger: HTMLButtonElement) => void;
}

export const PreparedFileRow: React.FC<PreparedFileRowProps> = ({
  file,
  canManage,
  statusLabel,
  statusClass,
  onPreview,
  onRename,
  onRequestDelete,
}) => {
  const previewType = getFilePreviewType(file);
  const previewLabel = previewType === 'metadata' ? 'ดูข้อมูลไฟล์' :
    previewType === 'archive' ? 'ดูโครงสร้าง ZIP' : 'ดูตัวอย่าง';
  const fileType = file.extension.slice(1).toUpperCase() || 'FILE';

  return <div className="flex min-w-0 items-start gap-3 px-4 py-2.5 hover:bg-gray-50/80 transition-colors">
    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-[10px] font-bold ${file.extension === '.zip' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`} aria-hidden="true">
      {fileType.slice(0, 4)}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-[10px] text-gray-500">ชื่อไฟล์สำหรับส่ง</span>
          <span className="block truncate font-mono text-xs font-semibold text-gray-900" title={file.submissionName}>{file.submissionName}</span>
        </div>
        <span className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
          {file.status === 'ready' || file.status === 'submitted' ? <CheckCircle2 className="h-3 w-3" /> : file.status === 'uploading' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}
          {statusLabel}
        </span>
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-end justify-between gap-x-2 gap-y-1">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-gray-500 sm:w-auto sm:flex-1">
          <span className="min-w-0 max-w-full truncate" title={file.originalName}>ชื่อไฟล์ต้นฉบับ: <span className="font-mono">{file.originalName}</span></span>
          <span>ขนาดไฟล์: {formatFileSize(file.sizeBytes)}</span>
          <span className="hidden sm:inline" aria-hidden="true">•</span>
          <span>ประเภทไฟล์: {fileType}</span>
          <span className="hidden sm:inline" aria-hidden="true">•</span>
          <span>อัปโหลดเมื่อ: {new Date(file.lastUpdated).toLocaleTimeString()}</span>
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
          <button type="button" onClick={(event) => onPreview(file, event.currentTarget)} title={previewLabel} aria-label={previewLabel} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">
            <Eye className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onRename(file)} disabled={!canManage || file.status === 'submitted'} title="เปลี่ยนชื่อ" aria-label="เปลี่ยนชื่อ" className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={(event) => onRequestDelete(file, event.currentTarget)} disabled={!canManage || file.status === 'submitted'} title="ลบไฟล์" aria-label="ลบไฟล์" className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-40">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {file.status === 'uploading' && <div role="progressbar" aria-label={`กำลังอัปโหลด ${file.submissionName}`} aria-valuenow={file.progress} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-1 w-full max-w-40 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${file.progress}%` }} />
      </div>}
      {file.errorReason && <p className="mt-1 flex min-w-0 items-start gap-1 break-words text-[11px] text-red-600"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{file.errorReason}</p>}
    </div>
  </div>;
};
