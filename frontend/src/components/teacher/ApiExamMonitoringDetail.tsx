import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/apiClient';
import { useApp } from '../../context/AppContext';
import type { ApiAssignment, ApiAudit, ApiExam, ApiSubmission, ApiViolation } from '../../types/api';
import { Modal } from '../common/Modal';
import { examStatusLabels } from '../../services/examStatus';

interface Participant {
  studentId: string; studentCode: string; fullName: string; status: string;
  seat: ApiAssignment | null; submission: ApiSubmission | null; pendingReviewCount: number;
}
interface Summary { exam: ApiExam; participants: Participant[]; counters: Record<string, number>; serverNow: string }
const stateLabels: Record<string, string> = { not_started: 'ยังไม่เริ่ม', working: 'กำลังเตรียมไฟล์', submitted: 'ส่งแล้ว', late: 'ส่งหลังเวลา', reopened: 'กำลังส่งครั้งใหม่' };
const button = 'rounded-xl border bg-white px-4 py-2 text-sm disabled:opacity-50';

export const ApiExamMonitoringDetail: React.FC<{ examSessionId: string; onBack: () => void }> = ({ examSessionId, onBack }) => {
  const { apiRefresh, showToast } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<ApiAudit[]>([]);
  const [violations, setViolations] = useState<ApiViolation[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<'time' | 'reopen' | null>(null);
  const [minutes, setMinutes] = useState(5);
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState<'room' | 'student'>('room');
  const [studentId, setStudentId] = useState('');
  const [expectedVersion, setExpectedVersion] = useState(1);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [result, timeline, incidents] = await Promise.all([api.request<Summary>(`/monitoring/exams/${examSessionId}`), api.all<ApiAudit>(`/exams/${examSessionId}/events`), api.all<ApiViolation>(`/violations?examId=${examSessionId}`)]);
    setSummary(result); setEvents(timeline); setViolations(incidents);
  }, [examSessionId]);
  useEffect(() => {
    let pending = false;
    const refresh = async () => { if (pending) return; pending = true; try { await load(); } catch (failure) { setError(failure.message); } finally { pending = false; } };
    void refresh(); const timer = window.setInterval(refresh, 5000); return () => window.clearInterval(timer);
  }, [load]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (modal === 'time') {
        await api.request(`/exams/${examSessionId}/time-adjustments`, { method: 'POST', idempotent: true, body: { deltaMinutes: minutes, reason, expectedVersion } });
        showToast('ปรับเวลาทั้งการสอบแล้ว', undefined, 'success');
      } else {
        const result = await api.request<{ affectedCount: number; skipped: unknown[] }>(`/exams/${examSessionId}/submission-reopens`, { method: 'POST', idempotent: true,
          body: { minutes, scope, ...(scope === 'student' ? { studentId } : {}), reason } });
        showToast('เปิดรับส่งใหม่แล้ว', `อนุญาต ${result.affectedCount} คน · ข้าม ${result.skipped.length} คนที่ยังไม่เข้าเงื่อนไข`, 'success');
      }
      setModal(null); await load(); await apiRefresh?.();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  const open = (kind: 'time' | 'reopen') => { setModal(kind); setMinutes(kind === 'time' ? 5 : 15); setReason(''); setError(''); setExpectedVersion(summary!.exam.rowVersion); };
  const review = async (id: string) => {
    setBusy(true); setError('');
    try { await api.request(`/violations/${id}/review`, { method: 'POST' }); await load(); await apiRefresh?.(); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  if (!summary) return <div className="space-y-4"><button className={button} onClick={onBack}>ย้อนกลับ</button><p role={error ? 'alert' : 'status'}>{error || 'กำลังโหลดข้อมูลการสอบ…'}</p></div>;
  const people = summary.participants.filter((person) => (!status || person.status === status) && `${person.studentCode} ${person.fullName}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5">
    <header className="flex flex-wrap justify-between gap-4 border-b pb-4"><div><button className="mb-3 text-sm text-blue-700" onClick={onBack}>← ภาพรวมประจำวัน</button><h1 className="text-2xl font-bold">{summary.exam.name}</h1><p className="mt-1 text-sm text-gray-500">{summary.exam.courseCode} · ตอนเรียน {summary.exam.sectionNumber} · {summary.exam.academicYear}/{summary.exam.semester} · ห้อง {summary.exam.roomCode}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-gray-100 px-3 py-2 text-sm">{examStatusLabels[summary.exam.status]}</span><button className={button} disabled={summary.exam.status !== 'in_progress'} onClick={() => open('time')}>ปรับเวลาทั้งการสอบ</button><button className={button} disabled={summary.exam.status === 'upcoming'} onClick={() => open('reopen')}>เปิดรับส่งใหม่</button></div></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['total', 'ผู้มีสิทธิ์สอบ'], ['submitted', 'ส่งแล้ว'], ['working', 'กำลังเตรียมไฟล์'], ['pendingReview', 'เหตุที่รอตรวจ'], ['late', 'ส่งหลังเวลา'], ['reopened', 'กำลังส่งครั้งใหม่'], ['notStarted', 'ยังไม่เริ่ม'], ['unseated', 'ยังไม่มีที่นั่ง']].map(([key, label]) => <div key={key} className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold">{summary.counters[key]}</p></div>)}</div>
    <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-600">สถานะเครื่อง: ยังไม่มี trusted heartbeat · การตรวจใบหน้า: ยังไม่พร้อมใช้งาน · เหตุผิดปกติใน MVP มาจากการจำลองสำหรับพัฒนา</p>
    <section className="overflow-hidden rounded-2xl border bg-white"><div className="flex flex-wrap gap-3 border-b p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหารหัสหรือชื่อนักศึกษา" className="min-w-56 flex-1 rounded-xl border px-3 py-2 text-sm" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="">ทุกสถานะการส่ง</option>{Object.entries(stateLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-gray-50 text-gray-500"><tr>{['นักศึกษา', 'ที่นั่ง', 'สถานะการส่ง', 'ไฟล์ FINAL ล่าสุด', 'รอตรวจเหตุ', 'ข้อมูลเครื่อง'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody className="divide-y">{people.map((person) => <tr key={person.studentId}><td className="p-3"><p className="font-medium">{person.fullName}</p><p className="font-mono text-xs text-gray-500">{person.studentCode}</p></td><td className="p-3">{person.seat?.seatCode || 'ยังไม่มีที่นั่ง'}</td><td className="p-3">{stateLabels[person.status]}</td><td className="p-3">{person.submission?.latestFinalVersion ? `ครั้งที่ ${person.submission.latestFinalVersion.versionNumber} · ${person.submission.latestFinalVersion.receivedFileCount}/${person.submission.latestFinalVersion.requiredFileCount}` : '—'}</td><td className="p-3">{person.pendingReviewCount}</td><td className="p-3 font-mono text-xs">{person.seat?.device.computerCode || '—'}<p className="text-gray-500">{person.seat?.device.ipAddress || '—'}</p></td></tr>)}</tbody></table></div></section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 font-semibold">เหตุผิดปกติจากการจำลอง</h2><p className="mb-3 text-xs text-gray-500">นักศึกษารับทราบและผู้ดูแลตรวจสอบเป็นคนละสถานะ การตรวจสอบไม่ใช่การตัดสินว่าทุจริต</p><div className="space-y-3">{violations.map((incident) => <div key={incident.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm">{incident.detail}</p><p className="mt-1 text-xs text-gray-500">{incident.studentSeenAt ? 'นักศึกษารับทราบแล้ว' : 'นักศึกษายังไม่รับทราบ'} · {incident.reviewedAt ? 'ตรวจสอบแล้ว' : 'รอผู้ดูแลตรวจสอบ'}</p></div><button disabled={busy || Boolean(incident.reviewedAt)} onClick={() => review(incident.id)} className={button}>{incident.reviewedAt ? 'ตรวจสอบแล้ว' : 'รับทราบการตรวจสอบ'}</button></div>)}{!violations.length && <p className="text-sm text-gray-500">ไม่มีเหตุผิดปกติ</p>}</div></section>
    <section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 font-semibold">ลำดับเหตุการณ์การสอบ</h2><div className="max-h-64 space-y-2 overflow-y-auto text-xs">{events.map((event) => <p key={event.id}><span className="mr-3 text-gray-500">{new Date(event.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>{event.action} · {event.outcome}</p>)}</div></section>
    <Modal isOpen={Boolean(modal)} onClose={() => setModal(null)} title={modal === 'time' ? 'ปรับเวลาทั้งการสอบ' : 'เปิดรับส่งใหม่'}><form onSubmit={submit} className="space-y-4"><label className="block text-sm">{modal === 'time' ? 'นาทีที่เพิ่มหรือลด (ใช้ค่าลบเพื่อลด)' : 'ระยะเวลาเปิดรับใหม่ 5–60 นาที'}<input type="number" required min={modal === 'time' ? -1440 : 5} max={modal === 'time' ? 1440 : 60} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="mt-2 w-full rounded-xl border p-2" /></label>{modal === 'reopen' && <><label className="block text-sm">ขอบเขต<select value={scope} onChange={(event) => setScope(event.target.value as 'room' | 'student')} className="mt-2 w-full rounded-xl border p-2"><option value="room">ทั้งห้อง</option><option value="student">รายคน</option></select></label>{scope === 'student' && <label className="block text-sm">นักศึกษา<select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="mt-2 w-full rounded-xl border p-2"><option value="">เลือกนักศึกษา</option>{summary.participants.map((person) => <option key={person.studentId} value={person.studentId}>{person.studentCode} · {person.fullName}</option>)}</select></label>}<p className="text-xs text-gray-500">เก็บงานเดิมทุกครั้ง ผู้ที่มี workspace เปิดอยู่จะไม่ได้รับ grant ซ้ำ</p></>}<label className="block text-sm">เหตุผล<input required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-xl border p-2" /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? 'กำลังบันทึก…' : 'ยืนยัน'}</button></form></Modal>
  </div>;
};
