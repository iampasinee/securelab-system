import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, LogOut, UploadCloud } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/apiClient';
import { getServerNow, synchronizeServerClock } from '../../services/serverClock';
import { deleteStagedUpload, getStagedUploads, saveStagedUpload } from '../../services/stagedUploadStorage';
import type { ApiAccess, ApiExam, ApiFile, ApiSubmission, ApiVersion } from '../../types/api';
import type { StagedUploadRecord } from '../../types/stagedUpload';
import { SecureLabBrandHeader } from '../common/SecureLabBrandHeader';
import { StudentExamProgressStepper } from './StudentExamProgressStepper';
import { PreparedFileRow } from './PreparedFileRow';
import { FilePreviewModal } from './FilePreviewModal';
import { FinalSubmissionConfirmation } from './FinalSubmissionConfirmation';
import { Modal } from '../common/Modal';

const labels = { ready: 'รับไฟล์แล้ว', uploading: 'กำลังส่ง', failed: 'ส่งไม่สำเร็จ', invalid: 'ไฟล์ไม่ถูกต้อง', submitted: 'FINAL' };
const button = 'rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';

export const ApiStudentFlow: React.FC = () => {
  const { currentStudent, setRole, showToast, violations, acknowledgeViolation } = useApp();
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [exam, setExam] = useState<ApiExam | null>(null);
  const [access, setAccess] = useState<ApiAccess | null>(null);
  const [version, setVersion] = useState<ApiVersion | null>(null);
  const [history, setHistory] = useState<ApiVersion[]>([]);
  const [records, setRecords] = useState<StagedUploadRecord[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<StagedUploadRecord | null>(null);
  const [rename, setRename] = useState<ApiFile | null>(null);
  const [baseName, setBaseName] = useState('');
  const [removing, setRemoving] = useState<ApiFile | null>(null);
  const [now, setNow] = useState(getServerNow);
  const input = useRef<HTMLInputElement>(null);
  const retryId = useRef<string | null>(null);
  const blobs = useRef(new Map<string, Blob>());
  const versionRef = useRef(version);
  const selectedHistory = useRef<string | null>(null);
  const activeExam = useRef(exam?.id);
  activeExam.current = exam?.id;
  versionRef.current = version;
  const sessionKey = (attemptId: string) => `api:${currentStudent!.id}:${exam!.id}:${attemptId}`;
  const loadWorkspace = useCallback(async (current: ApiVersion, key: string) => {
    synchronizeServerClock(current.serverNow);
    const saved = await getStagedUploads(key);
    if (key.split(':')[2] !== activeExam.current) return;
    saved.forEach((record) => blobs.current.set(record.uploadId, record.blob));
    const prepared = current.files.map((file): StagedUploadRecord => ({
      uploadId: file.uploadId, uploadSequence: file.uploadSequence, sessionKey: key, originalName: file.originalName,
      submissionName: file.submissionName, sizeBytes: file.sizeBytes || file.expectedSizeBytes, extension: file.extension,
      lastUpdated: file.updatedAt, progress: file.state === 'ready' ? 100 : saved.find((record) => record.uploadId === file.uploadId)?.progress || 0,
      status: current.state === 'final' ? 'submitted' : file.state === 'ready' ? 'ready' : file.state === 'receiving' ? 'uploading' : 'failed',
      errorReason: file.state === 'failed' ? 'อัปโหลดไม่สำเร็จ สามารถลองใหม่ด้วยไฟล์เดิมได้' : undefined,
      blob: blobs.current.get(file.uploadId) || new Blob([]),
    }));
    setVersion(current); setRecords(prepared);
    if (current.state === 'final') {
      // Only this acknowledged server attempt is cleaned; mock workspaces stay intact.
      await Promise.all(saved.map((record) => deleteStagedUpload(record.uploadId)));
    }
  }, []);
  const update = useCallback(async () => {
    if (!exam || !currentStudent) return;
    const result = await api.request<ApiAccess>(`/exams/${exam.id}/access`);
    if (activeExam.current !== exam.id) return;
    synchronizeServerClock(result.serverNow); setAccess(result);
    const root = result.submission;
    if (root) {
      const versions = await api.all<ApiVersion>(`/submissions/${root.id}/versions`);
      if (activeExam.current !== exam.id) return;
      setHistory(versions);
      const current = (selectedHistory.current ? versions.find((item) => item.id === selectedHistory.current) : null) || root.openVersion || (versionRef.current ? versions.find((item) => item.id === versionRef.current!.id) : null) || root.latestFinalVersion || versions[0];
      if (current) await loadWorkspace(current, `api:${currentStudent.id}:${exam.id}:${current.id}`);
    }
  }, [exam, currentStudent?.id, loadWorkspace]);
  useEffect(() => {
    let mounted = true;
    let pending = false;
    const load = async () => {
      if (pending || exam) return;
      pending = true;
      try { const items = await api.all<ApiExam>('/exams'); if (mounted) setExams(items); } catch (failure) { if (mounted) setError(failure.message); } finally { pending = false; }
    };
    void load(); const timer = window.setInterval(load, 5000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [currentStudent?.id, exam?.id]);
  useEffect(() => {
    if (!exam) return;
    let live = true;
    let polling = false;
    const refresh = async () => {
      if (polling || !live) return;
      polling = true;
      try { await update(); } catch (failure) { if (live) setError(failure.message); }
      finally { polling = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { live = false; window.clearInterval(timer); };
  }, [update, exam]);
  useEffect(() => { const timer = window.setInterval(() => setNow(getServerNow()), 1000); return () => window.clearInterval(timer); }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'ดำเนินการไม่สำเร็จ'); }
    finally { setBusy(false); }
  };
  const start = () => run(async () => {
    selectedHistory.current = null;
    const result = await api.request<{ submission: ApiSubmission; attempt: ApiVersion }>(`/exams/${exam!.id}/attempts`, {
      method: 'POST', body: { rulesAccepted: accepted, acceptedExamRevision: access!.examRevision },
    });
    setAccess((prior) => prior ? { ...prior, submission: result.submission } : prior);
    await loadWorkspace(result.attempt, sessionKey(result.attempt.id));
    await update();
  });
  const patchPrepared = (uploadId: string, updates: Partial<StagedUploadRecord>) => setRecords((items) => items.map((record) => record.uploadId === uploadId ? { ...record, ...updates } : record));
  const send = async (file: ApiFile, blob: Blob, current: ApiVersion) => {
    if (blob.size !== file.expectedSizeBytes) throw new Error('ขนาดไฟล์ไม่ตรงกับไฟล์ที่จองไว้ กรุณาเลือกไฟล์เดิม');
    blobs.current.set(file.uploadId, blob);
    const prepared: StagedUploadRecord = { uploadId: file.uploadId, uploadSequence: file.uploadSequence, sessionKey: sessionKey(current.id),
      originalName: file.originalName, submissionName: file.submissionName, sizeBytes: blob.size, extension: file.extension,
      lastUpdated: new Date().toISOString(), status: 'uploading', progress: 0, blob };
    await saveStagedUpload(prepared);
    setRecords((items) => [...items.filter((item) => item.uploadId !== file.uploadId), prepared].sort((a, b) => a.uploadSequence - b.uploadSequence));
    try {
      const acknowledged = await api.upload(file.uploadId, blob, (progress) => patchPrepared(file.uploadId, { progress }));
      await saveStagedUpload({ ...prepared, submissionName: acknowledged.submissionName, status: 'ready', progress: 100 });
      patchPrepared(file.uploadId, { status: 'ready', progress: 100 });
    } catch (failure) {
      await saveStagedUpload({ ...prepared, status: 'failed' });
      patchPrepared(file.uploadId, { status: 'failed', errorReason: failure.message });
      throw failure;
    }
  };
  const selectFiles = async (files: File[]) => {
    if (!version || !access?.submission || sending) return;
    setSending(true); setError('');
    try {
      for (const local of files) {
        const existing = retryId.current ? version.files.find((file) => file.uploadId === retryId.current) : null;
        retryId.current = null;
        const file = existing || await api.request<ApiFile>(`/submissions/${access.submission.id}/versions/${version.id}/files`, {
          method: 'POST', body: { originalName: local.name, expectedSizeBytes: local.size, clientMime: local.type || null },
        });
        await send(file, local, version);
      }
    } catch (failure) { setError(failure.message); }
    finally { setSending(false); if (input.current) input.current.value = ''; await update().catch((failure) => setError(failure.message)); }
  };
  const retry = (file: ApiFile) => {
    const blob = blobs.current.get(file.uploadId);
    if (blob?.size) {
      setSending(true);
      void send(file, blob, version!).catch((failure) => setError(failure.message)).finally(async () => { setSending(false); await update().catch((failure) => setError(failure.message)); });
    } else { retryId.current = file.uploadId; if (input.current) { input.current.multiple = false; input.current.click(); } }
  };
  const deadline = version?.deadline || access?.deadline;
  const seconds = deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - now.getTime()) / 1000)) : 0;
  const open = version?.state === 'open' && seconds > 0;
  const canFinish = Boolean(open && !sending && version?.files.length && version.files.every((file) => file.state === 'ready') && version.files.length >= version.requiredFileCount);
  const finish = () => run(async () => {
    const receipt = await api.request<ApiVersion>(`/submissions/${access!.submission!.id}/versions/${version!.id}/finalize`, { method: 'POST' });
    await loadWorkspace(receipt, sessionKey(receipt.id)); setConfirming(false); await update();
  });
  const relevantEvents = violations.filter((event) => !exam || event.examId === exam.id);
  return <div className="min-h-screen bg-gray-50">
    <SecureLabBrandHeader />
    <div className="flex justify-between border-b bg-white px-6 py-3 text-sm"><span>{currentStudent?.fullName} · {currentStudent?.studentCode}</span><button onClick={() => setRole(null)} className="flex items-center gap-2 text-gray-600"><LogOut size={16} />ออกจากระบบ</button></div>
    <StudentExamProgressStepper firstStepLabel="เลือกการสอบ" currentStep={!exam ? 1 : !version ? 2 : version.state === 'final' ? 4 : 3} />
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-7">
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!exam ? <><h1 className="text-2xl font-bold">การสอบของฉัน</h1>{!exams.length && <p className="rounded-xl bg-white p-6 text-gray-500">ยังไม่มีการสอบที่คุณมีสิทธิ์เข้าถึง</p>}<div className="grid gap-4 md:grid-cols-2">{exams.map((item) => <button key={item.id} onClick={() => { selectedHistory.current = null; setExam(item); setError(''); setVersion(null); setAccess(null); setHistory([]); setRecords([]); setAccepted(false); }} className="rounded-2xl border bg-white p-5 text-left hover:border-blue-400"><p className="text-sm text-blue-700">{item.courseCode} · ตอนเรียน {item.sectionNumber} · {item.academicYear}/{item.semester}</p><h2 className="mt-2 text-lg font-semibold">{item.name}</h2><p className="mt-2 text-sm text-gray-600">{new Date(item.startsAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p><p className="mt-2 text-sm">{item.status === 'upcoming' ? 'กำลังจะเริ่ม' : item.status === 'in_progress' ? 'กำลังสอบ' : 'เสร็จสิ้น'}</p></button>)}</div></>
        : <><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{exam.name}</h1><p className="mt-1 text-sm text-gray-500">{exam.courseCode} · ตอนเรียน {exam.sectionNumber} · ห้อง {exam.roomCode}</p></div><button className={button} onClick={() => { selectedHistory.current = null; setExam(null); setVersion(null); setAccess(null); setRecords([]); }}><ArrowLeft className="mr-2 inline h-4 w-4" />รายการสอบ</button></div>
          <div className="grid gap-4 rounded-2xl border bg-white p-5 text-sm sm:grid-cols-3"><p>ที่นั่ง: {access?.seat?.seatCode || 'ยังไม่ได้จัดที่นั่ง'}</p><p>สถานะเครื่อง: ยังไม่มีผลการเชื่อมต่อจริง</p><p>การตรวจใบหน้า: ยังไม่พร้อมใช้งาน</p></div>
          {!access && <p>กำลังตรวจสอบสิทธิ์…</p>}
          {access && !version && <section className="space-y-4 rounded-2xl border bg-white p-6"><h2 className="text-lg font-semibold">ข้อมูลและกฎการสอบ</h2><p className="whitespace-pre-wrap text-sm">{exam.instructions}</p><ul className="list-inside list-disc space-y-2 text-sm">{exam.rules.map((rule) => <li key={rule.id}>{rule.text}</li>)}</ul><p className="text-sm">รับไฟล์ {exam.acceptedExtensions.join(', ')} ไม่เกิน {exam.maxFileSizeBytes / 1024 / 1024} MB ต่อไฟล์ อย่างน้อย {exam.requiredFileCount} ไฟล์</p><p className="text-sm text-gray-500">นโยบายอุปกรณ์ Agent และเครือข่ายเป็นข้อกำหนดที่บันทึกไว้ ยังไม่มีการบังคับจากระบบจริง</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />ฉันอ่านและยอมรับกฎการสอบฉบับนี้แล้ว</label><button className={primary} disabled={!accepted || !access.capabilities.startAttempt || busy} onClick={start}>{access.reopenGrant ? 'เริ่มการส่งใหม่ที่ได้รับอนุญาต' : 'เริ่มสอบ'}</button>{!access.capabilities.startAttempt && <p className="text-sm text-gray-500">ยังไม่ถึงเวลาเริ่มสอบ หรือหมดช่วงเวลาที่ได้รับอนุญาต</p>}</section>}
          {version?.state === 'open' && <><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50 p-4"><p className="font-semibold">การส่งครั้งที่ {version.versionNumber} · เวลาที่เหลือ {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p><p className="text-sm">รับไฟล์แล้ว {version.receivedFileCount}/{version.requiredFileCount}</p></div><section onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (open) void selectFiles(Array.from(event.dataTransfer.files)); }} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">ไฟล์ที่เตรียมส่ง</h2><button className={button} disabled={!open || sending} onClick={() => { retryId.current = null; if (input.current) { input.current.multiple = true; input.current.click(); } }}><UploadCloud className="mr-2 inline h-4 w-4" />เลือกไฟล์</button></div><input ref={input} type="file" multiple={!retryId.current} accept={exam.acceptedExtensions.join(',')} hidden onChange={(event) => { void selectFiles(Array.from(event.target.files || [])); }} /><div className="mt-4 divide-y rounded-xl border">{records.map((record) => <div key={record.uploadId}><PreparedFileRow file={record} canManage={Boolean(open && !sending)} statusLabel={labels[record.status]} statusClass={record.status === 'ready' ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-600'} onPreview={(file) => { if (blobs.current.has(file.uploadId)) setPreview(file); else showToast('ไม่มีไฟล์ตัวอย่างในอุปกรณ์นี้', 'สามารถดาวน์โหลดไฟล์ที่ server รับแล้วได้', 'info'); }} onRename={(file) => { const remote = version.files.find((item) => item.uploadId === file.uploadId)!; setRename(remote); setBaseName(remote.submissionName.slice(0, -remote.extension.length)); }} onRequestDelete={(file) => setRemoving(version.files.find((item) => item.uploadId === file.uploadId)!)} />{record.status === 'failed' && open && <button disabled={sending} onClick={() => retry(version.files.find((file) => file.uploadId === record.uploadId)!)} className="mb-3 ml-16 text-sm text-blue-700">เลือกไฟล์เดิมและลองส่งใหม่</button>}{record.status === 'uploading' && <progress className="mx-4 mb-3 w-4/5" max={100} value={record.progress} />}</div>)}</div><p className="mt-4 text-xs text-gray-500">ลากไฟล์มาวางได้ การแสดง “รับไฟล์แล้ว” หมายถึง backend บันทึก bytes และ SHA-256 สำเร็จ</p></section><div className="flex justify-end"><button className={primary} disabled={!canFinish || busy} onClick={() => setConfirming(true)}>เสร็จสิ้นและส่งไฟล์</button></div>{!seconds && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">หมดเวลาแล้ว กำลังรอผลการส่งอัตโนมัติจาก server ไฟล์ที่เริ่มส่งก่อนหมดเวลามีช่วงรอไม่เกิน 10 วินาที</p>}</>}
          {version?.state === 'expired' && <p role="status" className="rounded-xl border bg-amber-50 p-5 text-amber-800">การส่งครั้งที่ {version.versionNumber} หมดเวลาโดยไม่มีไฟล์ที่รับสำเร็จ ต้องให้ผู้สอนเปิดรับส่งใหม่</p>}
          {version?.state === 'final' && <section className="space-y-4 rounded-2xl border border-green-200 bg-white p-6"><h2 className="text-xl font-semibold text-green-700">รับงาน FINAL แล้ว · ครั้งที่ {version.versionNumber}</h2><p className="text-sm">รับไฟล์ {version.receivedFileCount}/{version.requiredFileCount} · {version.isComplete ? 'ไฟล์ครบตามจำนวน' : 'จำนวนไฟล์ไม่ครบตามข้อกำหนด'} · {version.timeliness === 'late' ? 'ส่งหลังเวลาสอบโดยได้รับอนุญาต' : 'ส่งภายในเวลา'} · {version.finalizationSource === 'timeout' ? 'ส่งอัตโนมัติเมื่อหมดเวลา' : 'นักศึกษายืนยันส่ง'}</p><p className="text-sm text-gray-500">เวลารับงาน: {new Date(version.finalizedAt!).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>{version.files.map((file) => <div key={file.uploadId} className="rounded-xl border p-3"><button onClick={() => { void api.download(`/submission-files/${file.uploadId}/content`, file.submissionName).catch((failure) => setError(failure.message)); }} className="flex items-center gap-2 text-sm text-blue-700"><Download size={16} />{file.submissionName}</button><p className="mt-2 break-all font-mono text-xs text-gray-500">SHA-256: {file.sha256}</p></div>)}<p className="text-xs text-gray-500">SHA-256 ใช้ตรวจ bytes ที่รับไว้ ไม่ใช่การตรวจความถูกต้องหรือความปลอดภัยของโปรแกรม</p></section>}
          {access?.reopenGrant && version?.state !== 'open' && <section className="space-y-3 rounded-xl border bg-blue-50 p-4"><p className="text-sm">ผู้สอนอนุญาตให้ส่งใหม่ถึง {new Date(access.reopenGrant.expiresAt).toLocaleString('th-TH')} งาน FINAL เดิมยังอยู่ในประวัติ</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />ยอมรับกฎการสอบฉบับปัจจุบัน</label><button disabled={!accepted || busy} className={primary} onClick={start}>เริ่มการส่งครั้งใหม่</button></section>}
          {history.length > 1 && <section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 font-semibold">ประวัติการส่ง</h2><div className="flex flex-wrap gap-2">{history.map((item) => <button key={item.id} className={button} onClick={() => { selectedHistory.current = item.id; void loadWorkspace(item, sessionKey(item.id)).catch((failure) => setError(failure.message)); }}>ครั้งที่ {item.versionNumber} · {item.state === 'final' ? 'FINAL' : item.state === 'open' ? 'กำลังเตรียม' : 'หมดเวลา'}</button>)}</div></section>}
        </>}
      {relevantEvents.length > 0 && <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="font-semibold">เหตุผิดปกติที่บันทึกไว้</h2>{relevantEvents.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>{event.detail} <span className="text-xs text-gray-500">(เหตุจำลองสำหรับพัฒนา)</span></p><button disabled={Boolean(event.studentSeenAt)} className={button} onClick={() => { void acknowledgeViolation(event.id); }}>{event.studentSeenAt ? 'รับทราบแล้ว' : 'รับทราบ'}</button></div>)}</section>}
    </main>
    <FilePreviewModal record={preview} onClose={() => setPreview(null)} />
    <FinalSubmissionConfirmation isOpen={confirming} isThai files={records} canFinish={canFinish && !busy} statusLabel={(status) => labels[status]} onCancel={() => setConfirming(false)} onConfirm={finish} explanation="ยืนยันส่งไฟล์ที่ server รับแล้วเป็น FINAL เมื่อยืนยันจะเปลี่ยนชื่อหรือลบไฟล์ในการส่งครั้งนี้ไม่ได้ หากผู้สอนเปิดรับส่งใหม่ ระบบจะเก็บเป็นครั้งใหม่และรักษางานเดิมไว้" />
    <Modal isOpen={Boolean(rename)} onClose={() => setRename(null)} title="เปลี่ยนชื่อไฟล์สำหรับส่ง"><form onSubmit={(event) => { event.preventDefault(); void run(async () => { await api.request(`/submission-files/${rename!.uploadId}`, { method: 'PATCH', body: { submissionBaseName: baseName, expectedVersion: rename!.rowVersion } }); setRename(null); await update(); }); }} className="space-y-4"><label className="block text-sm">ชื่อฐาน (ตัวอักษรอังกฤษ ตัวเลข _ และ -)<input required pattern="[A-Za-z0-9_-]+" maxLength={100} value={baseName} onChange={(event) => setBaseName(event.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label><p className="text-sm text-gray-500">นามสกุลคงเดิม: {rename?.extension}</p><button disabled={busy} className={primary}>บันทึกชื่อ</button></form></Modal>
    <Modal isOpen={Boolean(removing)} onClose={() => setRemoving(null)} title="นำไฟล์ออกจากการส่ง"><p className="mb-4 text-sm">ยืนยันนำ {removing?.submissionName} ออกจากการส่งครั้งนี้?</p><button disabled={busy} className={primary} onClick={() => { void run(async () => { await api.request(`/submission-files/${removing!.uploadId}`, { method: 'DELETE' }); await deleteStagedUpload(removing!.uploadId); setRemoving(null); await update(); }); }}>ยืนยันนำไฟล์ออก</button></Modal>
  </div>;
};
