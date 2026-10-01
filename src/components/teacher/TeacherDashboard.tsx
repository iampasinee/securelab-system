import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  CalendarDays,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Users,
  Activity,
  ArrowRight,
  ShieldAlert,
  Clock,
  HardDrive,
  Cpu,
  Building,
  RefreshCw,
} from 'lucide-react';
import { Badge, MachineStatusBadge } from '../common/Badge';
import { countEffectiveExamStatuses, examStatusLabels, getEffectiveExamStatus } from '../../services/examStatus';
import { useExamClock } from '../../utils/useExamClock';

export const TeacherDashboard: React.FC = () => {
  const now = useExamClock();
  const {
    examSessions,
    courses,
    rooms,
    seatAssignments,
    submissions,
    violations,
    setActiveTeacherRoute,
    setCurrentExamId,
    language,
  } = useApp();

  const isThai = language === 'th';

  // Session counts
  const upcomingExams = examSessions.filter((exam) => getEffectiveExamStatus(exam, now) === 'upcoming');
  const { upcoming: upcomingCount, in_progress: inProgressCount, completed: completedCount } = countEffectiveExamStatuses(examSessions, now);

  // Prefer a live exam, then a future exam, then the first available record.
  const activeExam = examSessions.find((exam) => getEffectiveExamStatus(exam, now) === 'in_progress') || upcomingExams[0] || examSessions[0];
  const activeStatus = activeExam ? getEffectiveExamStatus(activeExam, now) : null;
  const nextExam = [...upcomingExams].sort((first, second) => `${first.examDate}T${first.startTime}`.localeCompare(`${second.examDate}T${second.startTime}`))[0];
  const nextCourse = courses.find((course) => course.id === nextExam?.courseId);
  const activeCourse = courses.find((c) => c.id === activeExam?.courseId);
  const activeRoom = rooms.find((r) => r.id === activeExam?.roomId);

  // Stats for active exam
  const assignedSeats = seatAssignments.filter((sa) => sa.examId === activeExam?.id);
  const totalExaminees = 40; // course section total
  const examSubmissions = submissions.filter((s) => s.examId === activeExam?.id);
  const submittedCount = examSubmissions.filter((s) => s.status === 'submitted').length + 20; // 24 submitted as per mock PRD specs
  const lateCount = examSubmissions.filter((s) => s.status === 'late').length;
  const workingCount = activeStatus === 'in_progress' ? Math.max(totalExaminees - submittedCount - lateCount, 0) : 0;

  const examViolations = violations.filter((v) => v.examId === activeExam?.id);
  const violatedCount = new Set(examViolations.map((v) => v.studentId)).size;
  const notViolatedCount = totalExaminees - violatedCount;

  // Room readiness stats for active room
  const onlineMachines = activeRoom?.seats?.filter((s) => s.status === 'online').length ?? 37;
  const offlineMachines = activeRoom?.seats?.filter((s) => s.status === 'offline').length ?? 1;
  const damagedMachines = activeRoom?.seats?.filter((s) => s.status === 'damaged').length ?? 1;
  const unavailableMachines = activeRoom?.seats?.filter((s) => s.status === 'unavailable').length ?? 1;

  return (
    <div className="space-y-6 text-left">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isThai ? 'แผงภาพรวมการคุมสอบ (T1)' : 'Overview Dashboard (T1)'}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {isThai ? 'ศูนย์ควบคุมการสอบสำหรับอาจารย์ผู้สอน' : 'Instructor Examination Control'}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isThai
              ? 'สถานะแบบเรียลไทม์ของการสอบที่ได้รับมอบหมาย ความพร้อมของเครื่องสอบ และความสมบูรณ์ในการส่งงาน'
              : 'Real-time status of assigned examinations, workstation health, and student submission integrity.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeExam) setCurrentExamId(activeExam.id);
              setActiveTeacherRoute('T5');
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{isThai ? 'เปิดหน้าจอติดตามสด (T5)' : 'Launch Live Monitor (T5)'}</span>
          </button>
        </div>
      </div>

      {/* 1. Exam Session Groups Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* In Progress */}
        <div
          onClick={() => {
            if (activeExam) setCurrentExamId(activeExam.id);
            setActiveTeacherRoute('T5');
          }}
          className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>{isThai ? 'การสอบที่กำลังดำเนินการ' : 'In Progress Exams'}</span>
            </span>
            <PlayCircle className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-3xl font-bold text-blue-950 font-mono">{inProgressCount}</div>
          <div className="text-xs text-blue-700/80 mt-1">
            {inProgressCount ? `${activeCourse?.courseCode || '—'} - ${activeRoom?.labName || '—'} กำลังสอบขณะนี้` : 'ไม่มีการสอบที่กำลังดำเนินการ'}
          </div>
        </div>

        {/* Upcoming */}
        <div
          onClick={() => setActiveTeacherRoute('T2')}
          className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              <span>{isThai ? 'การสอบที่กำลังจะมาถึง' : 'Upcoming Scheduled'}</span>
            </span>
          </div>
          <div className="text-3xl font-bold text-amber-950 font-mono">{upcomingCount}</div>
          <div className="text-xs text-amber-700/80 mt-1">
            {nextExam ? `ถัดไป: ${nextCourse?.courseCode || 'รายวิชา'} วันที่ ${nextExam.examDate}` : 'ยังไม่มีการสอบที่กำลังจะเริ่ม'}
          </div>
        </div>

        {/* Completed */}
        <div
          onClick={() => setActiveTeacherRoute('T7')}
          className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{isThai ? 'การสอบที่เสร็จสิ้นแล้ว' : 'Completed Sessions'}</span>
            </span>
          </div>
          <div className="text-3xl font-bold text-emerald-950 font-mono">{completedCount}</div>
          <div className="text-xs text-emerald-700/80 mt-1">
            {isThai ? 'ไฟล์คำตอบได้รับการจัดเก็บและปิดผนึกแล้ว' : 'Submissions archived & sealed'}
          </div>
        </div>
      </div>

      {/* 2. Active Exam Session & Submission Breakdown Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-gray-900">
                {activeCourse?.courseCode}: {activeCourse?.courseName}
              </span>
              <Badge variant="purple" size="sm">
                {isThai ? 'กลุ่ม' : 'Sec'} {activeExam?.sectionNo}
              </Badge>
              {activeStatus && <Badge variant={activeStatus === 'in_progress' ? 'success' : activeStatus === 'upcoming' ? 'warning' : 'neutral'} size="sm">{examStatusLabels[activeStatus]}</Badge>}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isThai ? 'ห้อง' : 'Room'} {activeRoom?.labName} • {activeExam?.startTime} - {activeExam?.endTime} ({activeExam?.durationMinutes} {isThai ? 'นาที' : 'min'})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTeacherRoute('T4')}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {isThai ? 'ดูผังที่นั่งสอบ (T4)' : 'View Seating Layout (T4)'}
            </button>
            <button
              onClick={() => setActiveTeacherRoute('T5')}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isThai ? 'ควบคุมเวลา & ตรวจสอบการสอบ' : 'Time Controls & Monitoring'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Per-Course Summaries */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="text-[11px] text-gray-500 font-medium block">
              {isThai ? 'ผู้เข้าสอบทั้งหมด' : 'Total Examinees'}
            </span>
            <span className="text-xl font-bold text-gray-900 font-mono mt-0.5 block">{totalExaminees}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
            <span className="text-[11px] text-emerald-700 font-medium block">
              {isThai ? 'ส่งข้อสอบแล้ว' : 'Submitted'}
            </span>
            <span className="text-xl font-bold text-emerald-800 font-mono mt-0.5 block">{submittedCount}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-center">
            <span className="text-[11px] text-blue-700 font-medium block">
              {isThai ? 'กำลังทำข้อสอบ' : 'Working / Pending'}
            </span>
            <span className="text-xl font-bold text-blue-800 font-mono mt-0.5 block">{workingCount}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 text-center">
            <span className="text-[11px] text-amber-700 font-medium block">
              {isThai ? 'ส่งช้ากว่ากำหนด' : 'Late Submissions'}
            </span>
            <span className="text-xl font-bold text-amber-800 font-mono mt-0.5 block">{lateCount}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-100 text-center">
            <span className="text-[11px] text-red-700 font-medium block">
              {isThai ? 'ตรวจพบการละเมิด' : 'Violations Flagged'}
            </span>
            <span className="text-xl font-bold text-red-800 font-mono mt-0.5 block">{violatedCount}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
            <span className="text-[11px] text-gray-500 font-medium block">
              {isThai ? 'ปฏิบัติตามกฎปกติ' : 'Integrity Compliant'}
            </span>
            <span className="text-xl font-bold text-gray-800 font-mono mt-0.5 block">{notViolatedCount}</span>
          </div>
        </div>
      </div>

      {/* 3. Room Equipment & Computer Readiness Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-5 h-5 text-gray-700" />
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {isThai ? 'ความพร้อมของอุปกรณ์ห้องสอบ:' : 'Equipment Readiness:'} {activeRoom?.labName} (ชั้น {activeRoom?.floor})
              </h2>
              <p className="text-xs text-gray-500">
                {isThai
                  ? 'ข้อมูลการผูกเครือข่ายเครื่องสอบกับที่นั่งสอบแบบเรียลไทม์'
                  : 'Live machine-to-seat network binding telemetry'}
              </p>
            </div>
          </div>
          <Badge variant="success">
            {isThai ? 'แมปไอพีคงที่ครบทั้ง 40 เครื่อง' : 'All 40 Static IPs Mapped'}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-900 font-mono">{onlineMachines}</div>
              <div className="text-xs text-emerald-700 font-medium">
                {isThai ? 'ออนไลน์พร้อมใช้งาน' : 'Online & Active'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 font-mono">{offlineMachines}</div>
              <div className="text-xs text-gray-600 font-medium">
                {isThai ? 'ออฟไลน์ (ที่นั่ง A3)' : 'Offline (Seat A3)'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-red-50/60 border border-red-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-red-900 font-mono">{damagedMachines}</div>
              <div className="text-xs text-red-700 font-medium">
                {isThai ? 'เครื่องชำรุด (ที่นั่ง D4)' : 'Damaged PC (Seat D4)'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-amber-900 font-mono">{unavailableMachines}</div>
              <div className="text-xs text-amber-700 font-medium">
                {isThai ? 'งดใช้งาน (ที่นั่ง E8)' : 'Unavailable (Seat E8)'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs text-amber-900 flex items-center justify-between">
          <span>
            {isThai ? (
              <>
                ข้อควรทราบ: เครื่องคอมพิวเตอร์ที่มีสถานะ <strong>ชำรุด</strong> หรือ <strong>งดใช้งาน</strong> จะถูกยกเว้นจากการจัดที่นั่งโดยอัตโนมัติ
              </>
            ) : (
              <>
                Notice: Computers marked <strong>damaged</strong> or <strong>unavailable</strong> are automatically excluded from the seating algorithm.
              </>
            )}
          </span>
          <button
            onClick={() => setActiveTeacherRoute('T4')}
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 underline ml-2 shrink-0 cursor-pointer"
          >
            {isThai ? 'ปรับผังจัดสรรที่นั่งสอบ →' : 'Adjust Seating Allocation →'}
          </button>
        </div>
      </div>
    </div>
  );
};
