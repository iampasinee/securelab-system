import React from 'react';
import { ArrowLeft, Edit2, FileText, Globe2, Laptop, ShieldCheck, Users, WifiOff } from 'lucide-react';
import type { Course, ExamPolicy, ExamSession, Room, Student, Teacher } from '../../types';
import type { AcademicState } from '../../types/academic';
import { studentMatchesExamSection, studentMatchesSection } from '../../services/courseState';
import { canEditExamSetup, examStatusLabels, getEffectiveExamStatus } from '../../services/examStatus';
import { examResourceCategoryLabels, getExamResourceMeaning, getSelectedExamResources } from '../../services/examWizard';
import type { TeacherMonitoringExam } from '../../services/teacherMonitoring';
import { getAdmissionCode } from '../../utils/academicYear';
import { Badge } from '../common/Badge';

interface ExamDetailPageProps {
  detail: TeacherMonitoringExam;
  academicState: AcademicState;
  rooms: Room[];
  students: Student[];
  teachers: Teacher[];
  now: Date;
  onBack: () => void;
  onEdit: (exam: ExamSession) => void;
}

const emptyValue = 'ไม่ได้กำหนด';
const shown = (value?: string | number | null) => value === undefined || value === null || value === '' ? emptyValue : String(value);
const setting = (enabled: boolean) => enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

const DetailSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className = '' }) => (
  <section className={`min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-5 ${className}`}>
    <h2 className="flex items-center gap-2 border-b border-gray-100 pb-3 text-sm font-bold text-gray-900">{icon}{title}</h2>
    <div className="mt-4 space-y-3">{children}</div>
  </section>
);

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid min-w-0 gap-1 text-xs sm:grid-cols-[minmax(120px,40%)_minmax(0,1fr)] sm:gap-3">
    <dt className="text-gray-500">{label}</dt>
    <dd className="min-w-0 break-words font-semibold text-gray-800">{value}</dd>
  </div>
);

const PolicyRows: React.FC<{ policy: Record<string, boolean> | undefined; labels: Array<[string, string]> }> = ({ policy, labels }) => (
  <dl className="space-y-3">{policy ? labels.map(([key, label]) => <DetailRow key={key} label={label} value={policy[key] === undefined ? emptyValue : setting(policy[key])} />) : <DetailRow label="สถานะ" value={emptyValue} />}</dl>
);

const formatDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? shown(date) : parsed.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatSemester = (semester: Course['sections'][number]['semester']) => semester === undefined || semester === null || semester === '' ? emptyValue : semester === 'summer' ? 'ภาคฤดูร้อน' : `ภาคการศึกษาที่ ${semester}`;

const examTypeLabels: Record<NonNullable<ExamSession['examType']>, string> = {
  midterm: 'สอบกลางภาค', final: 'สอบปลายภาค', lab: 'สอบปฏิบัติการ', quiz: 'แบบทดสอบย่อย', other: 'อื่น ๆ',
};

const commonPolicyLabels: Array<[keyof ExamPolicy['common'], string]> = [
  ['requireRegisteredDevice', 'บังคับใช้เครื่องที่ลงทะเบียน'],
  ['requireAgent', 'ตรวจ SecureLab Agent ก่อนเริ่มสอบ'],
  ['requireFaceBeforeExam', 'ตรวจใบหน้าก่อนเข้าสอบ'],
  ['requirePeriodicFaceCheck', 'ตรวจใบหน้าระหว่างสอบ'],
  ['preventDuplicateSession', 'ป้องกันการเข้าสอบซ้ำ'],
  ['blockUsbStorage', 'ป้องกัน USB Storage'],
  ['logViolations', 'บันทึกเหตุการณ์ผิดปกติ'],
];

const filePolicyLabels: Array<[keyof ExamPolicy['file'], string]> = [
  ['requireExamWorkspace', 'บังคับใช้ Exam Workspace'],
  ['requireDeviceSignature', 'บังคับ Device Signature'],
  ['lockAfterFinalSubmit', 'ล็อกหลังยืนยันส่งขั้นสุดท้าย'],
  ['blockExternalStorageSource', 'ห้ามไฟล์จาก External Storage'],
];

const onlinePolicyLabels: Array<[keyof ExamPolicy['online'], string]> = [
  ['blockUnknownApplications', 'บล็อกโปรแกรมที่ไม่ได้รับอนุญาต'],
  ['restrictBrowser', 'จำกัดเว็บเบราว์เซอร์'],
  ['blockCommunicationApps', 'บล็อกโปรแกรมสื่อสาร'],
  ['blockRemoteDesktop', 'บล็อก Remote Desktop'],
];

const offlinePolicyLabels: Array<[keyof ExamPolicy['offline'], string]> = [
  ['blockInternet', 'ปิดการเข้าถึง Internet'],
  ['localServerOnly', 'อนุญาตเฉพาะ Local Exam Server'],
  ['isolateClients', 'ป้องกันเครื่องนักศึกษาสื่อสารกันโดยตรง'],
  ['blockSsh', 'ปิด SSH'],
  ['blockSmb', 'ปิด SMB / File Sharing'],
  ['blockFtp', 'ปิด FTP'],
  ['blockScp', 'ปิด SCP'],
  ['blockRemoteDesktop', 'ปิด Remote Desktop'],
  ['blockExternalNetwork', 'ปิดการเข้าถึงเครือข่ายภายนอก'],
];

export const ExamDetailPage: React.FC<ExamDetailPageProps> = ({
  detail, academicState, rooms, students, teachers, now, onBack, onEdit,
}) => {
  const { exam, course, section } = detail;
  const room = rooms.find((candidate) => candidate.id === exam.roomId);
  const primaryTeacherId = section.primaryTeacherId || section.teacherId;
  const teacherName = (id: string) => teachers.find((teacher) => teacher.id === id)?.fullName || emptyValue;
  const currentRosterCount = students.filter((student) => studentMatchesSection(student, section)).length;
  const eligibleCount = students.filter((student) => studentMatchesExamSection(student, exam, section, now)).length;
  const status = getEffectiveExamStatus(exam, now);
  const editable = canEditExamSetup(exam, now);
  const policy = exam.policy;
  const resourceMeaning = policy ? getExamResourceMeaning(policy, exam.format) : 'blocked';
  const resources = policy ? getSelectedExamResources(policy, exam.format) : [];

  return <div className="mx-auto max-w-6xl space-y-5 text-left">
    <header className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</button>
          <p className="text-xs font-bold text-blue-600">จัดการสอบ / รายละเอียดการสอบ</p>
          <h1 className="mt-1 break-words text-xl font-bold text-gray-900 sm:text-2xl">{shown(exam.examName)}</h1>
          <p className="mt-1 break-words text-xs text-gray-600">{course.courseCode} • {course.courseName} • Section {exam.sectionNo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status === 'in_progress' ? 'success' : status === 'upcoming' ? 'warning' : 'neutral'}>{examStatusLabels[status]}</Badge>
          {editable && <button type="button" onClick={() => onEdit(exam)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"><Edit2 className="h-4 w-4" />แก้ไขการสอบ</button>}
        </div>
      </div>
    </header>

    <div className="grid gap-4 lg:grid-cols-2">
      <DetailSection title="ข้อมูลการสอบ" icon={<FileText className="h-4 w-4 text-blue-600" />}>
        <dl className="space-y-3"><DetailRow label="ชื่อการสอบ" value={shown(exam.examName)} /><DetailRow label="ประเภทการสอบ" value={exam.examType ? examTypeLabels[exam.examType] : emptyValue} /><DetailRow label="รายวิชา" value={`${course.courseCode} • ${course.courseName}`} /><DetailRow label="Section" value={exam.sectionNo} /><DetailRow label="ภาคการศึกษา" value={formatSemester(section.semester)} /><DetailRow label="ปีการศึกษา" value={shown(section.academicYear)} /><DetailRow label="อาจารย์ผู้สอนหลัก" value={teacherName(primaryTeacherId)} /><DetailRow label="อาจารย์ผู้สอนร่วม" value={section.coTeacherIds?.length ? section.coTeacherIds.map(teacherName).join(', ') : emptyValue} /></dl>
      </DetailSection>

      <DetailSection title="ผู้เข้าสอบ" icon={<Users className="h-4 w-4 text-blue-600" />}>
        <div className="flex flex-wrap gap-2">{section.cohorts?.length ? section.cohorts.map((cohort) => {
          const major = academicState.majors.find((item) => item.id === cohort.majorId);
          const groups = cohort.classGroupIds?.map((id) => academicState.classGroups.find((item) => item.id === id)?.code || emptyValue);
          return <span key={`${cohort.majorId}-${cohort.admissionYear}`} className="max-w-full break-words rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-800">{major?.code || emptyValue} • ปีที่เข้าศึกษา {getAdmissionCode(cohort.admissionYear)} • {groups?.length ? groups.join(', ') : 'ทั้งปีที่เข้าศึกษา'}</span>;
        }) : <span className="text-xs text-gray-500">{emptyValue}</span>}</div>
        <dl className="space-y-3"><DetailRow label="ผู้มีสิทธิ์สอบ" value={`${eligibleCount} คน`} /><DetailRow label="จำนวนตาม Section ปัจจุบัน" value={`${currentRosterCount} คน`} /><DetailRow label="เพิ่มรายบุคคล" value={`${section.includedStudentIds?.length || 0} คน`} /><DetailRow label="ยกเว้นรายบุคคล" value={`${section.excludedStudentIds?.length || 0} คน`} /><DetailRow label="รายชื่อที่ตรึงไว้" value={exam.eligibleStudentIds ? `${exam.eligibleStudentIds.length} คน` : emptyValue} /></dl>
      </DetailSection>

      <DetailSection title="วันเวลาและห้องสอบ" icon={<FileText className="h-4 w-4 text-blue-600" />}>
        <dl className="space-y-3"><DetailRow label="วันที่สอบ" value={formatDate(exam.examDate)} /><DetailRow label="เวลาเริ่ม" value={shown(exam.startTime)} /><DetailRow label="เวลาสิ้นสุด" value={shown(exam.endTime)} /><DetailRow label="ระยะเวลา" value={`${exam.durationMinutes} นาที`} /><DetailRow label="ห้องสอบ" value={shown(room?.labName)} /><DetailRow label="ชั้น" value={room ? `ชั้น ${room.floor}` : emptyValue} /><DetailRow label="สถานะห้อง" value={room ? room.status === 'ready' ? 'พร้อมใช้งาน' : room.status === 'maintenance' ? 'อยู่ระหว่างบำรุงรักษา' : 'ไม่พร้อมใช้งาน' : emptyValue} /><DetailRow label="จำนวนที่นั่ง" value={room ? `${room.seats.length} ที่นั่ง` : emptyValue} /><DetailRow label="จำนวนเครื่อง" value={room ? `${room.seats.filter((seat) => !seat.disabled && seat.machineNo).length} เครื่อง` : emptyValue} /></dl>
      </DetailSection>

      <DetailSection title="รูปแบบการสอบ" icon={exam.format === 'online' ? <Globe2 className="h-4 w-4 text-blue-600" /> : <WifiOff className="h-4 w-4 text-purple-600" />}>
        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${exam.format === 'online' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{exam.format === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}</span>
        <p className="text-xs text-gray-500">การตั้งค่านี้เป็นข้อมูลจำลอง ยังไม่มีการควบคุมเครือข่ายหรือเครื่องจริง</p>
      </DetailSection>

      <DetailSection title="ตัวตนและเครื่อง" icon={<ShieldCheck className="h-4 w-4 text-blue-600" />}>
        <PolicyRows policy={policy?.common} labels={commonPolicyLabels} />
      </DetailSection>

      <DetailSection title="ไฟล์คำตอบ" icon={<FileText className="h-4 w-4 text-emerald-600" />}>
        <dl className="space-y-3"><DetailRow label="นามสกุลที่อนุญาต" value={exam.fileRequirements.acceptedExtensions.length ? exam.fileRequirements.acceptedExtensions.join(', ') : emptyValue} /><DetailRow label="ขนาดสูงสุด" value={`${exam.fileRequirements.maxSizeMb} MB`} /><DetailRow label="จำนวนไฟล์ที่ต้องส่ง" value={`${exam.fileRequirements.requiredFileCount} ไฟล์`} /><DetailRow label="รูปแบบชื่อไฟล์" value={shown(exam.fileRequirements.filenamePattern)} /><DetailRow label="รูปแบบชื่อไฟล์อัตโนมัติ" value={shown(exam.fileRequirements.automaticFilenamePattern)} /><DetailRow label="คำแนะนำการส่ง" value={shown(exam.fileRequirements.instructions)} /></dl>
        <PolicyRows policy={policy?.file} labels={filePolicyLabels} />
      </DetailSection>

      <DetailSection title={resourceMeaning === 'allowed' ? 'ทรัพยากรที่อนุญาต' : 'ทรัพยากรที่บล็อก'} icon={<Laptop className="h-4 w-4 text-orange-600" />} className="lg:col-span-2">
        {resources.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{resources.map((resource) => <div key={resource.id} className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs"><p className="break-words font-bold text-gray-900">{resource.name}</p><p className="mt-1 break-all text-gray-600">{resource.value}</p><p className="mt-1 text-[11px] text-gray-500">{resource.type === 'website' ? 'เว็บไซต์' : resource.type === 'web_app' ? 'เว็บแอป' : 'โปรแกรม'}{resource.category ? ` • ${examResourceCategoryLabels[resource.category] || resource.category}` : ''}</p></div>)}</div> : <p className="text-xs text-gray-500">{emptyValue}</p>}
        {exam.format === 'online' && resourceMeaning === 'allowed' && Boolean(policy?.online.blockedResources.length) && <p className="break-words rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">รายการบล็อกเดิมที่ยังคงอยู่: {policy?.online.blockedResources.map((resource) => `${resource.name} (${resource.value})`).join(', ')}</p>}
      </DetailSection>

      {exam.format === 'online' ? <DetailSection title="นโยบายออนไลน์" icon={<Globe2 className="h-4 w-4 text-blue-600" />} className="lg:col-span-2">
        <dl className="space-y-3"><DetailRow label="รูปแบบการควบคุม" value={policy ? policy.online.resourceMode === 'allowlist' ? 'Allowlist — อนุญาตเฉพาะรายการที่กำหนด' : 'Blocklist — บล็อกรายการที่กำหนด' : emptyValue} />{policy?.online.resourceMode === 'allowlist' && <DetailRow label="เว็บไซต์ที่อนุญาต" value={policy.online.allowedDomains.length ? <div className="flex flex-wrap gap-1.5">{policy.online.allowedDomains.map((domain) => <span key={domain} className="max-w-full break-all rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{domain}</span>)}</div> : emptyValue} />}{policy?.online.resourceMode === 'blocklist' && Boolean(policy.online.allowedDomains.length) && <DetailRow label="โดเมนที่บันทึกไว้ (ไม่ใช้ใน Blocklist)" value={policy.online.allowedDomains.join(', ')} />}</dl>
        <PolicyRows policy={policy?.online} labels={onlinePolicyLabels} />
        <p className="text-[11px] text-gray-500">หากเปิดบล็อกโปรแกรมทั้งหมวด กฎนี้มีผลก่อนรายการทรัพยากรเฉพาะ</p>
      </DetailSection> : <DetailSection title="นโยบายออฟไลน์" icon={<WifiOff className="h-4 w-4 text-purple-600" />} className="lg:col-span-2">
        <dl><DetailRow label="Local Exam Server" value={shown(policy?.offline.localServerHost)} /></dl>
        <PolicyRows policy={policy?.offline} labels={offlinePolicyLabels} />
      </DetailSection>}

      <DetailSection title="กติกาที่แจ้งผู้เข้าสอบ" icon={<FileText className="h-4 w-4 text-blue-600" />} className="lg:col-span-2">
        {exam.rules.length ? <ol className="list-inside list-decimal space-y-2 text-xs text-gray-700">{exam.rules.map((rule) => <li key={rule.id} className="break-words">{rule.text}</li>)}</ol> : <p className="text-xs text-gray-500">{emptyValue}</p>}
      </DetailSection>
    </div>
  </div>;
};
