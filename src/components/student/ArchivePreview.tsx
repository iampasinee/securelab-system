import React, { useEffect, useState } from 'react';
import { FileText, Folder, TriangleAlert } from 'lucide-react';
import type { StagedUploadRecord } from '../../types/stagedUpload';
import { formatFileSize } from '../../utils/fileSize';
import type { ArchivePreviewResult, ArchiveTreeNode } from '../../services/archivePreview';

interface ArchivePreviewProps {
  record: StagedUploadRecord;
}

const countTreeNodes = (nodes: ArchiveTreeNode[]): number => nodes.reduce((count, node) =>
  count + 1 + countTreeNodes(node.children), 0);

const renderTree = (nodes: ArchiveTreeNode[], budget: { remaining: number }): React.ReactNode => <ul className="min-w-0 space-y-1 pl-3 first:pl-0">
  {nodes.map((node) => {
    if (budget.remaining <= 0) return null;
    budget.remaining -= 1;
    return <li key={node.path} className="min-w-0">
      {node.kind === 'folder' ? <details open className="min-w-0">
        <summary className="cursor-pointer rounded-md px-1 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
          <Folder className="mr-1 inline h-4 w-4 text-amber-500" aria-hidden="true" />{node.name}/
        </summary>
        {renderTree(node.children, budget)}
      </details> : <div className="flex min-w-0 items-start justify-between gap-2 rounded-md px-1 py-1 text-xs text-slate-700">
        <span className="min-w-0 break-all"><FileText className="mr-1 inline h-4 w-4 text-slate-400" aria-hidden="true" />{node.name}</span>
        {node.sizeBytes !== undefined && <span className="shrink-0 text-slate-500">{formatFileSize(node.sizeBytes)}</span>}
      </div>}
    </li>;
  })}
</ul>;

/** Archive items are plain text, never links or clickable inner-file previews. */
export const ArchivePreviewTree: React.FC<{ nodes: ArchiveTreeNode[]; visibleLimit: number }> = ({ nodes, visibleLimit }) =>
  <>{renderTree(nodes, { remaining: visibleLimit })}</>;

export const ArchivePreview: React.FC<ArchivePreviewProps> = ({ record }) => {
  const [result, setResult] = useState<ArchivePreviewResult | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(200);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setVisibleLimit(200);
    // Keep the ZIP parser out of the initial Student bundle until an archive is opened.
    void import('../../services/archivePreview').then(({ inspectZipStructure }) => inspectZipStructure(record)).then((value) => {
      if (!cancelled) setResult(value);
    }).catch(() => {
      if (!cancelled) setResult({ status: 'unavailable', message: 'ไม่สามารถอ่านโครงสร้างไฟล์ ZIP ได้' });
    });
    return () => { cancelled = true; };
  }, [record.uploadId, record.blob]);

  if (!result) return <p role="status" className="py-8 text-center text-sm text-slate-500">กำลังอ่านโครงสร้างไฟล์...</p>;
  if (result.status !== 'ready') return <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
    <p className="font-semibold">{result.message}</p>
    <p className="mt-1 text-xs">ยังดูข้อมูลไฟล์ด้านบนได้ และการดูตัวอย่างไม่เปลี่ยนสิทธิ์การส่งไฟล์</p>
  </div>;

  const totalTreeNodes = countTreeNodes(result.tree);
  return <section aria-label="โครงสร้างไฟล์ ZIP" className="min-w-0 space-y-3">
    <h4 className="text-sm font-semibold text-slate-900">โครงสร้างไฟล์ ZIP</h4>
    <dl className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 sm:grid-cols-2">
      <div><dt className="text-slate-500">จำนวนไฟล์</dt><dd className="font-semibold">{result.fileCount}</dd></div>
      <div><dt className="text-slate-500">จำนวนโฟลเดอร์</dt><dd className="font-semibold">{result.folderCount}</dd></div>
      <div><dt className="text-slate-500">ขนาด ZIP</dt><dd className="font-semibold">{formatFileSize(record.sizeBytes)}</dd></div>
      <div><dt className="text-slate-500">ขนาดรวมก่อนบีบอัด</dt><dd className="font-semibold">{formatFileSize(result.totalUncompressedBytes)}</dd></div>
    </dl>
    <div className="max-h-[42vh] min-w-0 overflow-auto rounded-xl border border-slate-200 bg-white p-3" aria-label="รายการไฟล์ใน ZIP แบบอ่านอย่างเดียว">
      {result.tree.length ? <ArchivePreviewTree nodes={result.tree} visibleLimit={visibleLimit} /> : <p className="text-xs text-slate-500">ไม่มีรายการไฟล์ที่แสดงได้</p>}
      {visibleLimit < totalTreeNodes && <button type="button" onClick={() => setVisibleLimit((limit) => limit + 200)} className="mt-3 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">แสดงเพิ่ม ({Math.min(visibleLimit, totalTreeNodes)} จาก {totalTreeNodes} รายการ)</button>}
    </div>
    {result.suspiciousPaths.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <p className="flex items-center gap-1 font-semibold"><TriangleAlert className="h-4 w-4" />พบเส้นทางที่ไม่ปลอดภัย (แสดงชื่อเท่านั้น ไม่เปิดหรือแตกไฟล์)</p>
      <ul className="mt-2 space-y-1">{result.suspiciousPaths.map((path, index) => <li key={`${index}-${path}`} className="break-all font-mono">{path}</li>)}</ul>
    </div>}
    <p className="text-xs text-slate-500">แสดงเฉพาะโครงสร้างไฟล์ ไม่เปิดเนื้อหาไฟล์ภายในหรือแตกไฟล์</p>
  </section>;
};
