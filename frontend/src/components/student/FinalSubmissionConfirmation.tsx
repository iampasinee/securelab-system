import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { StagedUploadRecord, StagedUploadStatus } from '../../types/stagedUpload';
import { formatFileSize } from '../../utils/fileSize';
import { Modal } from '../common/Modal';

interface FinalSubmissionConfirmationProps {
  isOpen: boolean;
  isThai: boolean;
  files: StagedUploadRecord[];
  canFinish: boolean;
  statusLabel: (status: StagedUploadStatus) => string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirmation only: file actions remain in the prepared-file list. */
export const FinalSubmissionConfirmation: React.FC<FinalSubmissionConfirmationProps> = ({
  isOpen,
  isThai,
  files,
  canFinish,
  statusLabel,
  onCancel,
  onConfirm,
}) => <Modal
  isOpen={isOpen}
  onClose={onCancel}
  title={isThai ? 'ยืนยันการเสร็จสิ้นการสอบ' : 'Confirm Finish Exam'}
  footer={<>
    <button type="button" onClick={onCancel} className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100">
      {isThai ? 'ยกเลิก' : 'Cancel'}
    </button>
    <button type="button" onClick={onConfirm} disabled={!canFinish} className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
      {isThai ? 'เสร็จสิ้นและส่งไฟล์' : 'Finish Exam and Submit Files'}
    </button>
  </>}
>
  <div className="space-y-3 text-left text-xs text-gray-700">
    <p>
      {isThai
        ? 'คุณแน่ใจหรือไม่ว่าต้องการส่งไฟล์ข้อสอบเหล่านี้? ระบบจะตรวจสอบขนาดไฟล์ ความสามารถในการเปิดอ่าน และสร้างบันทึกดิจิทัลที่ป้องกันการแก้ไขสำหรับอาจารย์ผู้คุมสอบ'
        : 'Are you sure you want to submit these exam files? The system will verify non-zero byte size, structural readability, and compile a tamper-evident audit record for proctor review.'}
    </p>
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <span className="mb-2 block font-semibold text-gray-900">
        {isThai ? 'ไฟล์ที่จะส่งรับการตรวจสอบ:' : 'Complete staged file list:'}
      </span>
      <ul className="space-y-2">
        {files.map((file) => <li key={file.uploadId} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="break-all font-mono font-semibold text-gray-900">{file.submissionName}</p>
            <p className="mt-0.5 text-gray-500">{formatFileSize(file.sizeBytes)}</p>
          </div>
          <span className={`flex shrink-0 items-center gap-1 ${file.status === 'ready' ? 'text-emerald-700' : 'text-gray-500'}`}>
            {file.status === 'ready' && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}{statusLabel(file.status)}
          </span>
        </li>)}
      </ul>
    </div>
  </div>
</Modal>;
