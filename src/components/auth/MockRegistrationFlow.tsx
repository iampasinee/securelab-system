import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { BackButton } from '../common/BackButton';
import { useApp } from '../../context/AppContext';
import { canEnterRegistrationStep, credentialsAfterAccountSelection, parseStudentUniversityEmail, resolveMockAuthAccount, validateRegistrationPassword } from '../../services/authState';
import { classGroupsForCohort, isAcademicPathActive } from '../../services/academicState';
import type { FaceEnrollmentStatus, MockAuthUser } from '../../types/auth';
import { calculateYearLevelFromAdmissionYear, getAdmissionCode, useAcademicYear } from '../../utils/academicYear';
import { AuthDomainNotice } from './AuthDomainNotice';
import { MockGoogleAccountSelector } from './MockGoogleAccountSelector';
import { RegistrationPasswordStep } from './RegistrationPasswordStep';
import { MockFaceScanStep } from './MockFaceScanStep';

interface MockRegistrationFlowProps {
  onBack: () => void;
  onGoLogin: (email?: string) => void;
}

interface RegistrationInfo {
  code: string;
  firstName: string;
  lastName: string;
  majorId: string;
  admissionYear: number;
  classGroupId: string;
  facultyId: string;
  departmentId: string;
}

const emptyInfo: RegistrationInfo = {
  code: '',
  firstName: '',
  lastName: '',
  majorId: '',
  admissionYear: 0,
  classGroupId: '',
  facultyId: '',
  departmentId: '',
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600';
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40';

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
};

export const MockRegistrationFlow: React.FC<MockRegistrationFlowProps> = ({ onBack, onGoLogin }) => {
  const {
    mockAuthUsers,
    completeMockRegistration,
    academicState,
    students,
    teachers,
    updateStudent,
    updateTeacher,
  } = useApp();
  const currentAcademicYear = useAcademicYear();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [target, setTarget] = useState<MockAuthUser | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [info, setInfo] = useState<RegistrationInfo>(emptyInfo);
  const [faceStatus, setFaceStatus] = useState<FaceEnrollmentStatus>('not_started');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const visibleStep = canEnterRegistrationStep(step, target, password, confirmation) ? step : target ? 2 : 1;

  const activeFaculties = academicState.faculties.filter((item) => item.status === 'active');
  const availableDepartments = academicState.departments.filter((item) => item.facultyId === info.facultyId && item.status === 'active');
  const availableMajors = academicState.majors.filter((item) => item.status === 'active' && isAcademicPathActive(academicState, 'majors', item.id));
  const parsedStudentEmail = target?.role === 'student'
    ? parseStudentUniversityEmail(target.email)
    : null;
  const studentAdmissionYear = parsedStudentEmail?.admissionYear || 0;
  const availableGroups = info.majorId && studentAdmissionYear
    ? classGroupsForCohort(academicState, info.majorId, studentAdmissionYear, true)
    : [];
  const selectedMajor = academicState.majors.find((item) => item.id === info.majorId);
  const selectedDepartment = academicState.departments.find((item) => item.id === selectedMajor?.departmentId);
  const selectedFaculty = academicState.faculties.find((item) => item.id === selectedDepartment?.facultyId);
  const selectedGroup = academicState.classGroups.find((item) => item.id === info.classGroupId);
  const yearLevel = studentAdmissionYear
    ? calculateYearLevelFromAdmissionYear(studentAdmissionYear, currentAcademicYear)
    : null;

  const initializeInfo = (user: MockAuthUser) => {
    if (user.role === 'student') {
      const student = students.find((item) => item.id === user.subjectId);
      const names = splitName(student?.fullName || '');
      const parsedEmail = parseStudentUniversityEmail(user.email);
      const existingGroup = academicState.classGroups.find((group) =>
        group.id === student?.classGroupId &&
        group.majorId === student?.majorId &&
        group.admissionYear === parsedEmail?.admissionYear &&
        isAcademicPathActive(academicState, 'classGroups', group.id));
      setInfo({
        ...emptyInfo,
        code: parsedEmail?.studentId || '',
        firstName: student?.firstName || names.firstName,
        lastName: student?.lastName || names.lastName,
        majorId: student?.majorId || '',
        admissionYear: parsedEmail?.admissionYear || 0,
        classGroupId: existingGroup?.id || '',
      });
    } else if (user.role === 'teacher') {
      const teacher = teachers.find((item) => item.id === user.subjectId);
      const names = splitName(teacher?.fullName || '');
      setInfo({
        ...emptyInfo,
        code: teacher?.teacherCode || '',
        firstName: names.firstName,
        lastName: names.lastName,
        facultyId: teacher?.facultyId || '',
        departmentId: teacher?.departmentId || '',
      });
    }
  };

  const selectRegistrationAccount = () => {
    setError('');
    const resolution = resolveMockAuthAccount(selectedEmail, mockAuthUsers);
    if (resolution.error || !resolution.user) {
      setError(resolution.error || 'ไม่สามารถตรวจสอบบัญชีได้');
      return;
    }
    if (resolution.user.registered) {
      setTarget(resolution.user);
      setError('บัญชีนี้ลงทะเบียนในระบบแล้ว');
      return;
    }
    if (resolution.user.role === 'admin') {
      setTarget(null);
      setError('ไม่เปิดให้ลงทะเบียนบัญชีผู้ดูแลระบบด้วยตนเอง');
      return;
    }
    const sameAccount = target?.id === resolution.user.id;
    setTarget(resolution.user);
    if (!sameAccount) {
      initializeInfo(resolution.user);
      setFaceStatus('not_started');
    }
    setStep(2);
  };

  const validateInfo = () => {
    if (!target) return 'กรุณาเลือกบัญชี';
    if (!info.code.trim() || !info.firstName.trim() || !info.lastName.trim()) return 'กรุณากรอกข้อมูลผู้ใช้ให้ครบถ้วน';
    if (target.role === 'student') {
      if (!parsedStudentEmail) return 'ไม่สามารถอ่านรหัสนักศึกษาจากอีเมลนี้ได้';
      if (info.code !== parsedStudentEmail.studentId || info.admissionYear !== parsedStudentEmail.admissionYear) return 'ข้อมูลรหัสนักศึกษาและปีที่เข้าศึกษาต้องมาจากอีเมลมหาวิทยาลัย';
      if (!info.majorId) return 'กรุณาเลือกสาขาวิชา';
      if (!yearLevel?.isValid) return 'ไม่สามารถคำนวณชั้นปีจากปีที่เข้าศึกษาได้';
      if (info.classGroupId && !availableGroups.some((group) => group.id === info.classGroupId)) return 'กลุ่มเรียนไม่ตรงกับสาขาวิชาและปีที่เข้าศึกษา';
    }
    if (target.role === 'teacher') {
      if (!info.facultyId) return 'กรุณาเลือกคณะ';
      if (!info.departmentId || !availableDepartments.some((item) => item.id === info.departmentId)) return 'กรุณาเลือกภาควิชาให้ตรงกับคณะ';
    }
    return '';
  };

  const continueFromInfo = () => {
    if (!canEnterRegistrationStep(3, target, password, confirmation)) {
      setError('กรุณาตั้งรหัสผ่านให้ตรงตามเงื่อนไขก่อน');
      setStep(2);
      return;
    }
    const validationError = validateInfo();
    setError(validationError);
    if (!validationError) setStep(4);
  };

  const continueFromFace = () => {
    if (!canEnterRegistrationStep(4, target, password, confirmation)) {
      setStep(2);
      return;
    }
    if (faceStatus !== 'verified_mock') {
      setError('กรุณาลงทะเบียนใบหน้าก่อนดำเนินการต่อ');
      return;
    }
    setError('');
    setStep(5);
  };

  const confirmRegistration = () => {
    if (!canEnterRegistrationStep(5, target, password, confirmation)) {
      setError('กรุณาตั้งรหัสผ่านให้ตรงตามเงื่อนไขก่อน');
      setStep(2);
      return;
    }
    if (!target || faceStatus !== 'verified_mock') {
      setError('กรุณาลงทะเบียนใบหน้าก่อนดำเนินการต่อ');
      return;
    }
    const validationError = validateInfo();
    if (validationError) {
      setError(validationError);
      setStep(3);
      return;
    }
    const fullName = `${info.firstName.trim()} ${info.lastName.trim()}`.trim();
    let profileSaved = true;
    if (target.role === 'student') {
      if (!parsedStudentEmail) {
        setError('ไม่สามารถอ่านรหัสนักศึกษาจากอีเมลนี้ได้');
        return;
      }
      profileSaved = updateStudent(target.subjectId, {
        email: target.email,
        studentCode: parsedStudentEmail.studentId,
        fullName,
        firstName: info.firstName.trim(),
        lastName: info.lastName.trim(),
        majorId: info.majorId,
        admissionYear: parsedStudentEmail.admissionYear,
        classGroupId: info.classGroupId || undefined,
        faceReferenceStatus: 'available',
        isFirstTime: false,
      });
    } else if (target.role === 'teacher') {
      profileSaved = updateTeacher(target.subjectId, {
        email: target.email,
        teacherCode: info.code.trim(),
        fullName,
        facultyId: info.facultyId,
        departmentId: info.departmentId,
        icitProfileStatus: 'confirmed',
      });
    }
    if (!profileSaved) {
      setError('ไม่สามารถบันทึกข้อมูลผู้ใช้ได้ กรุณาตรวจสอบข้อมูลอีกครั้ง');
      return;
    }
    const result = completeMockRegistration(target.id, faceStatus, password, confirmation);
    if (!result.success) {
      setError(result.error || 'ลงทะเบียนไม่สำเร็จ');
      return;
    }
    setError('');
    setSuccess(true);
  };

  if (success && target) {
    return <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-xl sm:p-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check className="h-8 w-8" /></div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">ลงทะเบียนสำเร็จ</h1>
      <p className="mt-2 break-all text-sm text-slate-600">บันทึกสถานะจำลองสำหรับ {target.email} เรียบร้อยแล้ว</p>
      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">ขั้นตอนนี้เป็น frontend mockup ยังไม่มีการสร้าง session หรือยืนยันตัวตนกับ Google จริง</p>
      <button type="button" onClick={() => onGoLogin(target.email)} className={`${primaryButton} mt-6 w-full`}>เข้าสู่ระบบ</button>
    </div>;
  }

  const roleLabel = target?.role === 'student' ? 'นักศึกษา' : 'อาจารย์';
  const steps = ['บัญชีมหาวิทยาลัย', 'ตั้งรหัสผ่าน', target?.role === 'teacher' ? 'ข้อมูลอาจารย์' : 'ข้อมูลนักศึกษา', 'ลงทะเบียนใบหน้า', 'ตรวจสอบ'];

  return <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8">
    <div className="flex items-start gap-3">
      <BackButton onClick={onBack} />
      <div><p className="text-xs font-bold text-blue-600">SECURELAB REGISTRATION MOCKUP</p><h1 className="mt-1 text-2xl font-bold text-slate-900">ลงทะเบียนใช้งาน SecureLab</h1><p className="mt-1 text-sm text-slate-500">ยืนยันบัญชี ตรวจสอบข้อมูล และลงทะเบียนใบหน้าแบบจำลอง</p></div>
    </div>

    <nav aria-label="ขั้นตอนการลงทะเบียน" className="mt-6">
      <ol className="grid grid-cols-5 gap-1 sm:gap-3">
        {steps.map((label, index) => {
          const number = index + 1;
          const active = visibleStep === number;
          const complete = visibleStep > number;
          return <li key={label} aria-current={active ? 'step' : undefined} className="min-w-0 text-center">
            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${complete ? 'border-emerald-500 bg-emerald-500 text-white' : active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-400'}`}>{complete ? <Check className="h-4 w-4" /> : number}</div>
            <p className={`mt-1 break-words text-[9px] leading-tight sm:text-xs ${active ? 'font-bold text-blue-700' : 'text-slate-500'}`}>{label}</p>
          </li>;
        })}
      </ol>
    </nav>

    <div className="mt-6 border-t border-slate-100 pt-6">
      {visibleStep === 1 && <div className="space-y-4">
        <AuthDomainNotice compact />
        <MockGoogleAccountSelector value={selectedEmail} onChange={(email) => { const next = credentialsAfterAccountSelection(selectedEmail, email, { password, confirmation }); setSelectedEmail(email); setTarget(null); setPassword(next.password); setConfirmation(next.confirmation); if (email !== selectedEmail) { setInfo(emptyInfo); setFaceStatus('not_started'); } setError(''); }} onContinue={selectRegistrationAccount} actionLabel="ยืนยันบัญชี Google (จำลอง)" />
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p className="font-bold">{error}</p>{target?.registered && <button type="button" onClick={() => onGoLogin(target.email)} className="mt-2 font-bold underline">ไปหน้าเข้าสู่ระบบ</button>}</div>}
      </div>}

      {visibleStep === 2 && target && <RegistrationPasswordStep email={target.email} password={password} confirmation={confirmation} onPasswordChange={setPassword} onConfirmationChange={setConfirmation} onBack={() => { setError(''); setStep(1); }} onContinue={() => { if (validateRegistrationPassword(password, confirmation).valid) { setError(''); setStep(3); } }} />}

      {visibleStep === 3 && target && <div className="space-y-4">
        <div><h2 className="text-lg font-bold text-slate-900">ข้อมูล{roleLabel}</h2><p className="mt-1 break-all text-xs text-slate-500">บัญชี: {target.email}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">อีเมล<input readOnly value={target.email} className={`${inputClass} mt-1 bg-slate-50`} /></label>
          <label className="text-xs font-semibold text-slate-700">{target.role === 'student' ? 'รหัสนักศึกษา' : target.role === 'teacher' ? 'รหัสบุคลากร/อาจารย์' : 'รหัสผู้ดูแลระบบ'}<input aria-label={target.role === 'student' ? 'รหัสนักศึกษา' : target.role === 'teacher' ? 'รหัสบุคลากร/อาจารย์' : 'รหัสผู้ดูแลระบบ'} readOnly={target.role === 'student'} value={info.code} onChange={(event) => setInfo({ ...info, code: event.target.value })} className={`${inputClass} mt-1 ${target.role === 'student' ? 'bg-slate-100' : ''}`} /></label>
          <label className="text-xs font-semibold text-slate-700">ชื่อ<input value={info.firstName} onChange={(event) => setInfo({ ...info, firstName: event.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs font-semibold text-slate-700">นามสกุล<input value={info.lastName} onChange={(event) => setInfo({ ...info, lastName: event.target.value })} className={`${inputClass} mt-1`} /></label>
        </div>

        {target.role === 'student' && <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="registration-major" className="block text-xs font-semibold text-slate-700">สาขาวิชา<select id="registration-major" aria-label="สาขาวิชา" value={info.majorId} onChange={(event) => setInfo({ ...info, majorId: event.target.value, classGroupId: '' })} className={`${inputClass} mt-1`}><option value="">เลือกสาขาวิชา</option>{availableMajors.map((major) => <option key={major.id} value={major.id}>[{major.code}] {major.name}</option>)}</select></label>
          {selectedMajor && <p className="text-xs text-slate-500">{selectedFaculty?.name || '—'} → {selectedDepartment?.name || '—'}</p>}
          <div className="grid gap-4 sm:grid-cols-3">
            <label htmlFor="registration-admission-year" className="text-xs font-semibold text-slate-700">ปีที่เข้าศึกษา<input id="registration-admission-year" aria-label="ปีที่เข้าศึกษา" readOnly value={studentAdmissionYear ? `${studentAdmissionYear} (ปีที่เข้าศึกษา ${getAdmissionCode(studentAdmissionYear)})` : 'ไม่สามารถอ่านจากอีเมลได้'} className={`${inputClass} mt-1 bg-slate-100`} /></label>
            <label htmlFor="registration-year-level" className="text-xs font-semibold text-slate-700">ชั้นปี<input id="registration-year-level" aria-label="ชั้นปี" readOnly value={yearLevel?.formattedYearLevel || 'คำนวณอัตโนมัติ'} className={`${inputClass} mt-1 bg-slate-100`} /></label>
            <label htmlFor="registration-class-group" className="text-xs font-semibold text-slate-700">กลุ่มเรียน<select id="registration-class-group" aria-label="กลุ่มเรียน" disabled={!info.majorId || !studentAdmissionYear || availableGroups.length === 0} value={info.classGroupId} onChange={(event) => setInfo({ ...info, classGroupId: event.target.value })} className={`${inputClass} mt-1`}><option value="">{info.majorId && studentAdmissionYear && availableGroups.length === 0 ? 'ยังไม่มีกลุ่มเรียนสำหรับสาขาและปีที่เข้าศึกษานี้' : 'ยังไม่กำหนด'}</option>{availableGroups.map((group) => <option key={group.id} value={group.id}>{group.code}</option>)}</select></label>
          </div>
          {info.majorId && studentAdmissionYear && availableGroups.length === 0 && <p className="text-xs font-medium text-amber-700">ยังไม่มีกลุ่มเรียนสำหรับสาขาและปีที่เข้าศึกษานี้</p>}
        </div>}

        {target.role === 'teacher' && <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <label htmlFor="registration-faculty" className="text-xs font-semibold text-slate-700">คณะ<select id="registration-faculty" aria-label="คณะ" value={info.facultyId} onChange={(event) => setInfo({ ...info, facultyId: event.target.value, departmentId: '' })} className={`${inputClass} mt-1`}><option value="">เลือกคณะ</option>{activeFaculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select></label>
          <label htmlFor="registration-department" className="text-xs font-semibold text-slate-700">ภาควิชา<select id="registration-department" aria-label="ภาควิชา" disabled={!info.facultyId} value={info.departmentId} onChange={(event) => setInfo({ ...info, departmentId: event.target.value })} className={`${inputClass} mt-1`}><option value="">เลือกภาควิชา</option>{availableDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
        </div>}

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><button type="button" onClick={() => { setError(''); setStep(2); }} className={secondaryButton}>ย้อนกลับ</button><button type="button" onClick={continueFromInfo} className={primaryButton}>ดำเนินการต่อ</button></div>
      </div>}

      {visibleStep === 4 && target && <MockFaceScanStep status={faceStatus} error={error} onStatusChange={(next) => { setFaceStatus(next); setError(''); }} onBack={() => { setError(''); setStep(3); }} onContinue={continueFromFace} />}

      {visibleStep === 5 && target && <div className="space-y-4">
        <div><h2 className="text-lg font-bold text-slate-900">ยืนยันการลงทะเบียน</h2><p className="mt-1 text-xs text-slate-500">ตรวจสอบข้อมูลก่อนบันทึกสถานะจำลอง</p></div>
        <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4 text-sm">
          {[['บัญชี', target.email], ['รหัสผ่าน', 'ตั้งค่าแล้ว ✓'], ['ประเภทผู้ใช้', roleLabel], [target.role === 'student' ? 'รหัสนักศึกษา' : 'รหัสผู้ใช้', info.code], ['ชื่อ-นามสกุล', `${info.firstName} ${info.lastName}`], ...(target.role === 'student' ? [['สาขาวิชา', selectedMajor ? `[${selectedMajor.code}] ${selectedMajor.name}` : '—'], ['ปีที่เข้าศึกษา', info.admissionYear ? `${info.admissionYear} (ปีที่เข้าศึกษา ${getAdmissionCode(info.admissionYear)})` : '—'], ['ชั้นปี', yearLevel?.formattedYearLevel || '—'], ['กลุ่มเรียน', selectedGroup?.code || 'ยังไม่กำหนด']] : []), ['ใบหน้า', faceStatus === 'verified_mock' ? 'ลงทะเบียนใบหน้าแล้ว ✓' : 'ยังไม่ลงทะเบียน']].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-slate-500">{label}</dt><dd className="break-all text-right font-semibold text-slate-900">{value}</dd></div>)}
        </dl>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><button type="button" onClick={() => { setError(''); setStep(4); }} className={secondaryButton}>ย้อนกลับ</button><button type="button" onClick={confirmRegistration} disabled={faceStatus !== 'verified_mock'} className={primaryButton}>ยืนยันการลงทะเบียน</button></div>
      </div>}
    </div>

    <p className="mt-6 text-center text-xs text-slate-500">มีบัญชีแล้ว? <button type="button" onClick={() => onGoLogin(selectedEmail)} className="font-bold text-blue-700 hover:underline">เข้าสู่ระบบ</button></p>
  </div>;
};
