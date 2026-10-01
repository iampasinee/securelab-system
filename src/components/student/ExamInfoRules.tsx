import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Calendar,
  Clock,
  MapPin,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  FileCode,
  HardDrive
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { canStartStudentExam, examStatusLabels, getEffectiveExamStatus } from '../../services/examStatus';
import { studentMatchesExamSection } from '../../services/courseState';
import { FRONTEND_DEMO_MODE } from '../../services/studentDemoRetry';
import { useExamClock } from '../../utils/useExamClock';

export const ExamInfoRules: React.FC = () => {
  const now = useExamClock();
  const {
    currentStudent,
    currentExamId,
    examSessions,
    courses,
    rooms,
    seatAssignments,
    setActiveStudentStep,
    showToast,
    language
  } = useApp();

  const isThai = language === 'th';
  const [agreed, setAgreed] = useState(false);

  // Find active exam session
  const activeExam =
    examSessions.find((exam) => exam.id === currentExamId) ||
    examSessions.find((exam) => getEffectiveExamStatus(exam, now) === 'in_progress') ||
    examSessions[0];
  const reopening = currentStudent
    ? activeExam?.reopenedStudents?.[currentStudent.id] || activeExam?.reopenedStudents?.['*']
    : undefined;
  const hasActiveReopening = Boolean(reopening && new Date(reopening.reopenedUntil) > now);
  const course = courses.find((c) => c.id === activeExam?.courseId);
  const room = rooms.find((r) => r.id === activeExam?.roomId);
  const section = course?.sections.find((candidate) => candidate.sectionNo === activeExam?.sectionNo);
  const canStartExam = Boolean(activeExam && currentStudent && canStartStudentExam(activeExam, now, {
    rulesAccepted: agreed,
    hasFaceReference: Boolean(currentStudent.faceReferenceUrl),
    accountActive: currentStudent.accountStatus === 'active',
    isEligible: studentMatchesExamSection(currentStudent, activeExam, section, now),
    hasActiveReopening,
    allowDemoTimeBypass: FRONTEND_DEMO_MODE,
  }));

  // Find assigned seat for current student
  const myAssignment = seatAssignments.find(
    (sa) => sa.examId === activeExam?.id && sa.studentId === currentStudent?.id
  );

  const seatNo = myAssignment?.seatNo || 'A1';
  const seatStation = room?.seats.find((s) => s.seatNo === seatNo);

  const handleStartExam = () => {
    if (!activeExam || !canStartExam) {
      showToast('ยังไม่สามารถเข้าสอบได้', 'โปรดตรวจสอบเวลา ตัวตน สิทธิ์สอบ และการยอมรับกติกา', 'warning');
      return;
    }
    showToast(
      isThai ? 'เริ่มการสอบแล้ว' : 'Examination Commenced',
      isThai ? 'เข้าสู่โหมดเต็มหน้าจอล็อกข้อสอบ และเริ่มนับเวลาถอยหลัง' : 'Full-screen focus mode initiated. Countdown active.',
      'success'
    );
    setActiveStudentStep('ST4');
  };

  return (
    <div className="relative mx-auto mt-3 mb-6 flex max-h-[calc(100dvh-156px)] w-[calc(100%-2rem)] max-w-[1180px] scroll-mt-[156px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-xl sm:mt-4 sm:p-6 lg:w-[calc(100%-3rem)]">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3 shrink-0">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            {isThai ? 'ขั้นตอนที่ 3 จาก 4: ข้อมูลการสอบและระเบียบปฏิบัติ (ST3)' : 'Step 3 of 4: Pre-Exam Briefing (ST3)'}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {course?.courseCode}: {course?.courseName}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {isThai
              ? `กลุ่มเรียน (Section) ${activeExam?.sectionNo} • ภาคการศึกษา 1 / ปีการศึกษา 2569`
              : `Section ${activeExam?.sectionNo} • Semester 1 / Academic Year 2026`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="purple" size="md">
            {isThai ? `รูปแบบการสอบ: ${activeExam?.format.toUpperCase()}` : `Exam Format: ${activeExam?.format.toUpperCase()}`}
          </Badge>
          <Badge variant="success" size="md">
            {isThai ? 'ยืนยันตัวตนสำเร็จ' : 'Identity Verified'}
          </Badge>
          {activeExam && <Badge variant={getEffectiveExamStatus(activeExam, now) === 'in_progress' ? 'success' : 'neutral'} size="md">{examStatusLabels[getEffectiveExamStatus(activeExam, now)]}</Badge>}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,45%)_minmax(0,1fr)] gap-5 py-4 min-h-0">
          <section className="min-w-0 scroll-mt-[92px] space-y-3">
      {/* Grid: Station & Time Specs */}
      <div className="grid grid-cols-2 gap-2">
        {/* Seat / Machine Card */}
        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
          <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold mb-1">
            <Laptop className="w-4 h-4" />
            <span>{isThai ? 'ที่นั่งสอบที่จัดสรร' : 'Assigned Workstation'}</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-blue-950 font-mono">
            {isThai ? `ที่นั่ง ${seatNo}` : `Seat ${seatNo}`}
          </div>
          <div className="text-xs text-blue-700/80 font-mono mt-0.5">
            {seatStation?.machineNo || 'PC-301-01'}
          </div>
        </div>

        {/* Room / Lab */}
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-600 text-xs font-semibold mb-1">
            <MapPin className="w-4 h-4" />
            <span>{isThai ? 'ห้องสอบ' : 'Location'}</span>
          </div>
          <div className="text-base font-bold text-gray-900">{room?.labName}</div>
          <div className="text-xs text-gray-500 truncate">ชั้น {room?.floor}</div>
        </div>

        {/* Date & Time */}
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-600 text-xs font-semibold mb-1">
            <Calendar className="w-4 h-4" />
            <span>{isThai ? 'วันที่สอบ & เวลา' : 'Date & Schedule'}</span>
          </div>
          <div className="text-base font-bold text-gray-900">{activeExam?.examDate}</div>
          <div className="text-xs text-gray-500 font-mono">
            {activeExam?.startTime} - {activeExam?.endTime}
          </div>
        </div>

        {/* Duration */}
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-600 text-xs font-semibold mb-1">
            <Clock className="w-4 h-4" />
            <span>{isThai ? 'ระยะเวลาสอบ' : 'Duration'}</span>
          </div>
          <div className="text-base sm:text-lg font-bold text-gray-900">
            {activeExam?.durationMinutes} {isThai ? 'นาที' : 'Mins'}
          </div>
          <div className="text-xs text-emerald-600 font-medium">
            {isThai ? 'เวลาส่งมาตรฐาน' : 'Standard submission time'}
          </div>
        </div>
      </div>

      {/* File Submission Specifications */}
      <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
        <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm mb-2">
          <HardDrive className="w-4 h-4 text-amber-700" />
          <span>
            {isThai
              ? 'ข้อกำหนดการส่งไฟล์คำตอบและกฎการบีบอัดไฟล์'
              : 'File Submission Requirements & Compression Rules'}
          </span>
        </div>
        <p className="text-xs text-amber-900/90 leading-relaxed mb-3">
          {isThai
            ? 'ต้องบีบอัดไฟล์ซอร์สโค้ดและรายงานทั้งหมดเป็นไฟล์บีบอัดเดี่ยว (.zip) เท่านั้น โดยต้องไม่เกินขนาดสูงสุดที่กำหนด และต้องตั้งชื่อไฟล์ให้ตรงตามแบบฟอร์มที่ระบุ'
            : (activeExam?.fileRequirements?.instructions || 'Compress all source files into a single archive.')}
        </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-amber-200 font-mono text-gray-800">
            <FileCode className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {isThai ? 'นามสกุลไฟล์ที่ยอมรับ: ' : 'Accepted Extensions: '}
              <strong>{(activeExam?.fileRequirements?.acceptedExtensions || ['.zip', '.py']).join(', ')}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-amber-200 text-gray-800">
            <span>
              {isThai ? 'ขนาดไฟล์สูงสุด: ' : 'Max File Size: '}
              <strong>{activeExam?.fileRequirements?.maxSizeMb || 25} MB</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-amber-200 font-mono text-gray-800">
            <span>
              {isThai ? 'รูปแบบชื่อไฟล์: ' : 'Pattern: '}
              <strong>{currentStudent?.studentCode}_final.*</strong>
            </span>
          </div>
          </div>
        </div>
          </section>

      {/* Official Exam Rules */}
      <section className="flex min-w-0 scroll-mt-[92px] flex-col rounded-2xl border border-gray-200 bg-white p-4 lg:min-h-0">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span>
            {isThai
              ? 'ระเบียบการสอบในห้องปฏิบัติการและข้อบังคับความสุจริต'
              : 'Laboratory Examination Rules & Integrity Regulations'}
          </span>
        </h3>
        <ul className="space-y-2.5 max-h-[clamp(220px,38vh,340px)] overflow-y-auto pr-2">
          {(isThai ? [
            { id: 'th1', text: 'ห้ามเปิดเว็บไซต์ที่ไม่ได้รับอนุญาต หรือสลับหน้าต่างโปรแกรมอื่นที่ไม่เกี่ยวข้องกับการสอบ' },
            { id: 'th2', text: 'ห้ามนำโทรศัพท์มือถือ อุปกรณ์สื่อสารไร้สาย หรืออุปกรณ์จัดเก็บข้อมูล USB เข้าห้องสอบโดยเด็ดขาด' },
            { id: 'th3', text: 'ระบบจะล็อกหน้าจอแบบเต็มจอ และบันทึกพฤติกรรมความผิดปกติส่งให้อาจารย์ผู้คุมสอบแบบเรียลไทม์' },
            { id: 'th4', text: 'การส่งข้อสอบหลังหมดเวลาสอบจะถูกจัดเป็น "ส่งล่าช้า" และอาจถูกตัดคะแนนตามเกณฑ์ของรายวิชา' },
          ] : activeExam?.rules || []).map((rule, idx) => (
            <li
              key={rule.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-700"
            >
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                {idx + 1}
              </span>
              <span className="leading-relaxed">{rule.text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-gray-100 bg-linear-to-t from-white pt-2 text-center text-[10px] text-gray-400">
          {isThai ? 'เลื่อนลงเพื่ออ่านกติกาทั้งหมด' : 'Scroll to read all exam rules'}
        </div>
      </section>
        </div>
      </div>

      {/* Confirmation Checkbox & Start Button */}
      <div className="sticky bottom-0 z-10 shrink-0 bg-white pt-3 border-t border-gray-200 space-y-3">
        <label className="flex items-start gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50/40 cursor-pointer hover:bg-blue-50/70 transition-colors">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
          />
          <div className="text-xs text-gray-900 leading-snug">
            <strong className="block font-semibold mb-0.5 text-blue-950">
              {isThai
                ? 'ข้าพเจ้าได้อ่านและตกลงปฏิบัติตามระเบียบข้อบังคับการสอบในห้องปฏิบัติการทั้งหมด'
                : 'I have read and agree to follow all exam rules and laboratory regulations'}
            </strong>
            {isThai
              ? 'ข้าพเจ้าเข้าใจดีว่าการสลับหน้าต่าง การเปิดเว็บต้องห้าม หรือการกระทำที่ส่อทุจริต จะส่งสัญญาณเตือนไปยังหน้าจออาจารย์ผู้คุมสอบทันที'
              : "I understand that navigating away to unauthorized web pages, switching windows, or sharing credentials will instantly flag an integrity violation to the instructor's monitor."}
          </div>
        </label>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs text-gray-400">
            {isThai ? 'ผู้เข้าสอบ: ' : 'Examinee: '}
            {currentStudent?.fullName} ({currentStudent?.studentCode})
          </span>
          <button
            type="button"
            disabled={!canStartExam}
            onClick={handleStartExam}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>{isThai ? 'ยืนยันและเริ่มทำข้อสอบ' : 'Confirm and Start Exam'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
