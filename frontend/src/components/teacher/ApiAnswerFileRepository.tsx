import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/apiClient';
import type { ApiExam, ApiSubmission, ApiVersion } from '../../types/api';
import { formatFileSize } from '../../utils/fileSize';
import { Modal } from '../common/Modal';

export const ApiAnswerFileRepository: React.FC = () => {
  const { students } = useApp();
  const [exams, setExams] = useState<ApiExam[]>([]);
  const [selected, setSelected] = useState<ApiExam | null>(null);
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([]);
  const [people, setPeople] = useState<Record<string, { studentCode: string; fullName: string }>>({});
  const [history, setHistory] = useState<ApiVersion[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = selected
          ? await api.all<ApiSubmission>(`/exams/${selected.id}/submissions`)
          : await api.all<ApiExam>('/exams');
        if (selected) {
          const participants = await api.all<{ studentId?: string; id?: string; studentCodeSnapshot?: string; nameSnapshot?: string; studentCode?: string; fullName?: string }>(`/exams/${selected.id}/participants`);
          if (active) setPeople(Object.fromEntries(participants.map((person) => [person.studentId || person.id!, {
            studentCode: person.studentCodeSnapshot || person.studentCode || '', fullName: person.nameSnapshot || person.fullName || '',
          }])));
        }
        if (active) { selected ? setSubmissions(result as ApiSubmission[]) : setExams(result as ApiExam[]); setError(''); }
      } catch (failure) { if (active) setError(failure.message); }
    };
    void load(); const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selected?.id]);
  const download = async (path: string, name: string) => {
    setBusy(true); setError('');
    try { await api.download(path, name); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  const versions = async (id: string) => {
    try { setHistory(await api.all<ApiVersion>(`/submissions/${id}/versions`)); } catch (failure) { setError(failure.message); }
  };
  const files = (version: ApiVersion) => <div className="space-y-3">
    <p className="text-sm">ครั้งที่ {version.versionNumber} · {version.timeliness === 'late' ? 'ส่งหลังเวลา' : 'ส่งภายในเวลา'} · {version.receivedFileCount}/{version.requiredFileCount} ไฟล์{!version.isComplete && ' · จำนวนไฟล์ไม่ครบ'}</p>
    <p className="text-xs text-gray-500">{version.finalizedAt && new Date(version.finalizedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>
    {version.files.filter((file) => file.state === 'ready').map((file) => <div key={file.uploadId} className="rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="break-all font-mono text-sm">{file.submissionName} · {formatFileSize(file.sizeBytes || 0)}</span><button disabled={busy} onClick={() => download(`/submission-files/${file.uploadId}/content`, file.submissionName)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">ดาวน์โหลดไฟล์</button></div>
      <p className="mt-2 break-all font-mono text-xs text-gray-500">SHA-256: {file.sha256}</p>
    </div>)}
  </div>;
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div>{selected && <button onClick={() => { setSelected(null); setSubmissions([]); }} className="mb-3 text-blue-700">← กลับไปคลังไฟล์</button>}<h1 className="text-2xl font-bold">{selected ? `${selected.courseCode} · ${selected.name}` : 'คลังจัดเก็บไฟล์คำตอบข้อสอบ'}</h1><p className="mt-2 text-sm text-gray-500">ไฟล์ FINAL และประวัติการส่งจาก backend · SHA-256 ใช้ตรวจ bytes ที่รับ ไม่ยืนยันความถูกต้องของโปรแกรม</p></div>{selected && <button disabled={busy} onClick={() => download(`/exams/${selected.id}/submissions/archive`, `exam-${selected.id}.zip`)} className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'กำลังดาวน์โหลด…' : 'ดาวน์โหลดทั้งหมด (.zip)'}</button>}</header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={selected ? 'ค้นหารหัสหรือชื่อนักศึกษา' : 'ค้นหาวิชา ชื่อการสอบ หรือห้อง'} className="w-full rounded-xl border p-3" />
    {!selected ? <div className="grid gap-4 md:grid-cols-2">{exams.filter((exam) => `${exam.courseCode} ${exam.courseName} ${exam.name} ${exam.roomCode}`.toLowerCase().includes(search.toLowerCase())).map((exam) => <button key={exam.id} onClick={() => { setSelected(exam); setSearch(''); }} className="rounded-2xl border bg-white p-5 text-left"><h2 className="font-semibold">{exam.courseCode} · {exam.name}</h2><p className="mt-2 text-sm text-gray-500">ตอนเรียน {exam.sectionNumber} · {exam.academicYear}/{exam.semester} · ห้อง {exam.roomCode}</p></button>)}</div> : <div className="space-y-4">{submissions.filter((submission) => {
      const student = people[submission.studentId] || students.find((person) => person.id === submission.studentId);
      return submission.latestFinalVersion && `${student?.studentCode || ''} ${student?.fullName || ''}`.toLowerCase().includes(search.toLowerCase());
    }).map((submission) => {
      const student = people[submission.studentId] || students.find((person) => person.id === submission.studentId);
      return <article key={submission.id} className="space-y-4 rounded-2xl border bg-white p-5"><div className="flex justify-between gap-3"><h2 className="font-semibold">{student?.studentCode} · {student?.fullName || 'นักศึกษาในรายชื่อสอบ'}</h2><button onClick={() => versions(submission.id)} className="text-sm text-blue-700">ประวัติการส่ง</button></div>{files(submission.latestFinalVersion!)}</article>;
    })}{!submissions.some((submission) => submission.latestFinalVersion) && <p className="text-gray-500">ยังไม่มีไฟล์ FINAL</p>}</div>}
    <Modal isOpen={history !== null} onClose={() => setHistory(null)} title="ประวัติการส่งทุกครั้ง"><div className="space-y-5">{history?.filter((version) => version.state === 'final').map((version) => <section key={version.id} className="border-b pb-4">{files(version)}</section>)}</div></Modal>
  </div>;
};
