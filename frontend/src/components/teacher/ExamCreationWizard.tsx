import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  FileArchive,
  Globe2,
  Laptop,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ExamResourceRule, ExamSession, ExamType } from '../../types';
import {
  calculateExamDurationMinutes,
  applyRecommendedExamResources,
  createEmptyExamWizardState,
  createResourceRule,
  ExamDraftRecord,
  ExamWizardState,
  examResourceCategoryLabels,
  examWizardStateFromSession,
  examWizardToSession,
  findExamRoomConflict,
  getExamRoomCapacity,
  getExamRoomComputerCount,
  getExamResourceMeaning,
  getNextPolicySubStep,
  getPreviousPolicySubStep,
  getPolicySubStepLabel,
  getSelectedExamResources,
  initialPolicySubStep,
  isFinalPolicySubStep,
  normalizeFileExtension,
  normalizeResourceValue,
  persistExamDraft,
  policySubSteps,
  recommendedBlockedResources,
  removeExamDraft,
  resolveEligibleExamStudents,
  resolveWizardSection,
  setSelectedExamResources,
  sectionsForWizardCourse,
  validateExamWizard,
} from '../../services/examWizard';
import { getAdmissionCode } from '../../utils/academicYear';
import { canEditExamSetup, getEffectiveExamStatus } from '../../services/examStatus';
import { useExamClock } from '../../utils/useExamClock';

const steps = [
  'ข้อมูลการสอบ',
  'ผู้เข้าสอบ',
  'วันเวลาและห้องสอบ',
  'รูปแบบการสอบ',
  'ข้อกำหนดและนโยบาย',
  'ตรวจสอบและบันทึก',
];

const examTypeLabels: Record<ExamType, string> = {
  midterm: 'สอบกลางภาค',
  final: 'สอบปลายภาค',
  lab: 'สอบปฏิบัติการ',
  quiz: 'แบบทดสอบย่อย',
  other: 'อื่น ๆ',
};

const inputClass = 'h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:text-gray-500';

interface ExamCreationWizardProps {
  editingExam?: ExamSession;
  initialDraft?: ExamDraftRecord;
  onClose: () => void;
  onSaved: (result: 'draft' | 'exam') => void;
}

const ToggleRow: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-blue-200">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
    <span className="min-w-0">
      <span className="block text-xs font-semibold text-gray-800">{label}</span>
      {description && <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">{description}</span>}
    </span>
  </label>
);

const ErrorText: React.FC<{ message?: string }> = ({ message }) => message
  ? <p role="alert" className="mt-1 text-xs font-medium text-red-600">{message}</p>
  : null;

export const ExamCreationWizard: React.FC<ExamCreationWizardProps> = ({
  editingExam,
  initialDraft,
  onClose,
  onSaved,
}) => {
  const now = useExamClock();
  const {
    academicState,
    courses,
    currentTeacher,
    examSessions,
    rooms,
    students,
    createExamSession,
    updateExamSession,
    showToast,
  } = useApp();
  const [step, setStep] = useState(0);
  const [policySubStep, setPolicySubStep] = useState(initialPolicySubStep);
  const [state, setState] = useState<ExamWizardState>(() => initialDraft?.state
    ? structuredClone(initialDraft.state)
    : editingExam
      ? examWizardStateFromSession(editingExam)
      : createEmptyExamWizardState());
  const [draftId] = useState(() => initialDraft?.id || `exam_draft_${crypto.randomUUID()}`);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRoster, setShowRoster] = useState(false);
  const [customExtension, setCustomExtension] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [resourceValue, setResourceValue] = useState('');
  const [resourceType, setResourceType] = useState<ExamResourceRule['type']>('website');
  const [resourceError, setResourceError] = useState('');

  const selectedCourse = courses.find((course) => course.id === state.courseId);
  const selectedSection = resolveWizardSection(state, courses);
  const selectedRoom = rooms.find((room) => room.id === state.roomId);
  const resourceMeaning = getExamResourceMeaning(state.policy, state.format);
  const selectedResources = getSelectedExamResources(state.policy, state.format);
  const sectionOptions = sectionsForWizardCourse(courses, state.courseId);
  const eligibleStudents = useMemo(
    () => resolveEligibleExamStudents(state, courses, students),
    [courses, state, students],
  );
  const durationMinutes = calculateExamDurationMinutes(state.startTime, state.endTime);
  const roomConflict = findExamRoomConflict(examSessions, state, editingExam?.id || initialDraft?.editingExamId);
  const roomCapacity = getExamRoomCapacity(selectedRoom);
  const editingRecord = editingExam || examSessions.find((exam) => exam.id === initialDraft?.editingExamId);
  const editingStatus = editingRecord && getEffectiveExamStatus(editingRecord, now);

  const updateState = <K extends keyof ExamWizardState>(key: K, value: ExamWizardState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
    setErrors({});
  };

  const selectExamFormat = (format: ExamWizardState['format']) => {
    if (format !== state.format) setPolicySubStep((current) => Math.min(current, 2));
    updateState('format', format);
  };

  const updateCommonPolicy = (key: keyof ExamWizardState['policy']['common'], value: boolean) => {
    setState((current) => ({
      ...current,
      policy: { ...current.policy, common: { ...current.policy.common, [key]: value } },
    }));
  };

  const updateFilePolicy = (key: keyof ExamWizardState['policy']['file'], value: boolean) => {
    setState((current) => ({
      ...current,
      policy: { ...current.policy, file: { ...current.policy.file, [key]: value } },
    }));
  };

  const updateOnlinePolicy = <K extends keyof ExamWizardState['policy']['online']>(
    key: K,
    value: ExamWizardState['policy']['online'][K],
  ) => {
    setState((current) => ({
      ...current,
      policy: { ...current.policy, online: { ...current.policy.online, [key]: value } },
    }));
  };

  const updateOfflinePolicy = <K extends keyof ExamWizardState['policy']['offline']>(
    key: K,
    value: ExamWizardState['policy']['offline'][K],
  ) => {
    setState((current) => ({
      ...current,
      policy: { ...current.policy, offline: { ...current.policy.offline, [key]: value } },
    }));
  };

  const environment = {
    courses,
    students,
    rooms,
    examSessions,
    editingExamId: editingExam?.id || initialDraft?.editingExamId,
  };

  const stepErrorKeys = [
    ['courseId', 'sectionNo', 'examName'],
    ['students'],
    ['examDate', 'time', 'roomId', 'conflict', 'capacity'],
    [],
    ['files', 'maxSizeMb', 'onlinePolicy', 'offlinePolicy'],
    [],
  ];

  const validateControlPolicyStep = () => {
    if (state.format === 'online' && !['allowlist', 'blocklist'].includes(state.policy.online.resourceMode)) {
      return { onlinePolicy: 'กรุณาเลือกรูปแบบการควบคุมออนไลน์' };
    }
    if (state.format === 'offline' && state.policy.offline.localServerOnly && !state.policy.offline.localServerHost.trim()) {
      return { offlinePolicy: 'กรุณาระบุ Local Exam Server' };
    }
    return {};
  };

  const jumpPolicySubStep = (target: number) => {
    if (policySubStep <= 2 && target > 2) {
      const policyErrors = validateControlPolicyStep();
      if (Object.keys(policyErrors).length) {
        setPolicySubStep(2);
        setErrors(policyErrors);
        return;
      }
    }
    setErrors({});
    setPolicySubStep(target);
  };

  const moveNext = () => {
    if (step === 4 && !isFinalPolicySubStep(policySubStep)) {
      if (policySubStep === 2) {
        const policyErrors = validateControlPolicyStep();
        if (Object.keys(policyErrors).length) {
          setErrors(policyErrors);
          return;
        }
      }
      setErrors({});
      setPolicySubStep((current) => getNextPolicySubStep(current));
      return;
    }
    const nextErrors = validateExamWizard(state, environment);
    const relevantErrors = Object.fromEntries(Object.entries(nextErrors).filter(([key]) => stepErrorKeys[step].includes(key)));
    if (Object.keys(relevantErrors).length) {
      setErrors(relevantErrors);
      return;
    }
    setErrors({});
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const moveBack = () => {
    setErrors({});
    if (step === 4 && policySubStep > 0) {
      setPolicySubStep((current) => getPreviousPolicySubStep(current));
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  };

  const saveDraft = () => {
    if (!currentTeacher) return;
    persistExamDraft({
      id: draftId,
      teacherId: currentTeacher.id,
      editingExamId: editingExam?.id || initialDraft?.editingExamId,
      updatedAt: new Date().toISOString(),
      state,
    });
    showToast('บันทึกร่างแล้ว', 'คุณสามารถกลับมาแก้ไขและสร้างการสอบภายหลังได้', 'success');
    onSaved('draft');
  };

  const createOrUpdateExam = () => {
    const nextErrors = validateExamWizard(state, environment);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      const firstError = Object.keys(nextErrors)[0];
      const targetStep = stepErrorKeys.findIndex((keys) => keys.includes(firstError));
      if (targetStep >= 0) setStep(targetStep);
      showToast('ยังสร้างการสอบไม่ได้', Object.values(nextErrors)[0], 'error');
      return;
    }

    const editingId = editingExam?.id || initialDraft?.editingExamId;
    const existing = examSessions.find((exam) => exam.id === editingId);
    if (existing && !canEditExamSetup(existing, new Date())) {
      showToast('ไม่สามารถแก้ไขการสอบได้', 'การสอบที่กำลังดำเนินการหรือเสร็จสิ้นแล้วไม่อนุญาตให้แก้ไขข้อมูลหลัก', 'error');
      return;
    }
    const payload = examWizardToSession(state, existing?.status || 'upcoming');
    if (editingId) updateExamSession(editingId, payload);
    else createExamSession(payload);
    removeExamDraft(draftId);
    onSaved('exam');
  };

  const addAllowedDomain = () => {
    const normalized = normalizeResourceValue(domainInput, 'website');
    if (!normalized) {
      setErrors({ onlinePolicy: 'รูปแบบโดเมนไม่ถูกต้อง เช่น docs.python.org' });
      return;
    }
    updateOnlinePolicy('allowedDomains', Array.from(new Set([...state.policy.online.allowedDomains, normalized])));
    setDomainInput('');
    setErrors({});
  };

  const togglePresetResource = (rule: ExamResourceRule) => {
    const exists = selectedResources.some((resource) => resource.id === rule.id);
    setState((current) => ({
      ...current,
      policy: setSelectedExamResources(current.policy, current.format, exists
        ? getSelectedExamResources(current.policy, current.format).filter((resource) => resource.id !== rule.id)
        : [...getSelectedExamResources(current.policy, current.format), rule]),
    }));
  };

  const addCustomResource = () => {
    const result = createResourceRule(resourceName, resourceType, resourceValue);
    const rule = result.rule;
    if (!rule) {
      setResourceError(result.error || 'ข้อมูลไม่ถูกต้อง');
      return;
    }
    setState((current) => ({
      ...current,
      policy: setSelectedExamResources(current.policy, current.format, [...getSelectedExamResources(current.policy, current.format), rule]),
    }));
    setResourceName('');
    setResourceValue('');
    setResourceError('');
  };

  const applyRecommendedPolicy = () => {
    setState((current) => ({ ...current, policy: applyRecommendedExamResources(current.policy, current.format) }));
    showToast('ใช้ชุดแนะนำแล้ว', resourceMeaning === 'allowed' ? 'เพิ่มเอกสารอ้างอิงที่อนุญาตแบบจำลอง' : 'เพิ่มทรัพยากรที่บล็อกแบบจำลอง', 'info');
  };

  const renderStep = () => {
    if (step === 0) return (
      <div className="space-y-5">
        <div><h2 className="text-lg font-bold text-gray-900">ข้อมูลการสอบ</h2><p className="text-xs text-gray-500">เลือกรายวิชาและ Section ที่คุณได้รับมอบหมายเท่านั้น</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700">รายวิชา *
            <select value={state.courseId} onChange={(event) => setState((current) => ({ ...current, courseId: event.target.value, sectionNo: '' }))} className={`${inputClass} mt-1`}>
              <option value="">เลือกรายวิชา</option>
              {courses.filter((course) => course.status === 'active' && course.sections.some((section) => section.status !== 'inactive')).map((course) => <option key={course.id} value={course.id}>{course.courseCode} — {course.courseName}</option>)}
            </select><ErrorText message={errors.courseId} />
          </label>
          <label className="text-xs font-semibold text-gray-700">Section *
            <select value={state.sectionNo} disabled={!state.courseId} onChange={(event) => updateState('sectionNo', event.target.value)} className={`${inputClass} mt-1`}>
              <option value="">เลือก Section</option>
              {sectionOptions.map((section) => <option key={section.id || section.sectionNo} value={section.sectionNo}>Section {section.sectionNo}</option>)}
            </select><ErrorText message={errors.sectionNo} />
          </label>
          <label className="text-xs font-semibold text-gray-700 sm:col-span-2">ชื่อการสอบ *
            <input value={state.examName} onChange={(event) => updateState('examName', event.target.value)} placeholder="เช่น สอบปลายภาค" className={`${inputClass} mt-1`} /><ErrorText message={errors.examName} />
          </label>
          <label className="text-xs font-semibold text-gray-700">ประเภทการสอบ
            <select value={state.examType} onChange={(event) => updateState('examType', event.target.value as ExamType)} className={`${inputClass} mt-1`}>
              {Object.entries(examTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            <span className="font-semibold text-gray-800">ภาคการศึกษา / ปีการศึกษา</span>
            <p className="mt-2">{selectedSection ? `ภาคการศึกษา ${selectedSection.semester} / ${selectedSection.academicYear}` : 'เลือก Section เพื่อแสดงข้อมูล'}</p>
            <p className="mt-1 text-[11px] text-gray-400">อ่านจากข้อมูล Section และแก้ไขจากหน้านี้ไม่ได้</p>
          </div>
        </div>
      </div>
    );

    if (step === 1) return (
      <div className="space-y-5">
        <div><h2 className="text-lg font-bold text-gray-900">ผู้เข้าสอบ</h2><p className="text-xs text-gray-500">คำนวณจาก cohort ของ Section โดยไม่แก้ไขข้อมูลนักศึกษา</p></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><Users className="h-5 w-5 text-blue-600" /><p className="mt-2 text-xs text-blue-700">ผู้มีสิทธิ์สอบทั้งหมด</p><strong className="text-2xl text-blue-950">{eligibleStudents.length} คน</strong></div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:col-span-2"><p className="text-xs font-semibold text-gray-800">Cohort / กลุ่มเรียนของ Section</p><div className="mt-3 flex flex-wrap gap-2">{selectedSection?.cohorts?.map((cohort) => {
            const major = academicState.majors.find((item) => item.id === cohort.majorId);
            const groups = cohort.classGroupIds?.map((id) => academicState.classGroups.find((item) => item.id === id)?.code).filter(Boolean);
            return <span key={`${cohort.majorId}-${cohort.admissionYear}`} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{major?.code || 'ไม่ระบุสาขา'} • ปีที่เข้าศึกษา {getAdmissionCode(cohort.admissionYear)}{groups?.length ? ` • ${groups.join(', ')}` : ' • ทั้ง cohort'}</span>;
          }) || <span className="text-xs text-gray-500">ไม่มีข้อมูล cohort</span>}</div></div>
        </div>
        <ErrorText message={errors.students} />
        <button type="button" onClick={() => setShowRoster((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"><Users className="h-4 w-4" />{showRoster ? 'ซ่อนรายชื่อ' : 'ดูรายชื่อ'}</button>
        {showRoster && <div className="max-h-72 overflow-y-auto rounded-2xl border border-gray-200"><table className="w-full min-w-[520px] text-left text-xs"><thead className="sticky top-0 bg-gray-50 text-gray-600"><tr><th className="px-4 py-3">รหัสนักศึกษา</th><th className="px-4 py-3">ชื่อ-นามสกุล</th><th className="px-4 py-3">อีเมล</th></tr></thead><tbody className="divide-y divide-gray-100">{eligibleStudents.map((student) => <tr key={student.id}><td className="px-4 py-3 font-mono">{student.studentCode}</td><td className="px-4 py-3 font-semibold">{student.fullName}</td><td className="px-4 py-3 text-gray-500">{student.email}</td></tr>)}</tbody></table></div>}
      </div>
    );

    if (step === 2) return (
      <div className="space-y-5">
        <div><h2 className="text-lg font-bold text-gray-900">วันเวลาและห้องสอบ</h2><p className="text-xs text-gray-500">ระบบตรวจช่วงเวลาซ้อนและความจุห้องจาก ExamRoom ที่ผู้ดูแลระบบเปิดไว้</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-gray-700">วันที่สอบ *<input type="date" value={state.examDate} onChange={(event) => updateState('examDate', event.target.value)} className={`${inputClass} mt-1`} /><ErrorText message={errors.examDate} /></label>
          <label className="text-xs font-semibold text-gray-700">เวลาเริ่ม *<input type="time" value={state.startTime} onChange={(event) => updateState('startTime', event.target.value)} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs font-semibold text-gray-700">เวลาสิ้นสุด *<input type="time" value={state.endTime} onChange={(event) => updateState('endTime', event.target.value)} className={`${inputClass} mt-1`} /><ErrorText message={errors.time} /></label>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><Clock className="mr-2 inline h-4 w-4" />{durationMinutes ? `${state.startTime} - ${state.endTime} • ระยะเวลา ${Math.floor(durationMinutes / 60) ? `${Math.floor(durationMinutes / 60)} ชั่วโมง ` : ''}${durationMinutes % 60 ? `${durationMinutes % 60} นาที` : ''}` : 'กรุณากำหนดเวลาเริ่มและสิ้นสุดให้ถูกต้อง'}</div>
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-700">ห้องสอบ *</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rooms.map((room) => {
            const ready = room.status === 'ready';
            const selected = state.roomId === room.id;
            return <button key={room.id} type="button" disabled={!ready && !selected} onClick={() => updateState('roomId', room.id)} className={`rounded-2xl border p-4 text-left transition-all ${selected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : ready ? 'border-gray-200 bg-white hover:border-blue-300' : 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-60'}`}><div className="flex items-center justify-between"><strong className="text-sm text-gray-900">{room.labName}</strong><MapPin className="h-4 w-4 text-blue-500" /></div><p className="mt-2 text-xs text-gray-600">ชั้น {room.floor}</p><p className="text-xs text-gray-600">{getExamRoomCapacity(room)} ที่นั่ง • {getExamRoomComputerCount(room)} เครื่อง</p><span className={`mt-2 inline-block text-[11px] font-semibold ${ready ? 'text-emerald-600' : 'text-red-600'}`}>{ready ? 'พร้อมใช้งาน' : 'ไม่พร้อมใช้งาน'}</span></button>;
          })}</div><ErrorText message={errors.roomId} />
        </div>
        {(roomConflict || errors.conflict) && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"><AlertTriangle className="mr-2 inline h-4 w-4" />ห้อง {selectedRoom?.labName} มีการสอบในช่วงเวลานี้แล้ว ({roomConflict?.startTime} - {roomConflict?.endTime})</div>}
        {selectedRoom && eligibleStudents.length > roomCapacity && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="mr-2 inline h-4 w-4" />ผู้เข้าสอบ {eligibleStudents.length} คน แต่ห้องรองรับ {roomCapacity} ที่นั่ง — จำนวนที่นั่งไม่เพียงพอสำหรับผู้เข้าสอบ</div>}
      </div>
    );

    if (step === 3) return (
      <div className="space-y-5">
        <div><h2 className="text-lg font-bold text-gray-900">รูปแบบการสอบ</h2><p className="text-xs text-gray-500">เป็นการตั้งค่า frontend เท่านั้น ยังไม่มีการควบคุมเครือข่ายจริง</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => selectExamFormat('online')} className={`rounded-2xl border p-5 text-left transition-all ${state.format === 'online' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-gray-200 bg-white hover:border-blue-300'}`}><Globe2 className="h-7 w-7 text-blue-600" /><h3 className="mt-3 font-bold text-gray-900">ออนไลน์</h3><p className="mt-1 text-xs leading-relaxed text-gray-600">เชื่อมต่อระบบส่วนกลาง และกำหนดรายการเว็บไซต์/โปรแกรมตาม Policy</p>{state.format === 'online' && <CheckCircle2 className="mt-3 h-5 w-5 text-blue-600" />}</button>
          <button type="button" onClick={() => selectExamFormat('offline')} className={`rounded-2xl border p-5 text-left transition-all ${state.format === 'offline' ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20' : 'border-gray-200 bg-white hover:border-purple-300'}`}><WifiOff className="h-7 w-7 text-purple-600" /><h3 className="mt-3 font-bold text-gray-900">ออฟไลน์</h3><p className="mt-1 text-xs leading-relaxed text-gray-600">ใช้เครือข่ายและ Local Exam Server ภายในห้องสอบ โดยไม่ใช้งานอินเทอร์เน็ต</p>{state.format === 'offline' && <CheckCircle2 className="mt-3 h-5 w-5 text-purple-600" />}</button>
        </div>
      </div>
    );

    if (step === 4) {
      const groupedResources = Object.entries(recommendedBlockedResources.reduce<Record<string, ExamResourceRule[]>>((groups, rule) => {
        const category = rule.category || 'อื่น ๆ';
        groups[category] = [...(groups[category] || []), rule];
        return groups;
      }, {}));
      const commonPolicyRows: Array<[keyof ExamWizardState['policy']['common'], string]> = [
        ['requireRegisteredDevice', 'ต้องใช้เครื่องที่ลงทะเบียน'], ['requireAgent', 'ต้องตรวจ Agent ก่อนเริ่มสอบ'], ['requireFaceBeforeExam', 'ตรวจใบหน้าก่อนเข้าสอบ'], ['requirePeriodicFaceCheck', 'ตรวจใบหน้าระหว่างสอบ'], ['preventDuplicateSession', 'ป้องกันการเข้าสอบซ้ำ'], ['blockUsbStorage', 'ป้องกัน USB Storage'], ['logViolations', 'บันทึกเหตุการณ์ผิดปกติ'],
      ];
      const filePolicyRows: Array<[keyof ExamWizardState['policy']['file'], string]> = [
        ['requireExamWorkspace', 'ไฟล์ต้องมาจาก Exam Workspace'], ['requireDeviceSignature', 'ต้องผ่าน Device Signature'], ['lockAfterFinalSubmit', 'ล็อก Submission หลังส่งขั้นสุดท้าย'], ['blockExternalStorageSource', 'ไม่อนุญาตอัปโหลดจาก External Storage'],
      ];
      return <div className={`space-y-5 [&>section]:hidden ${policySubStep === 0 ? '[&>section:nth-of-type(1)]:block' : policySubStep === 1 ? '[&>section:nth-of-type(2)]:block' : policySubStep === 2 ? '[&>section:nth-of-type(4)]:block' : '[&>section:nth-of-type(3)]:block'}`}>
        <div><h2 className="text-lg font-bold text-gray-900">ข้อกำหนดและนโยบาย</h2><p className="text-xs text-gray-500">นโยบายนี้จะถูกใช้โดย SecureLab Agent เมื่อเชื่อมต่อระบบจริง ปัจจุบันเป็น configuration mock เท่านั้น</p></div>
        <nav aria-label="ขั้นย่อยข้อกำหนดและนโยบาย" className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-blue-900">ขั้นย่อย {policySubStep + 1} จาก {policySubSteps.length}</p><p className="text-[11px] font-medium text-blue-700">{getPolicySubStepLabel(policySubStep, state.format)}</p></div>
          <ol className="mt-3 grid grid-cols-4 gap-1.5">{policySubSteps.map((label, index) => <li key={label} className="min-w-0"><button type="button" onClick={() => jumpPolicySubStep(index)} aria-label={`ขั้นย่อย ${index + 1} ${getPolicySubStepLabel(index, state.format)}`} aria-current={index === policySubStep ? 'step' : undefined} className={`flex min-h-9 w-full items-center justify-center gap-1 rounded-lg border px-1.5 text-[10px] font-semibold transition-colors ${index === policySubStep ? 'border-blue-500 bg-white text-blue-700 shadow-sm' : index < policySubStep ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-100 bg-white/60 text-gray-500'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${index === policySubStep ? 'bg-blue-600 text-white' : index < policySubStep ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{index < policySubStep ? <Check className="h-3 w-3" /> : index + 1}</span><span className="hidden truncate sm:inline">{getPolicySubStepLabel(index, state.format)}</span></button></li>)}</ol>
        </nav>
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><ShieldCheck className="h-5 w-5 text-blue-600" />A. การยืนยันตัวตนและเครื่อง</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{commonPolicyRows.map(([key, label]) => <ToggleRow key={key} label={label} checked={state.policy.common[key]} onChange={(value) => updateCommonPolicy(key, value)} />)}</div></section>
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4"><h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><FileArchive className="h-5 w-5 text-emerald-600" />B. การส่งไฟล์คำตอบ</h3><p className="mt-3 text-xs font-semibold text-gray-700">ประเภทไฟล์ที่อนุญาต</p><div className="mt-2 flex flex-wrap gap-2">{['.zip', '.pdf', '.docx', '.xlsx', '.py', '.java', '.cpp'].map((extension) => { const selected = state.acceptedExtensions.includes(extension); return <button key={extension} type="button" onClick={() => updateState('acceptedExtensions', selected ? state.acceptedExtensions.filter((item) => item !== extension) : [...state.acceptedExtensions, extension])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selected ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-white text-gray-600'}`}>{selected && <Check className="mr-1 inline h-3 w-3" />}{extension}</button>; })}</div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={customExtension} onChange={(event) => setCustomExtension(event.target.value)} placeholder="นามสกุลอื่น เช่น .rs" className={inputClass} /><button type="button" onClick={() => { const extension = normalizeFileExtension(customExtension); if (extension) updateState('acceptedExtensions', Array.from(new Set([...state.acceptedExtensions, extension]))); setCustomExtension(''); }} className="shrink-0 rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold">+ เพิ่มประเภทไฟล์</button></div><ErrorText message={errors.files} /><label className="mt-3 block text-xs font-semibold text-gray-700">ขนาดไฟล์สูงสุด (MB)<input type="number" min="1" max="500" value={state.maxSizeMb} onChange={(event) => updateState('maxSizeMb', Number(event.target.value))} className={`${inputClass} mt-1 sm:max-w-xs`} /></label><ErrorText message={errors.maxSizeMb} /><div className="mt-3 grid gap-2 sm:grid-cols-2">{filePolicyRows.map(([key, label]) => <ToggleRow key={key} label={label} checked={state.policy.file[key]} onChange={(value) => updateFilePolicy(key, value)} />)}</div></section>
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Laptop className="h-5 w-5 text-orange-600" />D. {resourceMeaning === 'allowed' ? 'ทรัพยากรที่อนุญาตในการสอบ' : 'ทรัพยากรที่ไม่อนุญาตในการสอบ'}</h3>
            <button type="button" onClick={applyRecommendedPolicy} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">ใช้ชุดแนะนำ</button>
          </div>
          <p className="mt-2 text-xs font-medium text-gray-700">{resourceMeaning === 'allowed' ? 'เลือกทรัพยากรที่อนุญาต: เฉพาะรายการที่เลือกจะสามารถใช้งานได้' : 'เลือกทรัพยากรที่ต้องการบล็อก: รายการที่เลือกจะถูกบล็อก ส่วนรายการอื่นใช้งานได้ตามนโยบายหลัก'}</p>
          {state.format === 'offline' && <p className="mt-1 text-[11px] text-gray-500">รายการนี้เป็นข้อจำกัดเพิ่มเติมจากนโยบายเครือข่ายออฟไลน์</p>}
          {state.format === 'online' && state.policy.online.resourceMode === 'allowlist' && Boolean(state.policy.online.blockedResources.length) && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">รายการบล็อกที่เคยบันทึกไว้ยังคงอยู่ตามเดิม ไม่ถูกเปลี่ยนเป็นรายการอนุญาต</p>}
          <div className="mt-4 space-y-3">{groupedResources.map(([category, resources]) => <div key={category}>
            <p className="text-[10px] font-bold tracking-wide text-gray-500">{examResourceCategoryLabels[category] || category}</p>
            <div className="mt-2 flex flex-wrap gap-2">{resources.map((rule) => {
              const selected = selectedResources.some((item) => item.id === rule.id);
              return <button key={rule.id} type="button" aria-pressed={selected} onClick={() => togglePresetResource(rule)} className={`rounded-full border px-3 py-1.5 text-xs ${selected ? resourceMeaning === 'allowed' ? 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-800' : 'border-red-300 bg-red-50 font-semibold text-red-700' : 'border-gray-300 bg-white text-gray-600'}`}>
                {selected && <Check className="mr-1 inline h-3 w-3" />}{rule.name}{selected && <span className="ml-1">• {resourceMeaning === 'allowed' ? 'อนุญาต' : 'บล็อก'}</span>}
              </button>;
            })}</div>
          </div>)}</div>
          {selectedResources.some((rule) => !recommendedBlockedResources.some((preset) => preset.id === rule.id)) && <div className="mt-4 flex flex-wrap gap-2">{selectedResources.filter((rule) => !recommendedBlockedResources.some((preset) => preset.id === rule.id)).map((rule) => <button key={rule.id} type="button" onClick={() => togglePresetResource(rule)} className="max-w-full break-all rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800" aria-label={`ลบ ${rule.name}`}>{rule.name} ({rule.value}) • {resourceMeaning === 'allowed' ? 'อนุญาต' : 'บล็อก'} <X className="inline h-3 w-3" /></button>)}</div>}
          {state.format === 'online' && state.policy.online.resourceMode === 'allowlist' && <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
            <p className="text-xs font-semibold text-blue-900">เว็บไซต์ที่อนุญาตโดยโดเมน</p>
            <div className="mt-2 flex flex-wrap gap-2">{state.policy.online.allowedDomains.map((domain) => <span key={domain} className="inline-flex max-w-full items-center gap-1 break-all rounded-full border border-blue-200 bg-white px-3 py-1 text-xs text-blue-700">{domain}<button type="button" onClick={() => updateOnlinePolicy('allowedDomains', state.policy.online.allowedDomains.filter((item) => item !== domain))} aria-label={`ลบ ${domain}`}><X className="h-3 w-3" /></button></span>)}</div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder="docs.python.org" className={inputClass} /><button type="button" onClick={addAllowedDomain} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">+ เพิ่มโดเมน</button></div>
            <ErrorText message={errors.onlinePolicy} />
          </div>}
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-semibold text-gray-800">เพิ่มเว็บไซต์ เว็บแอป หรือโปรแกรมที่{resourceMeaning === 'allowed' ? 'อนุญาต' : 'บล็อก'}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_130px_1fr_auto]"><input value={resourceName} onChange={(event) => setResourceName(event.target.value)} placeholder="ชื่อเว็บไซต์ / โปรแกรม" className={inputClass} /><select value={resourceType} onChange={(event) => setResourceType(event.target.value as ExamResourceRule['type'])} className={inputClass}><option value="website">เว็บไซต์</option><option value="web_app">เว็บแอป</option><option value="application">โปรแกรม</option></select><input value={resourceValue} onChange={(event) => setResourceValue(event.target.value)} placeholder={resourceType === 'application' ? 'ชื่อโปรแกรม' : 'docs.python.org'} className={inputClass} /><button type="button" onClick={addCustomResource} className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />เพิ่ม</button></div>
            {resourceError && <p role="alert" className="mt-2 text-xs text-red-600">{resourceError}</p>}
          </div>
        </section>
        {state.format === 'online' ? <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-blue-950"><Globe2 className="h-5 w-5" />C. การตั้งค่านโยบายออนไลน์</h3>
          <p className="mt-2 text-xs text-blue-800">กำหนดรูปแบบการควบคุมก่อน จากนั้นเลือกเว็บไซต์ แอป และทรัพยากรในขั้นถัดไป</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" aria-pressed={state.policy.online.resourceMode === 'allowlist'} onClick={() => updateOnlinePolicy('resourceMode', 'allowlist')} className={`rounded-xl border p-3 text-left text-xs ${state.policy.online.resourceMode === 'allowlist' ? 'border-blue-500 bg-white ring-2 ring-blue-500/20' : 'border-gray-200 bg-white'}`}><strong>Allowlist — แนะนำ</strong><span className="mt-1 block text-gray-600">อนุญาตเฉพาะเว็บไซต์ / แอป / ทรัพยากรที่กำหนด</span></button>
            <button type="button" aria-pressed={state.policy.online.resourceMode === 'blocklist'} onClick={() => updateOnlinePolicy('resourceMode', 'blocklist')} className={`rounded-xl border p-3 text-left text-xs ${state.policy.online.resourceMode === 'blocklist' ? 'border-blue-500 bg-white ring-2 ring-blue-500/20' : 'border-gray-200 bg-white'}`}><strong>Blocklist</strong><span className="mt-1 block text-gray-600">อนุญาตการใช้งานทั่วไป แต่บล็อกรายการที่กำหนด</span></button>
          </div>
          <ErrorText message={errors.onlinePolicy} />
          <p className="mt-3 text-[11px] text-gray-600">รายการทรัพยากรของแต่ละโหมดจะถูกเก็บแยกกัน การเปลี่ยนโหมดไม่ลบรายการที่เคยเลือก</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <ToggleRow label="ป้องกันโปรแกรมที่ไม่ได้รับอนุญาต" checked={state.policy.online.blockUnknownApplications} onChange={(value) => updateOnlinePolicy('blockUnknownApplications', value)} />
            <ToggleRow label="จำกัดเว็บเบราว์เซอร์" checked={state.policy.online.restrictBrowser} onChange={(value) => updateOnlinePolicy('restrictBrowser', value)} />
          </div>
          <p className="mt-4 text-xs font-semibold text-gray-800">การบล็อกทั้งหมวด (มีผลก่อนรายการเฉพาะ)</p>
          <p className="mt-1 text-[11px] text-gray-600">ถ้าเปิดใช้การบล็อกทั้งหมวด รายการในหมวดนั้นที่เลือกในขั้นทรัพยากรจะไม่เป็นข้อยกเว้น</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <ToggleRow label="บล็อกโปรแกรมสื่อสารทั้งหมด" checked={state.policy.online.blockCommunicationApps} onChange={(value) => updateOnlinePolicy('blockCommunicationApps', value)} />
            <ToggleRow label="บล็อกโปรแกรมควบคุมระยะไกลทั้งหมด" checked={state.policy.online.blockRemoteDesktop} onChange={(value) => updateOnlinePolicy('blockRemoteDesktop', value)} />
          </div>
        </section> : <section className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-purple-950"><WifiOff className="h-5 w-5" />C. การตั้งค่านโยบายออฟไลน์</h3>
          <p className="mt-2 text-xs text-purple-800">กำหนดว่าเครื่องสอบเชื่อมต่ออะไรได้บ้างระหว่างการสอบแบบออฟไลน์</p>
          <label className="mt-3 block text-xs font-semibold text-gray-700">Local Exam Server<input value={state.policy.offline.localServerHost} onChange={(event) => updateOfflinePolicy('localServerHost', event.target.value)} className={`${inputClass} mt-1 sm:max-w-sm`} /></label>
          <ErrorText message={errors.offlinePolicy} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{([['blockInternet', 'ปิดการเข้าถึง Internet'], ['localServerOnly', 'อนุญาตเฉพาะ Local Exam Server'], ['isolateClients', 'ป้องกันเครื่องนักศึกษาสื่อสารกันโดยตรง'], ['blockSsh', 'ปิด SSH'], ['blockSmb', 'ปิด SMB / File Sharing'], ['blockFtp', 'ปิด FTP'], ['blockScp', 'ปิด SCP'], ['blockRemoteDesktop', 'ปิด Remote Desktop'], ['blockExternalNetwork', 'ปิดการเข้าถึงเครือข่ายภายนอก']] as Array<[keyof ExamWizardState['policy']['offline'], string]>).map(([key, label]) => key !== 'localServerHost' ? <ToggleRow key={key} label={label} checked={state.policy.offline[key] as boolean} onChange={(value) => updateOfflinePolicy(key, value)} /> : null)}</div>
        </section>}
      </div>;
    }

    return <div className="space-y-5">
      <div><h2 className="text-lg font-bold text-gray-900">ตรวจสอบและบันทึก</h2><p className="text-xs text-gray-500">ตรวจสอบข้อมูลทั้งหมดก่อนบันทึกลง ExamSession</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4">
          <h3 className="font-bold text-gray-900">ข้อมูลการสอบ</h3>
          <dl className="mt-3 grid grid-cols-[110px_minmax(0,1fr)] gap-y-2 text-xs"><dt className="text-gray-500">รายวิชา</dt><dd className="break-words font-semibold">{selectedCourse?.courseCode} {selectedCourse?.courseName}</dd><dt className="text-gray-500">Section</dt><dd>{state.sectionNo}</dd><dt className="text-gray-500">ชื่อการสอบ</dt><dd className="break-words">{state.examName}</dd><dt className="text-gray-500">ประเภท</dt><dd>{examTypeLabels[state.examType]}</dd><dt className="text-gray-500">วันที่</dt><dd>{state.examDate}</dd><dt className="text-gray-500">เวลา</dt><dd>{state.startTime} - {state.endTime} ({durationMinutes || 0} นาที)</dd><dt className="text-gray-500">ห้อง</dt><dd>{selectedRoom?.labName} • ชั้น {selectedRoom?.floor}</dd><dt className="text-gray-500">ผู้เข้าสอบ</dt><dd>{eligibleStudents.length} คน</dd><dt className="text-gray-500">รูปแบบ</dt><dd className="font-semibold">{state.format === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}</dd></dl>
        </section>
        <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4">
          <h3 className="font-bold text-gray-900">นโยบายหลัก</h3>
          <dl className="mt-3 grid grid-cols-[110px_minmax(0,1fr)] gap-y-2 text-xs"><dt className="text-gray-500">เครื่องลงทะเบียน</dt><dd>{state.policy.common.requireRegisteredDevice ? 'บังคับ' : 'ไม่บังคับ'}</dd><dt className="text-gray-500">ตรวจใบหน้า</dt><dd>{state.policy.common.requireFaceBeforeExam ? 'ก่อนเข้าสอบ' : 'ไม่บังคับ'}</dd><dt className="text-gray-500">Agent</dt><dd>{state.policy.common.requireAgent ? 'บังคับ' : 'ไม่บังคับ'}</dd><dt className="text-gray-500">USB Storage</dt><dd>{state.policy.common.blockUsbStorage ? 'บล็อก' : 'อนุญาต'}</dd><dt className="text-gray-500">ประเภทไฟล์</dt><dd>{state.acceptedExtensions.join(', ')}</dd><dt className="text-gray-500">การส่งขั้นสุดท้าย</dt><dd>{state.policy.file.lockAfterFinalSubmit ? 'ไม่อนุญาตแก้ไขหลังส่ง' : 'อนุญาตตามขั้นตอน'}</dd></dl>
          {state.format === 'online' ? <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-900"><strong>นโยบายออนไลน์: {state.policy.online.resourceMode === 'allowlist' ? 'Allowlist — อนุญาตเฉพาะรายการที่กำหนด' : 'Blocklist — บล็อกรายการที่กำหนด'}</strong></div> : <div className="mt-4 rounded-xl bg-purple-50 p-3 text-xs text-purple-900"><strong>นโยบายออฟไลน์</strong><p className="mt-1">Internet: {state.policy.offline.blockInternet ? 'ปิด' : 'เปิด'} • Local Exam Server: {state.policy.offline.localServerOnly ? state.policy.offline.localServerHost || 'ไม่ได้กำหนด' : 'ไม่บังคับ'} • แยกเครื่องนักศึกษา: {state.policy.offline.isolateClients ? 'เปิด' : 'ปิด'}</p></div>}
        </section>
      </div>
      <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 text-xs">
        <h3 className="font-bold text-gray-900">{resourceMeaning === 'allowed' ? 'ทรัพยากรที่อนุญาต' : 'ทรัพยากรที่บล็อก'}</h3>
        <p className="mt-2 break-words text-gray-700">{selectedResources.length ? selectedResources.map((resource) => `${resource.name} (${resource.value})`).join(', ') : 'ไม่ได้กำหนด'}</p>
        {state.format === 'online' && state.policy.online.resourceMode === 'allowlist' && <p className="mt-2 break-all text-gray-600">โดเมนที่อนุญาต: {state.policy.online.allowedDomains.join(', ') || 'ไม่ได้กำหนด'}</p>}
        {state.format === 'online' && state.policy.online.resourceMode === 'allowlist' && state.policy.online.blockedResources.length > 0 && <p className="mt-2 break-words text-amber-800">รายการบล็อกเดิมที่ยังคงอยู่: {state.policy.online.blockedResources.map((resource) => resource.name).join(', ')}</p>}
      </section>
      {Object.keys(errors).length > 0 && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800"><strong>กรุณาตรวจสอบข้อมูล:</strong><ul className="mt-2 list-inside list-disc">{Object.values(errors).map((error) => <li key={error}>{error}</li>)}</ul></div>}
    </div>;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 text-left">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div><button type="button" onClick={onClose} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-blue-600"><ArrowLeft className="h-4 w-4" />กลับไปหน้าจัดการสอบ</button><h1 className="text-2xl font-bold text-gray-900">{editingExam || initialDraft?.editingExamId ? 'แก้ไขการสอบ' : initialDraft ? 'ดำเนินการจากร่าง' : 'สร้างการสอบ'}</h1><p className="text-xs text-gray-500">ขั้นตอนที่ {step + 1} จาก {steps.length}: {steps[step]}</p></div>
        {editingStatus && editingStatus !== 'upcoming' && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">สถานะนี้ไม่อนุญาตให้บันทึกแก้ไขข้อมูลหลัก</span>}
      </div>
      <nav aria-label="ขั้นตอนสร้างการสอบ" className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xs"><ol className="grid grid-cols-6 gap-1">{steps.map((label, index) => <li key={label} className="min-w-0 text-center"><button type="button" onClick={() => index <= step && setStep(index)} className="w-full" aria-current={index === step ? 'step' : undefined}><span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${index < step ? 'border-emerald-500 bg-emerald-500 text-white' : index === step ? 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100' : 'border-gray-300 bg-white text-gray-400'}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</span><span className={`mt-1 hidden truncate text-[10px] font-semibold md:block ${index === step ? 'text-blue-700' : 'text-gray-500'}`}>{label}</span></button></li>)}</ol><p className="mt-2 text-center text-xs font-semibold text-blue-700 md:hidden">{steps[step]}</p></nav>
      <main className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">{renderStep()}</main>
      <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur"><button type="button" onClick={saveDraft} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Save className="h-4 w-4" />บันทึกร่าง</button><div className="ml-auto flex gap-2">{step > 0 && <button type="button" onClick={moveBack} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</button>}{step < steps.length - 1 ? <button type="button" onClick={moveNext} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700">{step === 4 && isFinalPolicySubStep(policySubStep) ? 'ไปตรวจสอบและบันทึก' : 'ถัดไป'}<ArrowRight className="h-4 w-4" /></button> : <button type="button" disabled={Boolean(editingStatus && editingStatus !== 'upcoming')} onClick={createOrUpdateExam} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />{editingExam || initialDraft?.editingExamId ? 'บันทึกการแก้ไข' : 'สร้างการสอบ'}</button>}</div></footer>
    </div>
  );
};
