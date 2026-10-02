import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Clock,
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  Search,
  Plus,
  Minus,
  RotateCcw,
  RefreshCw,
  ArrowRight,
  Monitor,
  Check,
  ArrowLeft,
  CalendarDays,
  MapPin,
  CalendarRange,
  ListChecks,
  GraduationCap,
} from 'lucide-react';
import { Badge, ExamSubmissionStatusBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ExamSession, ExamSessionStatus, Student, Violation, StudentExamStatus } from '../../types';
import { studentMatchesExamSection } from '../../services/courseState';
import {
  clearMonitoringFilters,
  defaultMonitoringView,
  deriveExamDisplayStatus,
  filterMonitoringExams,
  getAuthorizedMonitoringExams,
  getLocalDateInputValue,
  getMonitoringStatusCounts,
  MonitoringView,
  TeacherMonitoringExam,
} from '../../services/teacherMonitoring';
import { MonitoringCalendar } from './MonitoringCalendar';
import { MonitoringDatePickerPopover } from './MonitoringDatePickerPopover';
import { useExamClock } from '../../utils/useExamClock';
import { canAdjustExamTime, canReopenExamSubmissions, examStatusLabels } from '../../services/examStatus';
import { getDemoTimeState, subscribeDemoTime } from '../../services/demoTime';

export const LiveExamMonitoring: React.FC = () => {
  const now = useExamClock();
  const demoTime = useSyncExternalStore(subscribeDemoTime, getDemoTimeState, getDemoTimeState);
  const [selectedExamSessionId, setSelectedExamSessionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateInputValue());
  const [monitoringView, setMonitoringView] = useState<MonitoringView>(defaultMonitoringView);
  const [statusFilter, setStatusFilter] = useState<'all' | ExamSessionStatus>('all');
  const [courseFilter, setCourseFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSelectedDate(getLocalDateInputValue(demoTime.enabled && demoTime.simulatedNow !== null
      ? new Date(demoTime.simulatedNow) : new Date()));
    setMonitoringView('daily');
  }, [demoTime.enabled, demoTime.simulatedNow]);

  if (selectedExamSessionId) {
    return (
      <ExamMonitoringDetail
        examSessionId={selectedExamSessionId}
        now={now}
        onBack={() => setSelectedExamSessionId(null)}
      />
    );
  }

  return (
    <DailyExamOverview
      now={now}
      selectedDate={selectedDate}
      monitoringView={monitoringView}
      statusFilter={statusFilter}
      courseFilter={courseFilter}
      roomFilter={roomFilter}
      searchTerm={searchTerm}
      onSelectedDateChange={setSelectedDate}
      onMonitoringViewChange={setMonitoringView}
      onStatusFilterChange={setStatusFilter}
      onCourseFilterChange={setCourseFilter}
      onRoomFilterChange={setRoomFilter}
      onSearchTermChange={setSearchTerm}
      onSelectExam={setSelectedExamSessionId}
    />
  );
};

const statusStyles: Record<ExamSessionStatus, string> = {
  upcoming: 'border-amber-200 bg-amber-50 text-amber-700',
  in_progress: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  completed: 'border-slate-200 bg-slate-100 text-slate-600',
};

export const MonitoringExamStatusBadge: React.FC<{
  exam: ExamSession;
  now: Date;
  compact?: boolean;
}> = ({ exam, now, compact = false }) => {
  const status = deriveExamDisplayStatus(exam, now);
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold ${compact ? 'px-2 py-0.5' : 'px-3 py-1 text-[11px] font-bold'} ${statusStyles[status]}`}>{!compact && <span className="h-2 w-2 rounded-full bg-current opacity-70" />}{examStatusLabels[status]}</span>;
};

const formatThaiDate = (date: string) => date
  ? new Date(`${date}T12:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  : 'ยังไม่เลือกวันที่';

interface DailyExamOverviewProps {
  now: Date;
  selectedDate: string;
  monitoringView: MonitoringView;
  statusFilter: 'all' | ExamSessionStatus;
  courseFilter: string;
  roomFilter: string;
  searchTerm: string;
  onSelectedDateChange: (date: string) => void;
  onMonitoringViewChange: (view: MonitoringView) => void;
  onStatusFilterChange: (status: 'all' | ExamSessionStatus) => void;
  onCourseFilterChange: (courseId: string) => void;
  onRoomFilterChange: (roomId: string) => void;
  onSearchTermChange: (search: string) => void;
  onSelectExam: (examSessionId: string) => void;
}

const DailyExamOverview: React.FC<DailyExamOverviewProps> = ({
  now,
  selectedDate,
  monitoringView,
  statusFilter,
  courseFilter,
  roomFilter,
  searchTerm,
  onSelectedDateChange,
  onMonitoringViewChange,
  onStatusFilterChange,
  onCourseFilterChange,
  onRoomFilterChange,
  onSearchTermChange,
  onSelectExam,
}) => {
  const { currentTeacher, examSessions, courses, rooms, students, seatAssignments, submissions, violations } = useApp();

  const authorizedExams = useMemo(
    () => getAuthorizedMonitoringExams(examSessions, courses),
    [courses, examSessions],
  );
  const examsOnSelectedDate = useMemo(
    () => authorizedExams.filter(({ exam }) => exam.examDate === selectedDate),
    [authorizedExams, selectedDate],
  );
  const filteredExams = useMemo(() => filterMonitoringExams(authorizedExams, rooms, {
    date: selectedDate,
    status: statusFilter,
    courseId: courseFilter,
    roomId: roomFilter,
    search: searchTerm,
  }, now), [authorizedExams, courseFilter, now, roomFilter, rooms, searchTerm, selectedDate, statusFilter]);

  const availableCourses = useMemo(() => Array.from(new Map(
    examsOnSelectedDate.map(({ course }) => [course.id, course]),
  ).values()), [examsOnSelectedDate]);
  const availableRooms = useMemo(() => Array.from(new Map(
    examsOnSelectedDate.map(({ exam }) => {
      const room = rooms.find((candidate) => candidate.id === exam.roomId);
      return room ? [room.id, room] : null;
    }).filter((entry): entry is [string, typeof rooms[number]] => Boolean(entry)),
  ).values()), [examsOnSelectedDate, rooms]);

  const statusCounts = getMonitoringStatusCounts(examsOnSelectedDate, selectedDate, now);

  const renderExamCard = ({ exam, course, section }: TeacherMonitoringExam) => {
    const room = rooms.find((candidate) => candidate.id === exam.roomId);
    const eligibleStudents = students.filter((student) => studentMatchesExamSection(student, exam, section, now));
    const enteredStudentIds = new Set(seatAssignments
      .filter((assignment) => assignment.examId === exam.id)
      .map((assignment) => assignment.studentId));
    const submittedStudentIds = new Set(submissions
      .filter((submission) => submission.examId === exam.id && ['submitted', 'late'].includes(submission.status))
      .map((submission) => submission.studentId));
    const violationCount = violations.filter((violation) => violation.examId === exam.id).length;
    const isPrimaryTeacher = (section.primaryTeacherId || section.teacherId) === currentTeacher?.id;

    return (
      <article key={exam.id} className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:border-blue-200 hover:shadow-md sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">{course.courseCode}</span>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">Section {exam.sectionNo}</span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${isPrimaryTeacher ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{isPrimaryTeacher ? 'อาจารย์ผู้สอนหลัก' : 'อาจารย์ร่วมสอน'}</span>
          </div>
          <MonitoringExamStatusBadge exam={exam} now={now} />
        </div>

        <h2 className="mt-2 truncate text-sm font-bold text-gray-950 sm:text-base">{course.courseName}</h2>
        {exam.examName && <p className="mt-0.5 truncate text-xs font-medium text-blue-600">{exam.examName}</p>}

        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
          <div className="grid gap-2 sm:grid-cols-2"><span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-blue-500" /><strong className="text-gray-700">เวลา:</strong> {exam.startTime} - {exam.endTime} น.</span><span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-blue-500" /><strong className="text-gray-700">ห้อง:</strong> {room?.labName || '—'}</span></div>
          <p className="mt-2 text-[11px] text-gray-500">{formatThaiDate(exam.examDate)} • {exam.durationMinutes} นาที • ห้องปฏิบัติการ{exam.format === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[10px] sm:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-slate-50 px-2 py-2"><span className="block text-gray-500">ผู้มีสิทธิ์</span><strong className="text-sm text-gray-900">{eligibleStudents.length}</strong></div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-2"><span className="block text-emerald-600">เข้าสอบแล้ว</span><strong className="text-sm text-emerald-900">{enteredStudentIds.size}</strong></div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-2 py-2"><span className="block text-amber-600">ยังไม่เข้า</span><strong className="text-sm text-amber-900">{Math.max(eligibleStudents.length - enteredStudentIds.size, 0)}</strong></div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-2 py-2"><span className="block text-blue-600">ส่งคำตอบ</span><strong className="text-sm text-blue-900">{submittedStudentIds.size}</strong></div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <span className={`text-[11px] ${violationCount > 0 ? 'font-semibold text-red-600' : 'text-gray-400'}`}>{violationCount > 0 ? `ผิดปกติ ${violationCount} เหตุการณ์` : `ID: ${exam.id}`}</span>
          <button type="button" onClick={() => onSelectExam(exam.id)} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">ดูรายละเอียด<ArrowRight className="h-4 w-4" /></button>
        </div>
      </article>
    );
  };

  const clearFilters = () => {
    const cleared = clearMonitoringFilters({
      date: selectedDate,
      status: statusFilter,
      courseId: courseFilter,
      roomId: roomFilter,
      search: searchTerm,
    });
    onStatusFilterChange(cleared.status);
    onCourseFilterChange(cleared.courseId);
    onRoomFilterChange(cleared.roomId);
    onSearchTermChange(cleared.search);
  };

  return (
    <div className="space-y-5 text-left">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><CalendarDays className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-blue-600">พอร์ทัลอาจารย์ผู้สอน <span className="px-1 text-gray-300">•</span> ภาพรวมการสอบ</p>
            <h1 className="text-2xl font-bold text-gray-900">ติดตามการสอบ</h1>
            <p className="text-xs text-gray-500">ตรวจสอบรายการสอบตามตารางประจำวัน และเลือกการสอบเพื่อเข้าสู่ระบบติดตามความคืบหน้าแบบ Real-time</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl border border-gray-200 bg-gray-100 p-1" role="tablist" aria-label="มุมมองติดตามการสอบ">
            <button type="button" role="tab" aria-selected={monitoringView === 'daily'} onClick={() => onMonitoringViewChange('daily')} className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold sm:flex-none ${monitoringView === 'daily' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><ListChecks className="h-4 w-4" />รายการประจำวัน</button>
            <button type="button" role="tab" aria-selected={monitoringView === 'calendar'} onClick={() => onMonitoringViewChange('calendar')} className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold sm:flex-none ${monitoringView === 'calendar' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}><CalendarRange className="h-4 w-4" />ปฏิทินการสอบ</button>
          </div>
          <MonitoringDatePickerPopover
            exams={authorizedExams}
            selectedDate={selectedDate}
            onSelectDate={onSelectedDateChange}
            onShowDaily={() => onMonitoringViewChange('daily')}
          />
        </div>
      </header>

      {monitoringView === 'calendar' ? <MonitoringCalendar exams={authorizedExams} selectedDate={selectedDate} onSelectDate={onSelectedDateChange} onShowDaily={() => onMonitoringViewChange('daily')} /> : <>
        <section className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-xs font-bold text-blue-600">กำหนดการสอบประจำวันที่ {formatThaiDate(selectedDate)}</p><h2 className="mt-1 text-xl font-bold text-gray-950">{selectedDate === getLocalDateInputValue(now) ? 'วันนี้' : 'วันที่เลือก'}มีการสอบ {statusCounts.all} รายการ</h2><p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500"><GraduationCap className="h-4 w-4 text-blue-600" />อาจารย์ผู้คุมสอบ: <strong className="text-gray-700">{currentTeacher?.fullName || '—'}</strong> (แสดงเฉพาะรายวิชาและตอนเรียนที่ท่านได้รับมอบหมาย)</p></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([['all', 'ทั้งหมด'], ['in_progress', 'กำลังสอบ'], ['upcoming', 'กำลังจะเริ่ม'], ['completed', 'เสร็จสิ้น']] as Array<['all' | ExamSessionStatus, string]>).map(([status, label]) => <button key={status} type="button" onClick={() => onStatusFilterChange(status)} className={`min-w-24 rounded-xl border px-3 py-2 text-center transition-all ${statusFilter === status ? 'border-blue-500 bg-white text-blue-700 ring-2 ring-blue-500/15' : 'border-gray-200 bg-white/80 text-gray-600 hover:border-blue-200'}`}><span className="block text-[10px] font-medium">{label}</span><strong className="mt-0.5 block text-lg text-gray-900">{statusCounts[status]}</strong></button>)}</div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xs">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(250px,1.5fr)_130px_1fr_1fr_auto]">
            <label className="relative"><span className="sr-only">ค้นหา</span><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} placeholder="ค้นหารหัสวิชา, ชื่อวิชา, ชื่อการสอบ, Section หรือห้องสอบ..." className="h-10 w-full rounded-xl border border-gray-300 pl-9 pr-3 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500" /></label>
            <label><span className="sr-only">สถานะ</span><select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as 'all' | ExamSessionStatus)} className="h-10 w-full rounded-xl border border-gray-300 px-3 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"><option value="all">สถานะ: ทั้งหมด</option><option value="in_progress">กำลังสอบ</option><option value="upcoming">กำลังจะเริ่ม</option><option value="completed">เสร็จสิ้น</option></select></label>
            <label><span className="sr-only">รายวิชา</span><select value={courseFilter} onChange={(event) => onCourseFilterChange(event.target.value)} className="h-10 w-full rounded-xl border border-gray-300 px-3 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"><option value="">ทุกรายวิชา</option>{availableCourses.map((course) => <option key={course.id} value={course.id}>{course.courseCode} — {course.courseName}</option>)}</select></label>
            <label><span className="sr-only">ห้องสอบ</span><select value={roomFilter} onChange={(event) => onRoomFilterChange(event.target.value)} className="h-10 w-full rounded-xl border border-gray-300 px-3 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"><option value="">ทุกห้องสอบ</option>{availableRooms.map((room) => <option key={room.id} value={room.id}>{room.labName}</option>)}</select></label>
            <button type="button" onClick={clearFilters} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50"><RefreshCw className="h-4 w-4" />ล้างตัวกรอง</button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2" aria-live="polite">
          {filteredExams.length > 0 ? filteredExams.map(renderExamCard) : <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center lg:col-span-2"><CalendarDays className="mx-auto h-10 w-10 text-gray-300" /><h2 className="mt-3 text-base font-bold text-gray-900">{examsOnSelectedDate.length ? 'ไม่พบรายการตามตัวกรอง' : 'ไม่มีการสอบในวันที่เลือก'}</h2><p className="mt-1 text-xs text-gray-500">ลองเลือกวันที่อื่น หรือปรับตัวกรอง</p><div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => { onSelectedDateChange(getLocalDateInputValue(now)); clearFilters(); }} className="min-h-9 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700">กลับไปวันนี้</button><button type="button" onClick={() => onMonitoringViewChange('calendar')} className="min-h-9 rounded-xl border border-gray-300 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50">เปิดปฏิทิน</button></div></div>}
        </section>
      </>}
    </div>
  );
};

interface ExamMonitoringDetailProps {
  examSessionId: string;
  now: Date;
  onBack: () => void;
}

const ExamMonitoringDetail: React.FC<ExamMonitoringDetailProps> = ({ examSessionId, now, onBack }) => {
  const {
    examSessions,
    courses,
    rooms,
    students,
    seatAssignments,
    submissions,
    violations,
    auditLogs,
    adjustExamTime,
    reopenSubmission,
    showToast,
    triggerViolation,
    language,
  } = useApp();

  const isThai = language === 'th';
  const activeExam = examSessions.find((exam) => exam.id === examSessionId);
  const course = courses.find((c) => c.id === activeExam?.courseId);
  const room = rooms.find((r) => r.id === activeExam?.roomId);

  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected student for detail modal
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<{
    student: Student;
    seatNo: string;
    status: StudentExamStatus;
    violationCount: number;
    submission?: any;
  } | null>(null);

  // Time Control Modal
  const [showTimeControlModal, setShowTimeControlModal] = useState(false);
  const [timeControlDelta, setTimeControlDelta] = useState<number>(5);
  const [timeControlScope, setTimeControlScope] = useState<'room' | 'student'>('room');
  const [timeControlTargetStudent, setTimeControlTargetStudent] = useState<string>('');
  const [timeControlReason, setTimeControlReason] = useState(
    isThai ? 'ชดเชยความหน่วงของเครือข่ายห้องปฏิบัติการ' : 'Laboratory network jitter compensation'
  );

  // Reopen Modal
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenMinutes, setReopenMinutes] = useState(15);
  const [reopenScope, setReopenScope] = useState<'room' | 'student'>('student');
  const [reopenTargetStudent, setReopenTargetStudent] = useState(students[0]?.id || '');
  const [reopenReason, setReopenReason] = useState(
    isThai ? 'เครื่องสอบขัดข้อง / ต้องรีสตาร์ตระบบไฟ' : 'Equipment reboot / power supply disconnect'
  );

  // Live auto-refresh simulation ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdated(new Date().toLocaleTimeString());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!activeExam || !course || !room) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
        <AlertOctagon className="mx-auto h-10 w-10 text-gray-300" />
        <h1 className="mt-3 text-base font-bold text-gray-900">ไม่พบข้อมูลการสอบที่เลือก</h1>
        <button type="button" onClick={onBack} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
          ย้อนกลับไปภาพรวมประจำวัน
        </button>
      </div>
    );
  }

  const section = course.sections.find((candidate) => candidate.sectionNo === activeExam.sectionNo);
  // Persisted schedule operations remain governed by real time in demo mode.
  const canAdjustTime = canAdjustExamTime(activeExam, new Date());
  const canReopen = canReopenExamSubmissions(activeExam, new Date());
  const eligibleStudentCount = section
    ? students.filter((student) => studentMatchesExamSection(student, activeExam, section, now)).length
    : 0;
  const examViolations = violations.filter((violation) => violation.examId === activeExam.id);
  const submittedCount = new Set(submissions
    .filter((submission) => submission.examId === activeExam.id && ['submitted', 'late'].includes(submission.status))
    .map((submission) => submission.studentId)).size;

  const hasActiveReopening = (studentId: string) => {
    const reopening =
      activeExam?.reopenedStudents?.[studentId] || activeExam?.reopenedStudents?.['*'];
    return Boolean(reopening && new Date(reopening.reopenedUntil).getTime() > now.getTime());
  };

  // Compute student status for each seat
  const getSeatStatus = (seatNo: string): { status: StudentExamStatus; student?: Student; violation?: Violation } => {
    const station = room?.seats?.find((s) => s.seatNo === seatNo);
    if (station?.status === 'offline' || station?.status === 'damaged') {
      return { status: 'offline' };
    }

    const assignment = seatAssignments.find(
      (sa) => sa.examId === activeExam?.id && sa.seatNo === seatNo
    );
    if (!assignment) return { status: 'not_started' };

    const student = students.find((s) => s.id === assignment.studentId);
    const violation = violations.find(
      (v) => v.examId === activeExam?.id && v.studentId === student?.id
    );

    if (violation) return { status: 'violation', student, violation };

    const sub = submissions.find(
      (s) => s.examId === activeExam?.id && s.studentId === student?.id
    );

    if (sub?.status === 'submitted') return { status: 'submitted', student };
    if (sub?.status === 'late') return { status: 'late', student };

    // Check if reopened
    if (student && hasActiveReopening(student.id)) {
      return { status: 'reopened', student };
    }

    return { status: 'working', student };
  };

  // Aggregated totals
  let totalAssigned = 0;
  let violationCount = 0;
  let offlineCount = 0;

  (room?.seats || []).forEach((seat) => {
    const res = getSeatStatus(seat.seatNo);
    if (res.student) totalAssigned++;
    if (res.status === 'violation') violationCount++;
    else if (res.status === 'offline') offlineCount++;
  });

  const handleApplyTimeControl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeControlReason || !canAdjustExamTime(activeExam, new Date())) return;
    adjustExamTime(
      activeExam.id,
      timeControlDelta,
      timeControlScope,
      timeControlScope === 'student' ? timeControlTargetStudent : undefined,
      timeControlReason
    );
    setShowTimeControlModal(false);
  };

  const handleApplyReopen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason || !canReopenExamSubmissions(activeExam, new Date())) return;
    reopenSubmission(
      activeExam.id,
      reopenMinutes,
      reopenScope,
      reopenScope === 'student' ? reopenTargetStudent : undefined,
      reopenReason
    );
    setShowReopenModal(false);
  };

  const rows = [...new Set(room.seats.map((seat) => seat.seatNo.replace(/\d+$/, '')))];
  const columns = Array.from({ length: room.columns || 8 }, (_, i) => i + 1);

  // Student roster rows for T6 Table
  const examineeStatusList = seatAssignments
    .filter((sa) => sa.examId === activeExam?.id)
    .map((sa) => {
      const student = students.find((s) => s.id === sa.studentId);
      const station = room.seats.find((s) => s.seatNo === sa.seatNo);
      const sub = submissions.find((s) => s.examId === activeExam?.id && s.studentId === sa.studentId);
      const stdViolations = violations.filter((v) => v.examId === activeExam?.id && v.studentId === sa.studentId);

      let status: StudentExamStatus = 'working';
      if (stdViolations.length > 0) status = 'violation';
      else if (sub?.status === 'submitted') status = 'submitted';
      else if (sub?.status === 'late') status = 'late';
      else if (student && hasActiveReopening(student.id)) status = 'reopened';

      return {
        student: student!,
        seatNo: sa.seatNo,
        station,
        status,
        submission: sub,
        violations: stdViolations,
      };
    })
    .filter((item) => {
      if (!item.student) return false;
      if (activeFilter === 'submitted' && item.status !== 'submitted') return false;
      if (activeFilter === 'working' && item.status !== 'working') return false;
      if (activeFilter === 'late' && item.status !== 'late') return false;
      if (activeFilter === 'violation' && item.status !== 'violation') return false;

      const search = searchTerm.toLowerCase();
      return (
        item.student.fullName.toLowerCase().includes(search) ||
        item.student.studentCode.includes(search) ||
        item.seatNo.toLowerCase().includes(search)
      );
    });

  return (
    <div className="space-y-6 text-left">
      {/* Top Header & Telemetry Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex min-h-9 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <ArrowLeft className="h-4 w-4" />
            ย้อนกลับไปภาพรวมประจำวัน
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              {isThai ? 'รายละเอียดการติดตามการสอบ' : 'Exam Monitoring Detail'}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs text-gray-500">
              {isThai ? 'อัปเดตอัตโนมัติสด: ' : 'Live Auto-Refresh: '}
              {lastUpdated}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {activeExam.examName || `${course.courseCode}: ${course.courseName}`}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            {activeExam.examName && <span>{course.courseCode}: {course.courseName}</span>}
            <span>Section {activeExam.sectionNo}</span>
            <span>{formatThaiDate(activeExam.examDate)}</span>
            <span>{activeExam.startTime} - {activeExam.endTime}</span>
            <span>{activeExam.durationMinutes} นาที</span>
            <span>ห้อง {room.labName}</span>
            <MonitoringExamStatusBadge exam={activeExam} now={now} compact />
          </div>
        </div>

        {/* Global Time Controls Button Group */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            disabled={!canAdjustTime}
            onClick={() => {
              setTimeControlDelta(5);
              setTimeControlScope('room');
              setShowTimeControlModal(true);
            }}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isThai ? '+5 นาที (ทั้งห้อง)' : '+5 Min (Room)'}</span>
          </button>

          <button
            disabled={!canAdjustTime}
            onClick={() => {
              setTimeControlDelta(-5);
              setTimeControlScope('room');
              setShowTimeControlModal(true);
            }}
            className="px-3 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="w-3.5 h-3.5" />
            <span>{isThai ? '-5 นาที' : '-5 Min'}</span>
          </button>

          <button
            disabled={!canReopen}
            onClick={() => setShowReopenModal(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isThai ? 'เปิดรับส่งข้อสอบใหม่' : 'Reopen Submission'}</span>
          </button>
        </div>
      </div>

      {/* Real-time Status Metric Badges / Clickable Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setActiveFilter('all')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-center ${
            activeFilter === 'all'
              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400/20'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-[11px] text-gray-500 font-medium block">
            {isThai ? 'ผู้มีสิทธิ์สอบทั้งหมด' : 'Eligible Students'}
          </span>
          <span className="text-2xl font-bold text-gray-900 font-mono mt-0.5 block">{eligibleStudentCount}</span>
        </div>

        <div
          onClick={() => setActiveFilter('submitted')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-center ${
            activeFilter === 'submitted'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20'
              : 'bg-white border-gray-200 hover:border-emerald-200'
          }`}
        >
          <span className="text-[11px] text-emerald-700 font-medium block">
            {isThai ? 'ส่งแล้ว (สีเขียว)' : 'Submitted (Green)'}
          </span>
          <span className="text-2xl font-bold text-emerald-800 font-mono mt-0.5 block">{submittedCount}</span>
        </div>

        <div className="p-3.5 rounded-2xl border border-gray-200 bg-white text-center">
          <span className="text-[11px] text-blue-700 font-medium block">
            {isThai ? 'เข้าสอบแล้ว' : 'Entered'}
          </span>
          <span className="text-2xl font-bold text-blue-800 font-mono mt-0.5 block">{totalAssigned}</span>
        </div>

        <div className="p-3.5 rounded-2xl border border-gray-200 bg-white text-center">
          <span className="text-[11px] text-amber-700 font-medium block">
            {isThai ? 'ยังไม่เข้าสอบ' : 'Not Entered'}
          </span>
          <span className="text-2xl font-bold text-amber-800 font-mono mt-0.5 block">{Math.max(eligibleStudentCount - totalAssigned, 0)}</span>
        </div>

        <div
          onClick={() => setActiveFilter('violation')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-center ${
            activeFilter === 'violation'
              ? 'bg-red-50 border-red-400 ring-2 ring-red-400/20'
              : 'bg-white border-gray-200 hover:border-red-200'
          }`}
        >
          <span className="text-[11px] text-red-700 font-medium block">
            {isThai ? 'ละเมิดกฎ (สีแดง)' : 'Violation (Red)'}
          </span>
          <span className="text-2xl font-bold text-red-800 font-mono mt-0.5 block">{violationCount}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-gray-200 text-center">
          <span className="text-[11px] text-gray-500 font-medium block">
            {isThai ? 'ออฟไลน์ / ชำรุด' : 'Offline / Damaged'}
          </span>
          <span className="text-2xl font-bold text-gray-800 font-mono mt-0.5 block">{offlineCount}</span>
        </div>
      </div>

      {/* Main Grid: Interactive Real-Time Seat Map (Left 3 cols) & Violation Live Feed (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Real-time Seat Map */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-gray-700" />
              <h2 className="text-sm font-bold text-gray-900">
                {isThai ? `ผังที่นั่งและสถานะเครื่องสอบสด (${room.labName})` : `Live Interactive Workstation Grid (${room.labName})`}
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {isThai ? 'ส่งแล้ว' : 'Submitted'}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {isThai ? 'กำลังสอบ' : 'Working'}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> {isThai ? 'ส่งช้า' : 'Late'}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> {isThai ? 'ละเมิดกฎ' : 'Violation'}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> {isThai ? 'ออฟไลน์' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="space-y-3.5">
            {rows.map((rowLetter) => (
              <div key={rowLetter} className="flex items-center gap-2">
                <span className="w-6 font-bold text-gray-500 text-xs font-mono text-center">
                  {rowLetter}
                </span>

                <div className="grid gap-2 flex-1 min-w-0" style={{ gridTemplateColumns: `repeat(${room.columns || 1}, minmax(0, 1fr))` }}>
                  {columns.map((colNum) => {
                    const seatNo = `${rowLetter}${colNum}`;
                    const res = getSeatStatus(seatNo);

                    // Dynamic colors matching PRD specs
                    let colorClass = 'bg-gray-50 border-gray-200 text-gray-400'; // empty
                    if (res.status === 'submitted') {
                      colorClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 hover:shadow-md';
                    } else if (res.status === 'working') {
                      colorClass = 'bg-blue-50 border-blue-400 text-blue-900 hover:shadow-md';
                    } else if (res.status === 'late') {
                      colorClass = 'bg-amber-50 border-amber-400 text-amber-900 hover:shadow-md';
                    } else if (res.status === 'violation') {
                      colorClass = 'bg-red-50 border-red-500 text-red-900 ring-2 ring-red-400/40 animate-pulse hover:shadow-lg';
                    } else if (res.status === 'reopened') {
                      colorClass = 'bg-purple-50 border-purple-400 text-purple-900 hover:shadow-md';
                    } else if (res.status === 'offline') {
                      colorClass = 'bg-gray-100 border-gray-300 text-gray-500 opacity-60';
                    }

                    return (
                      <div
                        key={seatNo}
                        onClick={() => {
                          if (res.student) {
                            setSelectedStudentForDetail({
                              student: res.student,
                              seatNo,
                              status: res.status,
                              violationCount: res.violation ? 1 : 0,
                            });
                          }
                        }}
                        className={`p-2 rounded-xl border transition-all cursor-pointer text-center flex flex-col justify-between min-h-[72px] ${colorClass}`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                          <span>{seatNo}</span>
                          {res.status === 'violation' ? (
                            <ShieldAlert className="w-3.5 h-3.5 text-red-600 animate-bounce" />
                          ) : res.status === 'submitted' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : null}
                        </div>

                        {res.student ? (
                          <div className="truncate text-left mt-1">
                            <div className="text-[11px] font-bold truncate">
                              {res.student.fullName.split(' ')[0]}
                            </div>
                            <div className="text-[9px] font-mono opacity-80">
                              {res.student.studentCode.slice(-4)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] opacity-60 mt-1">
                            {res.status === 'offline' ? 'Offline' : 'Open'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time Violation Feed (1 col) */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>{isThai ? 'บันทึกการละเมิดสด' : 'Violation Feed'}</span>
            </h3>
            <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {examViolations.length}
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[480px] flex-1 pr-1">
            {examViolations.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                {isThai ? 'ไม่พบการละเมิดกฎในขณะนี้' : 'No active integrity breaches detected.'}
              </div>
            ) : (
              examViolations.map((vio) => {
                const std = students.find((s) => s.id === vio.studentId);
                return (
                  <div
                    key={vio.id}
                    onClick={() => {
                      if (std) {
                        setSelectedStudentForDetail({
                          student: std,
                          seatNo: vio.seatNo,
                          status: 'violation',
                          violationCount: 1,
                        });
                      }
                    }}
                    className="p-3 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-50 hover:shadow-xs transition-all text-xs cursor-pointer text-left"
                  >
                    <div className="flex items-center justify-between font-bold text-red-900 text-xs mb-1">
                      <span className="flex items-center gap-1">
                        <AlertOctagon className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>{isThai ? 'ที่นั่ง' : 'Seat'} {vio.seatNo}</span>
                      </span>
                      <span className="font-mono text-[10px] text-red-700">{vio.detectedAt}</span>
                    </div>

                    <div className="font-semibold text-gray-900 truncate">
                      {std?.fullName || (isThai ? 'ผู้เข้าสอบ' : 'Examinee')} ({std?.studentCode})
                    </div>
                    <div className="text-[11px] text-red-800 mt-1 leading-snug">
                      {vio.detail}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          SCREEN T6: STUDENT EXAM STATUS TABLE
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isThai ? 'ตารางสถานะการสอบของนักศึกษา (T6)' : 'Student Examination Status Table (T6)'}
            </h2>
            <p className="text-xs text-gray-500">
              {isThai
                ? 'รายละเอียดสถานะการทำข้อสอบ บันทึกเวลา และประวัติความถูกต้องรายบุคคล'
                : 'Granular view of examinee workstation telemetry, timestamps, and integrity logs'}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder={isThai ? 'ค้นหาตามที่นั่ง, นักศึกษา...' : 'Filter by seat, student...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3.5">{isThai ? 'ที่นั่งสอบ' : 'Assigned Seat'}</th>
                <th className="px-4 py-3.5">{isThai ? 'ผู้เข้าสอบ' : 'Examinee'}</th>
                <th className="px-4 py-3.5">{isThai ? 'IP / MAC เครื่องสอบ' : 'Workstation IP / MAC'}</th>
                <th className="px-4 py-3.5">{isThai ? 'สถานะการส่ง' : 'Submission Status'}</th>
                <th className="px-4 py-3.5">{isThai ? 'เวลาที่ส่ง' : 'Submitted Time'}</th>
                <th className="px-4 py-3.5">{isThai ? 'ความถูกต้อง & การละเมิด' : 'Integrity & Violations'}</th>
                <th className="px-6 py-3.5 text-right">{isThai ? 'การจัดการ' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {examineeStatusList.map((row) => (
                <tr key={row.student.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-3.5">
                    <span className="font-mono font-bold text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-200">
                      {isThai ? 'ที่นั่ง' : 'Seat'} {row.seatNo}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-gray-900">{row.student.fullName}</div>
                    <div className="text-gray-500 font-mono text-[11px]">{row.student.studentCode}</div>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-gray-600">
                    <div>{row.station?.ip || '192.168.10.x'}</div>
                    <div className="text-[10px] text-gray-400">{row.station?.mac || 'AC:DE:48:00:11:xx'}</div>
                  </td>

                  <td className="px-4 py-3.5">
                    <ExamSubmissionStatusBadge status={row.status} />
                  </td>

                  <td className="px-4 py-3.5 font-mono text-gray-600">
                    {row.submission?.submittedAt
                      ? new Date(row.submission.submittedAt).toLocaleTimeString()
                      : '—'}
                  </td>

                  <td className="px-4 py-3.5">
                    {row.violations.length > 0 ? (
                      <Badge variant="danger" size="sm">
                        <AlertOctagon className="w-3 h-3" />
                        <span>
                          {row.violations.length} {isThai ? 'การละเมิด' : 'Violation(s)'}
                        </span>
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm">
                        <Check className="w-3 h-3" />
                        <span>{isThai ? 'ปกติ' : 'Clean'}</span>
                      </Badge>
                    )}
                  </td>

                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() =>
                        setSelectedStudentForDetail({
                          student: row.student,
                          seatNo: row.seatNo,
                          status: row.status,
                          violationCount: row.violations.length,
                          submission: row.submission,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      {isThai ? 'รายละเอียด / จัดการ' : 'Detail / Manage'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* STUDENT DETAIL & PROCTOR OVERRIDE MODAL */}
      <Modal
        isOpen={!!selectedStudentForDetail}
        onClose={() => setSelectedStudentForDetail(null)}
        title={
          isThai
            ? `รายละเอียดเครื่องสอบนักศึกษา: ที่นั่ง ${selectedStudentForDetail?.seatNo}`
            : `Examinee Station Detail: Seat ${selectedStudentForDetail?.seatNo}`
        }
        maxWidth="lg"
      >
        {selectedStudentForDetail && (
          <div className="space-y-4 text-left text-xs">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 shrink-0">
                {selectedStudentForDetail.student.faceReferenceUrl ? (
                  <img
                    src={selectedStudentForDetail.student.faceReferenceUrl}
                    alt={selectedStudentForDetail.student.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-gray-500">
                    {selectedStudentForDetail.student.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-900">
                  {selectedStudentForDetail.student.fullName}
                </div>
                <div className="text-gray-500 font-mono">
                  {selectedStudentForDetail.student.studentCode} • {selectedStudentForDetail.student.faculty}
                </div>
                <div className="mt-1">
                  <ExamSubmissionStatusBadge status={selectedStudentForDetail.status} />
                </div>
              </div>
            </div>

            {/* If violation exists */}
            {selectedStudentForDetail.violationCount > 0 && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  <span>{isThai ? 'พบการละเมิดกฎความปลอดภัย:' : 'Flagged Integrity Breach:'}</span>
                </div>
                {examViolations
                  .filter((v) => v.studentId === selectedStudentForDetail.student.id)
                  .map((v) => (
                    <div key={v.id} className="text-xs">
                      • {v.detail} ({isThai ? 'ตรวจพบเวลา' : 'Detected at'} {v.detectedAt})
                    </div>
                  ))}
              </div>
            )}

            {/* Quick Individual Proctor Actions */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
              <span className="font-bold text-blue-950 block">
                {isThai ? 'คำสั่งควบคุมเฉพาะรายบุคคล:' : 'Individual Proctor Actions:'}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canAdjustTime}
                  onClick={() => {
                    adjustExamTime(
                      activeExam.id,
                      5,
                      'student',
                      selectedStudentForDetail.student.id,
                      isThai ? 'ชดเชยเวลาเครื่องหน่วงเฉพาะรายบุคคล' : 'Individual station latency grace'
                    );
                    setSelectedStudentForDetail(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isThai ? '+5 นาที (นักศึกษาคนนี้)' : '+5 Mins (This Student)'}
                </button>
                <button
                  type="button"
                  disabled={!canReopen}
                  onClick={() => {
                    reopenSubmission(
                      activeExam.id,
                      15,
                      'student',
                      selectedStudentForDetail.student.id,
                      isThai ? 'เปิดสิทธิ์ส่งใหม่เนื่องจากเครื่องรีสตาร์ต' : 'Individual equipment restart'
                    );
                    setSelectedStudentForDetail(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-[11px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isThai ? 'เปิดรับส่งข้อสอบใหม่ (+15 นาที)' : 'Reopen Submission (+15m)'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* TIME CONTROL MODAL (+5 / -5) */}
      <Modal
        isOpen={showTimeControlModal}
        onClose={() => setShowTimeControlModal(false)}
        title={isThai ? 'ปรับระยะเวลาการทำและส่งข้อสอบ' : 'Adjust Examination Submission Duration'}
        maxWidth="md"
      >
        <form onSubmit={handleApplyTimeControl} className="space-y-4 text-left text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              {isThai ? 'ระยะเวลาที่ต้องการปรับเปลี่ยน' : 'Adjustment Delta'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTimeControlDelta(5)}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer ${
                  timeControlDelta === 5 ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-300 text-gray-700'
                }`}
              >
                {isThai ? '+5 นาที' : '+5 Minutes'}
              </button>
              <button
                type="button"
                onClick={() => setTimeControlDelta(-5)}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer ${
                  timeControlDelta === -5 ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-300 text-gray-700'
                }`}
              >
                {isThai ? '-5 นาที' : '-5 Minutes'}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              {isThai ? 'ขอบเขตการใช้งาน' : 'Application Scope'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTimeControlScope('room')}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer ${
                  timeControlScope === 'room' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-300 text-gray-700'
                }`}
              >
                {isThai ? `ทั้งห้องสอบ (${room.labName})` : `Entire Room (${room.labName})`}
              </button>
              <button
                type="button"
                onClick={() => setTimeControlScope('student')}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer ${
                  timeControlScope === 'student' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-300 text-gray-700'
                }`}
              >
                {isThai ? 'เฉพาะรายบุคคล' : 'Individual Student'}
              </button>
            </div>
          </div>

          {timeControlScope === 'student' && (
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                {isThai ? 'เลือกนักศึกษา' : 'Select Student'}
              </label>
              <select
                value={timeControlTargetStudent}
                onChange={(e) => setTimeControlTargetStudent(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.studentCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              {isThai ? 'เหตุผลในการปรับเวลา (จำเป็น)' : 'Reason for Adjustment (Required)'}
            </label>
            <input
              type="text"
              required
              value={timeControlReason}
              onChange={(e) => setTimeControlReason(e.target.value)}
              placeholder={isThai ? 'เช่น ชดเชยความล่าช้าของระบบเครือข่าย' : 'e.g. Network latency compensation'}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowTimeControlModal(false)}
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50 cursor-pointer"
            >
              {isThai ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md cursor-pointer"
            >
              {isThai ? 'บันทึกการปรับเวลา' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* REOPEN SUBMISSION MODAL */}
      <Modal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        title={isThai ? 'เปิดรับส่งไฟล์คำตอบข้อสอบใหม่' : 'Reopen Answer File Submissions'}
        maxWidth="md"
      >
        <form onSubmit={handleApplyReopen} className="space-y-4 text-left text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              {isThai ? 'ระยะเวลาที่เปิดรับเพิ่ม (นาที)' : 'Reopening Duration (Minutes)'}
            </label>
            <input
              type="number"
              min="5"
              max="60"
              required
              value={reopenMinutes}
              onChange={(e) => setReopenMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              {isThai ? 'ขอบเขต' : 'Scope'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReopenScope('room')}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer ${
                  reopenScope === 'room' ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 border-gray-300 text-gray-700'
                }`}
              >
                {isThai ? 'ทั้งห้องปฏิบัติการ' : 'Whole Laboratory Room'}
              </button>
              <button
                type="button"
                onClick={() => setReopenScope('student')}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer ${
                  reopenScope === 'student' ? 'bg-purple-600 text-white border-purple-600' : 'bg-gray-50 border-gray-300 text-gray-700'
                }`}
              >
                {isThai ? 'เฉพาะนักศึกษาที่ระบุ' : 'Specific Student'}
              </button>
            </div>
          </div>

          {reopenScope === 'student' && (
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                {isThai ? 'เลือกนักศึกษา' : 'Target Student'}
              </label>
              <select
                value={reopenTargetStudent}
                onChange={(e) => setReopenTargetStudent(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.studentCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              {isThai ? 'เหตุผลในการเปิดรับส่งใหม่' : 'Reason for Reopening'}
            </label>
            <input
              type="text"
              required
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder={isThai ? 'เช่น เครื่องคอมพิวเตอร์ไฟดับและต้องรีสตาร์ต' : 'e.g. Workstation power failure restart'}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowReopenModal(false)}
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50 cursor-pointer"
            >
              {isThai ? 'ยกเลิก' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md cursor-pointer"
            >
              {isThai ? 'ยืนยันการเปิดรับส่งใหม่' : 'Confirm Reopen'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
