import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  GraduationCap,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Student } from '../../types';
import { academicPath, deriveStudentYearLevel, isAcademicPathActive } from '../../services/academicState';
import {
  academicSettings,
  calculateYearLevelFromAdmissionYear,
  getAdmissionCode,
  getAdmissionYearOptions,
  inferAdmissionYearFromStudentId,
} from '../../utils/academicYear';
import { AcademicCascade, AcademicSelection, emptyAcademicSelection } from './AcademicCascade';
import { Modal } from '../common/Modal';

const pageSize = 10;
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-blue-600 disabled:bg-slate-100 disabled:text-slate-400';
const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600';

type FilterMode = 'all' | 'admission';

interface StudentFormState {
  studentCode: string;
  firstName: string;
  lastName: string;
  email: string;
  majorId: string;
  admissionYear: string;
  classGroupId: string;
  accountStatus: Student['accountStatus'];
  faceReferenceUrl: string;
}

const emptyForm = (): StudentFormState => ({
  studentCode: '',
  firstName: '',
  lastName: '',
  email: '',
  majorId: '',
  admissionYear: '',
  classGroupId: '',
  accountStatus: 'active',
  faceReferenceUrl: '',
});

interface StudentEditorFormProps {
  student?: Student;
  onCancel: () => void;
  onSuccess: () => void;
  secondaryLabel?: string;
}

export const StudentEditorForm: React.FC<StudentEditorFormProps> = ({
  student,
  onCancel,
  onSuccess,
  secondaryLabel = 'ยกเลิก',
}) => {
  const { students, academicState, addStudent, updateStudent } = useApp();
  const initialPath = student?.majorId ? academicPath(academicState, 'majors', student.majorId) : undefined;
  const [form, setForm] = useState<StudentFormState>(() => student ? {
    studentCode: student.studentCode,
    firstName: student.firstName || student.firstNameEn || student.fullName.split(' ')[0] || '',
    lastName: student.lastName || student.lastNameEn || student.fullName.split(' ').slice(1).join(' '),
    email: student.email,
    majorId: student.majorId || '',
    admissionYear: student.admissionYear ? String(student.admissionYear) : '',
    classGroupId: student.classGroupId || '',
    accountStatus: student.accountStatus,
    faceReferenceUrl: student.faceReferenceUrl,
  } : emptyForm());
  const [formSelection, setFormSelection] = useState<AcademicSelection>(() => ({
    facultyId: initialPath?.faculty?.id || '',
    departmentId: initialPath?.department?.id || '',
    majorId: student?.majorId || '',
  }));
  const [admissionYearEdited, setAdmissionYearEdited] = useState(Boolean(student?.admissionYear));
  const [error, setError] = useState('');

  const matchingFormGroups = useMemo(() => academicState.classGroups.filter((group) =>
    (group.status === 'active' || group.id === form.classGroupId) &&
    group.majorId === formSelection.majorId &&
    group.admissionYear === Number(form.admissionYear)), [academicState.classGroups, formSelection.majorId, form.admissionYear, form.classGroupId]);

  const saveStudent = () => {
    const studentCode = form.studentCode.trim();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const admissionYear = Number(form.admissionYear);
    const major = academicState.majors.find((item) => item.id === formSelection.majorId);
    const department = academicState.departments.find((item) => item.id === major?.departmentId);
    const faculty = academicState.faculties.find((item) => item.id === department?.facultyId);
    const year = calculateYearLevelFromAdmissionYear(admissionYear);
    if (!studentCode || !firstName || !lastName || !form.email.trim()) return setError('กรุณากรอกข้อมูลประจำตัวให้ครบถ้วน');
    if (students.some((item) => item.id !== student?.id && item.studentCode.toLowerCase() === studentCode.toLowerCase())) return setError('มีรหัสนักศึกษานี้อยู่แล้ว');
    if (!major || !department || !faculty || !isAcademicPathActive(academicState, 'majors', major.id)) return setError('กรุณาเลือกคณะ ภาควิชา และสาขาวิชาที่เปิดใช้งานให้ครบถ้วน');
    if (!year.isValid) return setError(year.errorMessage || 'ปีการศึกษาที่เข้าไม่ถูกต้อง');
    const values: Omit<Student, 'id'> = {
      studentCode,
      fullName: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      firstNameEn: firstName,
      lastNameEn: lastName,
      email: form.email.trim(),
      majorId: major.id,
      admissionYear,
      classGroupId: form.classGroupId || undefined,
      faculty: faculty.name,
      department: department.name,
      year: year.yearLevel,
      program: major.name,
      programCode: major.code,
      faceReferenceUrl: form.faceReferenceUrl,
      faceReferenceStatus: form.faceReferenceUrl ? 'available' : 'missing',
      accountStatus: form.accountStatus,
      isFirstTime: false,
    };
    const success = student ? updateStudent(student.id, values) : addStudent(values);
    if (success) onSuccess();
  };

  return <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); saveStudent(); }}>
    <section className="space-y-3"><h3 className="font-bold text-slate-900">ข้อมูลประจำตัว</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">รหัสนักศึกษา<input value={form.studentCode} onChange={(event) => { const studentCode = event.target.value; const inferredYear = inferAdmissionYearFromStudentId(studentCode); setForm((current) => { const admissionYear = !admissionYearEdited && inferredYear ? String(inferredYear) : current.admissionYear; const retainedGroup = academicState.classGroups.find((group) => group.id === current.classGroupId && group.admissionYear === Number(admissionYear)); return { ...current, studentCode, admissionYear, classGroupId: retainedGroup ? current.classGroupId : '' }; }); }} className={`${inputClass} mt-1`} /><span className="mt-1 block font-normal text-slate-500">ระบบจะแนะนำปีที่เข้าศึกษาจากเลข 2 หลักแรกเมื่อรหัสนักศึกษาครบ และยังแก้ไขได้</span></label><label className="text-xs font-semibold">อีเมล<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs font-semibold">ชื่อ<input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs font-semibold">นามสกุล<input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} className={`${inputClass} mt-1`} /></label></div></section>
    <section className="space-y-3 border-t pt-4">
      <h3 className="font-bold text-slate-900">ข้อมูลการศึกษา</h3>
      <AcademicCascade
        value={formSelection}
        onChange={(next) => {
          setFormSelection(next);
          setForm((current) => {
            const retainedGroup = academicState.classGroups.find((group) =>
              group.id === current.classGroupId && group.majorId === next.majorId);
            return { ...current, majorId: next.majorId, classGroupId: retainedGroup ? current.classGroupId : '' };
          });
        }}
        retained={student ? formSelection : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold">ปีที่เข้าศึกษา<select value={form.admissionYear} onChange={(event) => {
          const admissionYear = event.target.value;
          setAdmissionYearEdited(true);
          setForm((current) => {
            const retainedGroup = academicState.classGroups.find((group) =>
              group.id === current.classGroupId && group.admissionYear === Number(admissionYear));
            return { ...current, admissionYear, classGroupId: retainedGroup ? current.classGroupId : '' };
          });
        }} className={`${inputClass} mt-1`}><option value="">เลือกปีที่เข้าศึกษา</option>{getAdmissionYearOptions().map((year) => <option key={year} value={year}>{getAdmissionCode(year)}</option>)}</select><span className="mt-1 block font-normal text-slate-500">จัดเก็บเป็นปีการศึกษาเต็ม เช่น 67 = 2567</span></label>
        <label className="text-xs font-semibold">ชั้นปีปัจจุบัน<input readOnly value={form.admissionYear && calculateYearLevelFromAdmissionYear(Number(form.admissionYear)).isValid ? `ชั้นปี ${calculateYearLevelFromAdmissionYear(Number(form.admissionYear)).yearLevel}` : '—'} className={`${inputClass} mt-1 bg-slate-100`} /><span className="mt-1 block font-normal text-slate-500">คำนวณจากปีการศึกษาปัจจุบัน {academicSettings.currentAcademicYear}</span></label>
        <label className="text-xs font-semibold">กลุ่มเรียน (ไม่บังคับ)<select value={form.classGroupId} onChange={(event) => setForm({ ...form, classGroupId: event.target.value })} disabled={!formSelection.majorId || !form.admissionYear} className={`${inputClass} mt-1`}><option value="">ยังไม่กำหนด</option>{matchingFormGroups.map((group) => <option key={group.id} value={group.id}>{group.code}{group.name ? ` · ${group.name}` : ''}{group.status === 'inactive' ? ' (ปิดใช้งาน)' : ''}</option>)}</select><span className="mt-1 block font-normal text-slate-500">แสดงเฉพาะกลุ่มที่ตรงกับสาขาวิชาและปีที่เข้าศึกษา</span></label>
      </div>
    </section>
    <section className="grid gap-3 border-t pt-4 sm:grid-cols-2"><label className="text-xs font-semibold">สถานะบัญชี<select value={form.accountStatus} onChange={(event) => setForm({ ...form, accountStatus: event.target.value as Student['accountStatus'] })} className={`${inputClass} mt-1`}><option value="active">ปกติ</option><option value="suspended">ถูกระงับ</option><option value="graduated_inactive">พ้นสภาพ</option></select></label><label className="text-xs font-semibold">URL ข้อมูลใบหน้า<input value={form.faceReferenceUrl} onChange={(event) => setForm({ ...form, faceReferenceUrl: event.target.value })} className={`${inputClass} mt-1`} /></label></section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onCancel} className={`${buttonClass} border`}>{secondaryLabel}</button><button className={`${buttonClass} bg-blue-600 text-white`}>{student ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลนักศึกษา'}</button></div>
  </form>;
};

export const StudentManagement: React.FC = () => {
  const { students, academicState, deleteStudent, updateAccountStatus, showToast } = useApp();
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<AcademicSelection>(emptyAcademicSelection);
  const [admissionFilter, setAdmissionFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [faceFilter, setFaceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Student | 'new' | null>(null);
  const [detail, setDetail] = useState<Student | null>(null);
  const [confirm, setConfirm] = useState<{ student: Student; action: 'delete' | 'status' } | null>(null);

  const resolved = useMemo(() => students.map((student) => {
    const path = student.majorId ? academicPath(academicState, 'majors', student.majorId) : undefined;
    const year = deriveStudentYearLevel(student);
    const classGroup = academicState.classGroups.find((group) => group.id === student.classGroupId);
    return { student, path, year, classGroup };
  }), [students, academicState]);

  const admissionYears = useMemo<number[]>(() => [...new Set<number>(students.flatMap((student): number[] =>
    Number.isSafeInteger(student.admissionYear) ? [student.admissionYear as number] : []))].sort((a, b) => b - a), [students]);
  const yearLevels = useMemo<number[]>(() => [...new Set<number>(resolved.flatMap((row): number[] =>
    row.year?.isValid ? [row.year.yearLevel] : []))].sort((a, b) => a - b), [resolved]);

  const filtered = useMemo(() => resolved.filter(({ student, path, year }) => {
    if (filterMode === 'all') {
      const haystack = [student.studentCode, student.fullName, student.firstName, student.lastName, student.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const hasFaceData = Boolean(student.faceReferenceUrl);
      return haystack.includes(search.trim().toLowerCase()) &&
        (!statusFilter || student.accountStatus === statusFilter) &&
        (!faceFilter || (faceFilter === 'available' ? hasFaceData : !hasFaceData));
    }
    return (!selection.facultyId || path?.faculty?.id === selection.facultyId) &&
      (!selection.departmentId || path?.department?.id === selection.departmentId) &&
      (!selection.majorId || student.majorId === selection.majorId) &&
      (!admissionFilter || student.admissionYear === Number(admissionFilter)) &&
      (!yearFilter || year?.yearLevel === Number(yearFilter)) &&
      (!groupFilter || (groupFilter === '__unassigned__' ? !student.classGroupId : student.classGroupId === groupFilter));
  }), [resolved, filterMode, search, statusFilter, faceFilter, selection, admissionFilter, yearFilter, groupFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [filterMode, search, selection, admissionFilter, yearFilter, groupFilter, statusFilter, faceFilter]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  const openEditor = (student?: Student) => {
    setEditor(student || 'new');
  };

  const exportCsv = () => {
    const header = ['รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'อีเมล', 'คณะ', 'ภาควิชา', 'สาขาวิชา', 'ปีที่เข้าศึกษา', 'ชั้นปี', 'กลุ่มเรียน', 'สถานะ'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map(({ student, path, year, classGroup }) => [
      student.studentCode,
      student.fullName,
      student.email,
      path?.faculty?.name || '',
      path?.department?.name || '',
      path?.major?.name || '',
      student.admissionYear ? getAdmissionCode(student.admissionYear) : '',
      year?.yearLevel || '',
      classGroup?.code || '',
      student.accountStatus,
    ].map(escape).join(','));
    const blob = new Blob([`\uFEFF${header.map(escape).join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('ส่งออก CSV สำเร็จ', `ส่งออกนักศึกษา ${filtered.length} คน`, 'success');
  };

  const clearAcademicFilters = () => {
    setSelection(emptyAcademicSelection);
    setAdmissionFilter('');
    setYearFilter('');
    setGroupFilter('');
  };

  const matchingFilterGroups = useMemo(() => academicState.classGroups.filter((group) =>
    (!selection.majorId || group.majorId === selection.majorId) &&
    (!admissionFilter || group.admissionYear === Number(admissionFilter))), [academicState.classGroups, selection.majorId, admissionFilter]);

  return <div className="min-w-0 space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white"><GraduationCap className="h-5 w-5" /></span><div><h1 className="text-xl font-bold text-slate-950">จัดการข้อมูลนักศึกษา</h1><p className="text-xs text-slate-500">จัดการข้อมูลประจำตัว สาขาวิชา ปีที่เข้าศึกษา และสถานะบัญชี</p></div></div>
      <button type="button" onClick={() => openEditor()} className={`${buttonClass} bg-blue-600 text-white`}><Plus className="h-4 w-4" />เพิ่มนักศึกษาใหม่</button>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'นักศึกษาทั้งหมด', value: students.length, icon: GraduationCap, color: 'text-blue-600' },
        { label: 'สถานะปกติ', value: students.filter((student) => student.accountStatus === 'active').length, icon: UserRoundCheck, color: 'text-emerald-600' },
        { label: 'ถูกระงับ / พ้นสภาพ', value: students.filter((student) => student.accountStatus !== 'active').length, icon: UserRoundX, color: 'text-red-600' },
        { label: 'มีข้อมูลใบหน้า', value: students.filter((student) => Boolean(student.faceReferenceUrl)).length, icon: Eye, color: 'text-violet-600' },
      ].map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between text-xs text-slate-500"><span>{label}</span><Icon className={`h-4 w-4 ${color}`} /></div><strong className={`mt-3 block text-2xl ${color}`}>{value}</strong></div>)}
    </div>

    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto" role="group" aria-label="รูปแบบการกรองนักศึกษา">
          {[
            { value: 'all' as const, label: 'นักศึกษาทั้งหมด', icon: Users },
            { value: 'admission' as const, label: 'แยกตามปีที่เข้าศึกษา', icon: CalendarRange },
          ].map(({ value, label, icon: Icon }) => <button
            key={value}
            type="button"
            aria-pressed={filterMode === value}
            onClick={() => setFilterMode(value)}
            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition sm:flex-none ${filterMode === value ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
          ><Icon className="h-4 w-4" />{label}</button>)}
        </div>
        <button type="button" onClick={exportCsv} className={`${buttonClass} border border-slate-200 text-slate-700 hover:bg-slate-50`}><Download className="h-4 w-4" />ส่งออก CSV</button>
      </div>

      {filterMode === 'all' ? <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="relative min-w-0"><span className="sr-only">ค้นหานักศึกษา</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหารหัสนักศึกษา / ชื่อ-นามสกุล..." className={`${inputClass} pl-9`} /></label>
        <label className="space-y-1 text-xs font-semibold text-slate-700"><span>สถานะบัญชี</span><select aria-label="สถานะบัญชี" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="">ทุกสถานะบัญชี</option><option value="active">ปกติ</option><option value="suspended">ถูกระงับ</option><option value="graduated_inactive">พ้นสภาพ</option></select></label>
        <label className="space-y-1 text-xs font-semibold text-slate-700"><span>ข้อมูลใบหน้า</span><select aria-label="สถานะข้อมูลใบหน้า" value={faceFilter} onChange={(event) => setFaceFilter(event.target.value)} className={inputClass}><option value="">ทุกสถานะข้อมูลใบหน้า</option><option value="available">มีข้อมูลใบหน้า</option><option value="missing">ไม่มีข้อมูลใบหน้า</option></select></label>
      </div> : <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
        <div><h2 className="text-sm font-bold text-slate-900">ตัวกรองข้อมูลการศึกษา</h2><p className="mt-1 text-xs text-slate-500">เลือกคณะ ภาควิชา สาขาวิชา และปีที่เข้าศึกษาเพื่อกรองนักศึกษา</p></div>
        <AcademicCascade value={selection} onChange={(next) => {
          setSelection(next);
          setGroupFilter('');
        }} activeOnly={false} />
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="space-y-1 text-xs font-semibold text-slate-700"><span>ปีที่เข้าศึกษา</span><select aria-label="ปีที่เข้าศึกษา" value={admissionFilter} onChange={(event) => { setAdmissionFilter(event.target.value); setGroupFilter(''); }} className={inputClass}><option value="">ทุกปีที่เข้าศึกษา</option>{admissionYears.map((year) => <option key={year} value={year}>ปีที่เข้าศึกษา {getAdmissionCode(year)}</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold text-slate-700"><span>ชั้นปี</span><select aria-label="ชั้นปี" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className={inputClass}><option value="">ทุกชั้นปี</option>{yearLevels.map((year) => <option key={year} value={year}>ชั้นปี {year}</option>)}</select></label>
          <label className="space-y-1 text-xs font-semibold text-slate-700"><span>กลุ่มเรียน</span><select aria-label="กลุ่มเรียน" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} disabled={!selection.majorId || !admissionFilter} className={inputClass}><option value="">ทุกกลุ่มเรียน</option><option value="__unassigned__">ยังไม่กำหนด</option>{matchingFilterGroups.map((group) => <option key={group.id} value={group.id}>{group.code}{group.name ? ` · ${group.name}` : ''}</option>)}</select></label>
          <button type="button" onClick={clearAcademicFilters} className={`${buttonClass} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}><RotateCcw className="h-4 w-4" />ล้างตัวกรอง</button>
        </div>
      </div>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3">รหัสนักศึกษา</th><th className="px-4 py-3">ชื่อ-นามสกุล</th><th className="px-4 py-3">สาขาวิชา</th><th className="px-4 py-3">ปีที่เข้าศึกษา</th><th className="px-4 py-3">ชั้นปี</th><th className="px-4 py-3">กลุ่มเรียน</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3 text-right">การดำเนินการ</th></tr></thead><tbody className="divide-y divide-slate-100">
        {visible.map(({ student, path, year, classGroup }) => <tr key={student.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-mono font-semibold">{student.studentCode}</td><td className="px-4 py-4 font-semibold">{student.fullName}</td><td className="max-w-[320px] px-4 py-4">{path?.major ? <span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-blue-700">[{path.major.code}] {path.major.name}</span> : <span className="text-amber-600">ยังไม่กำหนด</span>}</td><td className="whitespace-nowrap px-4 py-4 font-semibold">{student.admissionYear ? `ปีที่เข้าศึกษา ${getAdmissionCode(student.admissionYear)}` : '—'}</td><td className="whitespace-nowrap px-4 py-4">{year?.isValid ? `ชั้นปี ${year.yearLevel}` : '—'}</td><td className="whitespace-nowrap px-4 py-4">{classGroup ? <span className="rounded-md bg-violet-50 px-2 py-1 font-semibold text-violet-700">{classGroup.code}</span> : <span className="text-slate-400">ยังไม่กำหนด</span>}</td><td className="px-4 py-4"><span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] ${student.accountStatus === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{student.accountStatus === 'active' ? 'ปกติ' : student.accountStatus === 'suspended' ? 'ถูกระงับ' : 'พ้นสภาพ'}</span></td><td className="px-3 py-3"><div className="flex justify-end">{[
          { label: 'ดูรายละเอียด', icon: Eye, action: () => setDetail(student) },
          { label: 'แก้ไข', icon: Pencil, action: () => openEditor(student) },
          { label: student.accountStatus === 'active' ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี', icon: AlertTriangle, action: () => setConfirm({ student, action: 'status' }) },
          { label: 'ลบ', icon: Trash2, action: () => setConfirm({ student, action: 'delete' }) },
        ].map(({ label, icon: Icon, action }) => <button key={label} type="button" onClick={action} title={label} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Icon className="h-4 w-4" /></button>)}</div></td></tr>)}
        {!visible.length && <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-400">ไม่พบนักศึกษาที่ตรงกับเงื่อนไข</td></tr>}
      </tbody></table></div>
      <footer className="flex items-center justify-between border-t bg-slate-50/50 px-4 py-3 text-xs text-slate-500"><span>แสดง {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} จาก {filtered.length} รายการ</span><div className="flex items-center gap-2"><button type="button" aria-label="หน้าก่อนหน้า" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className={`${buttonClass} border`}><ChevronLeft className="h-4 w-4" /></button><span>{page} / {totalPages}</span><button type="button" aria-label="หน้าถัดไป" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className={`${buttonClass} border`}><ChevronRight className="h-4 w-4" /></button></div></footer>
    </section>

    <Modal isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={editor === 'new' ? 'เพิ่มนักศึกษาใหม่' : 'แก้ไขข้อมูลนักศึกษา'} maxWidth="4xl">
      {editor && <StudentEditorForm
        key={editor === 'new' ? 'new' : editor.id}
        student={editor === 'new' ? undefined : editor}
        onCancel={() => setEditor(null)}
        onSuccess={() => setEditor(null)}
      />}
    </Modal>

    <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title="รายละเอียดนักศึกษา" maxWidth="640">{detail && (() => { const path = detail.majorId ? academicPath(academicState, 'majors', detail.majorId) : undefined; const year = deriveStudentYearLevel(detail); const classGroup = academicState.classGroups.find((group) => group.id === detail.classGroupId); return <dl className="space-y-3 text-sm">{[['รหัสนักศึกษา', detail.studentCode], ['ชื่อ-นามสกุล', detail.fullName], ['อีเมล', detail.email], ['คณะ', path?.faculty?.name || '—'], ['ภาควิชา', path?.department?.name || '—'], ['สาขาวิชา', path?.major ? `[${path.major.code}] ${path.major.name}` : '—'], ['ปีที่เข้าศึกษา', detail.admissionYear ? `ปีที่เข้าศึกษา ${getAdmissionCode(detail.admissionYear)}` : '—'], ['ชั้นปี', year?.isValid ? String(year.yearLevel) : '—'], ['กลุ่มเรียน', classGroup?.code || 'ยังไม่กำหนด']].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b pb-2"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>)}</dl>; })()}</Modal>

    <Modal isOpen={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm?.action === 'delete' ? 'ยืนยันการลบนักศึกษา' : 'ยืนยันการเปลี่ยนสถานะบัญชี'}>{confirm && <div className="space-y-4 text-sm"><p>ยืนยัน{confirm.action === 'delete' ? 'ลบ' : confirm.student.accountStatus === 'active' ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี'} “{confirm.student.fullName}” หรือไม่?</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirm(null)} className={`${buttonClass} border`}>ยกเลิก</button><button type="button" onClick={() => { const success = confirm.action === 'delete' ? deleteStudent(confirm.student.id) : (updateAccountStatus(confirm.student.id, confirm.student.accountStatus === 'active' ? 'suspended' : 'active'), true); if (success) setConfirm(null); }} className={`${buttonClass} bg-blue-600 text-white`}>ยืนยัน</button></div></div>}</Modal>
  </div>;
};
