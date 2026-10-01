import React, { useState } from 'react';
import {
  CalendarDays,
  Edit2,
  Eye,
  FileCode,
  FilePenLine,
  ListChecks,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import type { ExamSession } from '../../types';
import { ExamCreationWizard } from './ExamCreationWizard';
import { ExamDetailPage } from './ExamDetailPage';
import {
  ExamDraftRecord,
  filterExamDrafts,
  loadExamDrafts,
  removeExamDraft,
} from '../../services/examWizard';
import { getAuthorizedMonitoringExams } from '../../services/teacherMonitoring';
import { resolveAuthorizedExamDetail } from '../../services/teacherExamDetail';
import { canEditExamSetup, examStatusLabels, getEffectiveExamStatus } from '../../services/examStatus';
import { useExamClock } from '../../utils/useExamClock';
import {
  defaultTeacherExamFilters,
  filterTeacherExamSessions,
  TeacherExamFilters,
} from '../../services/teacherExamManagement';

interface WizardTarget {
  editingExam?: ExamSession;
  draft?: ExamDraftRecord;
}

type ExamManagementView = 'exams' | 'drafts';

export const CourseExamSessionManager: React.FC = () => {
  const now = useExamClock();
  const { academicState, currentTeacher, examSessions, courses, rooms, students, teachers, showToast } = useApp();
  const [activeView, setActiveView] = useState<ExamManagementView>('exams');
  const [examFilters, setExamFilters] = useState<TeacherExamFilters>(defaultTeacherExamFilters);
  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [wizardTarget, setWizardTarget] = useState<WizardTarget | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<ExamDraftRecord | null>(null);
  const [drafts, setDrafts] = useState<ExamDraftRecord[]>(() => (
    currentTeacher ? loadExamDrafts(currentTeacher.id) : []
  ));

  const refreshDrafts = () => setDrafts(currentTeacher ? loadExamDrafts(currentTeacher.id) : []);

  if (wizardTarget) {
    return (
      <ExamCreationWizard
        editingExam={wizardTarget.editingExam}
        initialDraft={wizardTarget.draft}
        onClose={() => setWizardTarget(null)}
        onSaved={(result) => {
          refreshDrafts();
          setActiveView(result === 'exam' ? 'exams' : 'drafts');
          setWizardTarget(null);
        }}
      />
    );
  }

  const authorizedSessions = getAuthorizedMonitoringExams(examSessions, courses);
  const filteredSessions = filterTeacherExamSessions(examSessions, courses, rooms, examFilters, now);
  const hasExamFilters = Boolean(examFilters.search.trim()) || examFilters.status !== 'all' || examFilters.mode !== 'all';
  const updateExamFilters = (updates: Partial<TeacherExamFilters>) => setExamFilters((current) => ({ ...current, ...updates }));

  const filteredDrafts = filterExamDrafts(drafts, courses, draftSearchTerm)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const statusBadge = (status: ExamSession['status']) => {
    if (status === 'in_progress') return <Badge variant="success">กำลังสอบ</Badge>;
    if (status === 'upcoming') return <Badge variant="warning">{examStatusLabels.upcoming}</Badge>;
    return <Badge variant="neutral">{examStatusLabels.completed}</Badge>;
  };

  const confirmDeleteDraft = () => {
    if (!draftToDelete) return;
    removeExamDraft(draftToDelete.id);
    setDraftToDelete(null);
    refreshDrafts();
    showToast('ลบร่างแล้ว', 'ร่างการสอบที่เลือกถูกลบโดยไม่กระทบการสอบที่สร้างแล้ว', 'success');
  };

  if (selectedExamId) {
    const detail = resolveAuthorizedExamDetail(selectedExamId, examSessions, courses, currentTeacher?.id);
    return detail ? <ExamDetailPage
      detail={detail}
      academicState={academicState}
      rooms={rooms}
      students={students}
      teachers={teachers}
      now={now}
      onBack={() => setSelectedExamId(null)}
      onEdit={(exam) => setWizardTarget({ editingExam: exam })}
    /> : <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <p className="font-semibold text-gray-800">ไม่พบการสอบที่คุณมีสิทธิ์ดู</p>
      <button type="button" onClick={() => setSelectedExamId(null)} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">ย้อนกลับ</button>
    </div>;
  }

  return (
    <div className="space-y-5 text-left">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold text-blue-600">การเตรียมและกำหนดการสอบ</p>
          <h1 className="mt-0.5 text-2xl font-bold text-gray-900">จัดการสอบ</h1>
          <p className="mt-1 text-xs text-gray-500">สร้าง ตรวจสอบ และแก้ไขการสอบสำหรับรายวิชาและ Section ที่คุณได้รับมอบหมาย</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-100 p-1" role="tablist" aria-label="มุมมองจัดการสอบ">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'exams'}
              onClick={() => setActiveView('exams')}
              className={`inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors sm:flex-none ${activeView === 'exams' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <ListChecks className="h-4 w-4" />การสอบทั้งหมด <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">{authorizedSessions.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'drafts'}
              onClick={() => setActiveView('drafts')}
              className={`inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors sm:flex-none ${activeView === 'drafts' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <FilePenLine className="h-4 w-4" />ร่างการสอบ <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">{drafts.length}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setWizardTarget({})}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />สร้างการสอบ
          </button>
        </div>
      </header>

      {activeView === 'exams' ? (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xs">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_160px_150px_auto]">
              <label className="relative min-w-0 sm:col-span-2 lg:col-span-1">
                <span className="sr-only">ค้นหาการสอบ</span>
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input value={examFilters.search} onChange={(event) => updateExamFilters({ search: event.target.value })} placeholder="ค้นหาชื่อการสอบ รหัสวิชา รายวิชา Section หรือห้องสอบ..." className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="min-w-0">
                <span className="sr-only">สถานะการสอบ</span>
                <select value={examFilters.status} onChange={(event) => updateExamFilters({ status: event.target.value as TeacherExamFilters['status'] })} className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500">
                  <option value="all">ทุกสถานะ</option>
                  <option value="upcoming">{examStatusLabels.upcoming}</option>
                  <option value="in_progress">กำลังสอบ</option>
                  <option value="completed">เสร็จสิ้น</option>
                </select>
              </label>
              <label className="min-w-0">
                <span className="sr-only">รูปแบบการสอบ</span>
                <select value={examFilters.mode} onChange={(event) => updateExamFilters({ mode: event.target.value as TeacherExamFilters['mode'] })} className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500">
                  <option value="all">ทุกรูปแบบ</option>
                  <option value="online">ออนไลน์</option>
                  <option value="offline">ออฟไลน์</option>
                </select>
              </label>
              <button type="button" onClick={() => setExamFilters(defaultTeacherExamFilters())} disabled={!hasExamFilters} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-default disabled:text-gray-400 disabled:hover:bg-transparent sm:col-span-2 lg:col-span-1"><RotateCcw className="h-4 w-4" />ล้างตัวกรอง</button>
            </div>
            {hasExamFilters && <p className="mt-2 text-[11px] text-gray-500" aria-live="polite">พบ {filteredSessions.length} จาก {authorizedSessions.length} รายการ</p>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="border-b border-gray-200 bg-gray-50 font-semibold text-gray-600"><tr><th className="px-5 py-3.5">การสอบ / รายวิชา</th><th className="px-4 py-3.5">วันเวลา</th><th className="px-4 py-3.5">ห้องสอบ</th><th className="px-4 py-3.5">รูปแบบ / ไฟล์</th><th className="px-4 py-3.5">สถานะ</th><th className="px-5 py-3.5 text-right">การดำเนินการ</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSessions.map(({ exam: session }) => {
                    const course = courses.find((candidate) => candidate.id === session.courseId);
                    const room = rooms.find((candidate) => candidate.id === session.roomId);
                    const effectiveStatus = getEffectiveExamStatus(session, now);
                    const editable = canEditExamSetup(session, new Date());
                    return (
                      <tr key={session.id} className="hover:bg-gray-50/70">
                        <td className="px-5 py-4"><p className="font-bold text-gray-900">{session.examName || `${course?.courseCode} การสอบ`}</p><p className="mt-1 text-[11px] text-gray-500">{course?.courseCode} — {course?.courseName} • Section {session.sectionNo}</p></td>
                        <td className="px-4 py-4"><p className="font-medium text-gray-800">{session.examDate}</p><p className="mt-1 font-mono text-[11px] text-gray-500">{session.startTime} - {session.endTime} ({session.durationMinutes} นาที)</p></td>
                        <td className="px-4 py-4"><p className="flex items-center gap-1 font-medium text-gray-800"><MapPin className="h-3.5 w-3.5 text-blue-500" />{room?.labName || '—'}</p><p className="mt-1 text-[11px] text-gray-500">ชั้น {room?.floor ?? '—'}</p></td>
                        <td className="px-4 py-4"><p className="flex items-center gap-1 font-semibold text-gray-700"><FileCode className="h-3.5 w-3.5 text-blue-600" />{session.format === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}</p><p className="mt-1 text-[11px] text-gray-500">{session.fileRequirements.acceptedExtensions.join(', ')} • {session.fileRequirements.maxSizeMb} MB</p></td>
                        <td className="px-4 py-4">{statusBadge(effectiveStatus)}</td>
                        <td className="px-5 py-4"><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => setSelectedExamId(session.id)} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100" aria-label={`ดูรายละเอียด ${session.examName || course?.courseCode}`}><Eye className="h-3.5 w-3.5" />ดู</button><button type="button" disabled={!editable} onClick={() => editable && setWizardTarget({ editingExam: session })} className="inline-flex min-h-8 items-center gap-1 rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-300" aria-label={`แก้ไข ${session.examName || course?.courseCode}`} title={editable ? 'แก้ไขการสอบ' : 'ไม่สามารถแก้ไขข้อมูลหลักระหว่างหรือหลังการสอบ'}><Edit2 className="h-4 w-4" /></button></div></td>
                      </tr>
                    );
                  })}
                  {filteredSessions.length === 0 && <tr><td colSpan={6} className="px-6 py-14 text-center"><CalendarDays className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 font-semibold text-gray-700">{hasExamFilters ? 'ไม่พบการสอบที่ตรงกับตัวกรอง' : 'ยังไม่มีการสอบ'}</p><p className="mt-1 text-[11px] text-gray-400">{hasExamFilters ? 'ลองเปลี่ยนคำค้นหา สถานะ หรือรูปแบบการสอบ' : 'สร้างการสอบใหม่เพื่อเริ่มจัดการรายการสอบ'}</p>{hasExamFilters && <button type="button" onClick={() => setExamFilters(defaultTeacherExamFilters())} className="mt-4 min-h-9 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">ล้างตัวกรอง</button>}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="space-y-3" role="tabpanel" aria-label="ร่างการสอบ">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xs">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={draftSearchTerm} onChange={(event) => setDraftSearchTerm(event.target.value)} placeholder="ค้นหาชื่อร่าง รหัสวิชา ชื่อวิชา หรือ Section..." className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          {filteredDrafts.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
              <div className="divide-y divide-gray-100">
                {filteredDrafts.map((draft) => {
                  const course = courses.find((candidate) => candidate.id === draft.state.courseId);
                  return (
                    <article key={draft.id} className="flex flex-col gap-3 p-4 hover:bg-gray-50/70 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0"><p className="truncate text-sm font-bold text-gray-900">{draft.state.examName || 'ยังไม่ระบุชื่อการสอบ'}</p><p className="mt-1 text-xs text-gray-600">{course ? `${course.courseCode} • ${course.courseName}` : 'ยังไม่เลือกรายวิชา'} • Section {draft.state.sectionNo || '—'}</p><p className="mt-1 text-[11px] text-gray-400">แก้ไขล่าสุด {new Date(draft.updatedAt).toLocaleString('th-TH')}</p></div>
                      <div className="flex shrink-0 gap-2"><button type="button" onClick={() => setWizardTarget({ draft })} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 sm:flex-none"><Edit2 className="h-4 w-4" />แก้ไขต่อ</button><button type="button" onClick={() => setDraftToDelete(draft)} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 sm:flex-none"><Trash2 className="h-4 w-4" />ลบ</button></div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-14 text-center">
              <FilePenLine className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 font-semibold text-gray-700">{drafts.length ? 'ไม่พบร่างที่ค้นหา' : 'ยังไม่มีร่างการสอบ'}</p>
              <p className="mt-1 text-xs text-gray-400">บันทึกข้อมูลระหว่างสร้างการสอบเพื่อกลับมาดำเนินการภายหลัง</p>
              {!drafts.length && <button type="button" onClick={() => setWizardTarget({})} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />สร้างการสอบ</button>}
            </div>
          )}
        </section>
      )}

      <Modal isOpen={Boolean(draftToDelete)} onClose={() => setDraftToDelete(null)} title="ยืนยันการลบร่างการสอบ" maxWidth="sm" footer={<><button type="button" onClick={() => setDraftToDelete(null)} className="min-h-10 rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">ยกเลิก</button><button type="button" onClick={confirmDeleteDraft} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"><Trash2 className="h-4 w-4" />ลบร่าง</button></>}>
        <p className="text-sm text-gray-600">ต้องการลบร่าง <strong className="text-gray-900">{draftToDelete?.state.examName || 'ยังไม่ระบุชื่อการสอบ'}</strong> ใช่หรือไม่ การสอบที่สร้างแล้วจะไม่ได้รับผลกระทบ</p>
      </Modal>

    </div>
  );
};
