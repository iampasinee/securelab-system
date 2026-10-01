import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Eye,
  GraduationCap,
  Network,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  UserPlus,
  Users,
  Workflow,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AcademicInput, AcademicRecord, AcademicTier } from '../../types/academic';
import {
  academicDeleteError,
  academicLabels,
  academicPath,
  generatedClassGroupCode,
  normalizeAcademicInput,
  studentsInAcademicRecord,
  validateAcademicInput,
} from '../../services/academicState';
import { AcademicCascade, AcademicSelection, emptyAcademicSelection } from './AcademicCascade';
import { Modal } from '../common/Modal';
import { academicSettings, calculateYearLevelFromAdmissionYear, getAdmissionCode, getAdmissionYearOptions } from '../../utils/academicYear';
import { AcademicStructureWizard } from './AcademicStructureWizard';
import { AcademicStructureTransactionResult } from '../../services/academicStructureWizard';

const tabs: Array<{ tier: AcademicTier; icon: React.ElementType }> = [
  { tier: 'faculties', icon: Building2 },
  { tier: 'departments', icon: Network },
  { tier: 'majors', icon: GraduationCap },
  { tier: 'classGroups', icon: Users },
];
const parentDepth: Record<AcademicTier, 1 | 2 | 3> = { faculties: 1, departments: 1, majors: 2, classGroups: 3 };
const searchPlaceholders: Record<AcademicTier, string> = {
  faculties: 'ค้นหารหัสหรือชื่อคณะ...',
  departments: 'ค้นหารหัสหรือชื่อภาควิชา...',
  majors: 'ค้นหารหัสหรือชื่อสาขาวิชา...',
  classGroups: 'ค้นหารหัสหรือชื่อกลุ่มเรียน...',
};
const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-blue-600';

const emptyInput: AcademicInput = {
  name: '',
  code: '',
  facultyId: '',
  departmentId: '',
  majorId: '',
  admissionYear: undefined,
  status: 'active',
};

export const FacultiesAndGroupsPage: React.FC = () => {
  const {
    academicState,
    students,
    courses,
    saveAcademicRecord,
    deleteAcademicRecord,
    setAcademicStatus,
    assignStudentsToClassGroup,
  } = useApp();
  const [tier, setTier] = useState<AcademicTier>('faculties');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [filter, setFilter] = useState<AcademicSelection>(emptyAcademicSelection);
  const [admissionYearFilter, setAdmissionYearFilter] = useState('');
  const [editor, setEditor] = useState<{ tier: AcademicTier; id?: string } | null>(null);
  const [detail, setDetail] = useState<{ tier: AcademicTier; id: string } | null>(null);
  const [confirm, setConfirm] = useState<{ action: 'delete' | 'status'; tier: AcademicTier; id: string } | null>(null);
  const [form, setForm] = useState<AcademicInput>(emptyInput);
  const [error, setError] = useState('');
  const [assigningGroupId, setAssigningGroupId] = useState<string | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [confirmReassignment, setConfirmReassignment] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const rows = useMemo(() => academicState[tier].filter((record) => {
    const path = academicPath(academicState, tier, record.id);
    const haystack = [record.name, record.code].join(' ').toLowerCase();
    return (!status || record.status === status) &&
      haystack.includes(search.trim().toLowerCase()) &&
      (!filter.facultyId || path.faculty?.id === filter.facultyId) &&
      (!filter.departmentId || path.department?.id === filter.departmentId) &&
      (!filter.majorId || path.major?.id === filter.majorId) &&
      (tier !== 'classGroups' || !admissionYearFilter || ('admissionYear' in record && record.admissionYear === Number(admissionYearFilter)));
  }), [academicState, tier, status, search, filter, admissionYearFilter]);

  const openEditor = (recordTier: AcademicTier, record?: AcademicRecord) => {
    const path = record ? academicPath(academicState, recordTier, record.id) : undefined;
    setForm({
      name: record?.name || '',
      code: record?.code || '',
      facultyId: path?.faculty?.id || filter.facultyId,
      departmentId: path?.department?.id || filter.departmentId,
      majorId: path?.major?.id || filter.majorId,
      admissionYear: record && 'admissionYear' in record
        ? record.admissionYear
        : recordTier === 'classGroups'
          ? Number(admissionYearFilter) || academicSettings.currentAcademicYear
          : undefined,
      status: record?.status || 'active',
    });
    setError('');
    setEditor({ tier: recordTier, id: record?.id });
  };

  const formError = editor
    ? validateAcademicInput(academicState, editor.tier, normalizeAcademicInput(form), editor.id)
    : undefined;
  const editorGroupLocked = Boolean(editor?.tier === 'classGroups' && editor.id && (
    students.some((student) => student.classGroupId === editor.id) ||
    courses.some((course) => course.sections.some((section) => section.cohorts?.some((cohort) => cohort.classGroupIds?.includes(editor.id!))))
  ));
  const detailRecord = detail ? academicState[detail.tier].find((record) => record.id === detail.id) : undefined;
  const confirmRecord = confirm ? academicState[confirm.tier].find((record) => record.id === confirm.id) : undefined;
  const deleteError = confirm?.action === 'delete'
    ? confirm.tier === 'classGroups' && courses.some((course) => course.sections.some((section) =>
      section.cohorts?.some((cohort) => cohort.classGroupIds?.includes(confirm.id))))
      ? 'ไม่สามารถลบกลุ่มเรียนนี้ได้ เนื่องจากมีตอนเรียนอ้างอิงอยู่ กรุณาปิดใช้งานแทน'
      : academicDeleteError(academicState, students, confirm.tier, confirm.id)
    : undefined;
  const assigningGroup = assigningGroupId
    ? academicState.classGroups.find((group) => group.id === assigningGroupId)
    : undefined;
  const eligibleStudents = assigningGroup ? students.filter((student) => {
    const haystack = `${student.studentCode} ${student.fullName}`.toLowerCase();
    return student.majorId === assigningGroup.majorId &&
      student.admissionYear === assigningGroup.admissionYear &&
      haystack.includes(assignmentSearch.trim().toLowerCase());
  }) : [];
  const selectedNeedsReassignment = eligibleStudents.some((student) =>
    selectedStudentIds.includes(student.id) && Boolean(student.classGroupId) && student.classGroupId !== assigningGroup?.id);

  const openAssignment = (groupId: string) => {
    setDetail(null);
    setAssigningGroupId(groupId);
    setAssignmentSearch('');
    setSelectedStudentIds([]);
    setConfirmReassignment(false);
    setError('');
  };

  const assignStudents = () => {
    if (!assigningGroup || !selectedStudentIds.length) return;
    const result = assignStudentsToClassGroup(assigningGroup.id, selectedStudentIds, confirmReassignment);
    if (result.success) setAssigningGroupId(null);
    else setError(result.error || 'ไม่สามารถเพิ่มนักศึกษาเข้ากลุ่มได้');
  };

  const save = () => {
    if (!editor) return;
    const result = saveAcademicRecord(editor.tier, form, editor.id);
    if (result.success) setEditor(null);
    else setError(result.error || 'ไม่สามารถบันทึกข้อมูลได้');
  };

  const finishWizard = (result: AcademicStructureTransactionResult) => {
    setWizardOpen(false);
    setTier('classGroups');
    setSearch('');
    setStatus('');
    setFilter({
      facultyId: result.faculty?.id || '',
      departmentId: result.department?.id || '',
      majorId: result.major?.id || '',
    });
    setAdmissionYearFilter(result.admissionYear ? String(result.admissionYear) : '');
  };

  const renderActions = (record: AcademicRecord) => (
    <div className="flex justify-end">
      {[
        { label: 'ดูรายละเอียด', icon: Eye, action: () => setDetail({ tier, id: record.id }) },
        { label: 'แก้ไข', icon: Pencil, action: () => openEditor(tier, record) },
        { label: record.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน', icon: Power, action: () => setConfirm({ action: 'status', tier, id: record.id }) },
        { label: 'ลบ', icon: Trash2, action: () => setConfirm({ action: 'delete', tier, id: record.id }) },
      ].map(({ label, icon: Icon, action }) => <button key={label} type="button" onClick={action} title={label} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"><Icon className="h-4 w-4" /></button>)}
    </div>
  );

  const emptyMessage = academicState[tier].length
    ? `ไม่พบ${academicLabels[tier]}ที่ตรงกับตัวกรอง`
    : `ยังไม่มีข้อมูล${academicLabels[tier]}`;

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-600"><Network className="h-6 w-6" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">จัดการคณะ ภาควิชา สาขาวิชา และกลุ่มเรียน</h1>
            <p className="mt-1 text-xs text-slate-500">จัดการโครงสร้างการศึกษาและกลุ่มประจำของนักศึกษา โดยไม่เปลี่ยนโครงสร้างตอนเรียนของรายวิชา</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => openEditor(tier)} className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            <Plus className="h-4 w-4" /> เพิ่ม{academicLabels[tier]}
          </button>
          <button type="button" onClick={() => setWizardOpen(true)} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
            <Workflow className="h-4 w-4" /> เพิ่มโครงสร้างการศึกษา
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tabs.map(({ tier: key, icon: Icon }) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex justify-between text-xs text-slate-500"><span>จำนวน{academicLabels[key]}</span><Icon className="h-4 w-4 text-blue-600" /></div>
          <div className="mt-3"><strong className="text-2xl text-slate-950">{academicState[key].length}</strong><span className="ml-2 text-[10px] text-teal-600">{academicState[key].filter((record) => record.status === 'active').length} ใช้งาน</span></div>
        </div>)}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div role="tablist" aria-label="โครงสร้างการศึกษา" className="flex border-b border-slate-200 bg-slate-50/60 px-3 pt-2">
          {tabs.map(({ tier: key, icon: Icon }) => <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tier === key}
            onClick={() => { setTier(key); setSearch(''); setStatus(''); setFilter(emptyAcademicSelection); setAdmissionYearFilter(''); }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold ${tier === key ? 'border-blue-600 bg-white text-blue-600' : 'border-transparent text-slate-500'}`}
          >
            <Icon className="h-4 w-4" />{academicLabels[key]}
            <span className="rounded-full bg-slate-100 px-2 text-[10px]">{academicState[key].length}</span>
          </button>)}
        </div>

        <div className="border-b border-slate-200 p-4">
          <div className={`grid items-end gap-3 ${tier === 'faculties' ? 'lg:grid-cols-[minmax(0,1fr)_220px]' : tier === 'departments' ? 'lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)_220px]' : tier === 'majors' ? 'xl:grid-cols-[minmax(240px,0.8fr)_minmax(460px,1.4fr)_220px]' : 'xl:grid-cols-[minmax(220px,0.7fr)_minmax(460px,1.3fr)_180px_180px]'}`}>
            <label className="space-y-1 text-xs font-semibold text-slate-700">
              <span>ค้นหา</span>
              <span className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholders[tier]} className={`${inputClass} pl-9`} /></span>
            </label>
            {tier !== 'faculties' && <AcademicCascade value={filter} onChange={setFilter} depth={parentDepth[tier]} activeOnly={false} />}
            {tier === 'classGroups' && <label className="space-y-1 text-xs font-semibold text-slate-700"><span>ปีที่เข้าศึกษา</span><input type="number" min="2500" value={admissionYearFilter} onChange={(event) => setAdmissionYearFilter(event.target.value)} placeholder="ทุกปีที่เข้าศึกษา" className={inputClass} /></label>}
            <label className="space-y-1 text-xs font-semibold text-slate-700"><span>สถานะ</span><select aria-label="สถานะ" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
              <option value="">ทุกสถานะ</option><option value="active">เปิดใช้งาน</option><option value="inactive">ปิดใช้งาน</option>
            </select></label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600"><tr>
              <th className="px-4 py-3">{tier === 'classGroups' ? 'รหัสกลุ่ม' : 'รหัส'}</th>
              <th className="px-4 py-3">ชื่อ{academicLabels[tier]}</th>
              {tier === 'faculties' && <><th className="px-4 py-3">จำนวนภาควิชา</th><th className="px-4 py-3">จำนวนสาขาวิชา</th></>}
              {tier === 'departments' && <><th className="px-4 py-3">คณะ</th><th className="px-4 py-3">จำนวนสาขาวิชา</th></>}
              {tier === 'majors' && <><th className="px-4 py-3">ภาควิชา</th><th className="px-4 py-3">คณะ</th></>}
              {tier === 'classGroups' && <><th className="px-4 py-3">สาขาวิชา</th><th className="px-4 py-3">ปีที่เข้าศึกษา</th><th className="px-4 py-3">ชั้นปี</th><th className="px-4 py-3">จำนวนนักศึกษา</th></>}
              <th className="px-4 py-3">สถานะ</th><th className="px-4 py-3 text-right">การดำเนินการ</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((record) => {
                const path = academicPath(academicState, tier, record.id);
                const departmentCount = tier === 'faculties'
                  ? academicState.departments.filter((department) => department.facultyId === record.id).length
                  : 0;
                const majorCount = tier === 'faculties'
                  ? academicState.majors.filter((major) => academicState.departments.some((department) => department.id === major.departmentId && department.facultyId === record.id)).length
                  : tier === 'departments'
                    ? academicState.majors.filter((major) => major.departmentId === record.id).length
                    : 0;
                return <tr key={record.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4 font-mono font-semibold text-blue-700">{record.code}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">{record.name}</td>
                  {tier === 'faculties' && <><td className="px-4 py-4 text-slate-600">{departmentCount} ภาควิชา</td><td className="px-4 py-4 text-slate-600">{majorCount} สาขาวิชา</td></>}
                  {tier === 'departments' && <><td className="px-4 py-4 text-slate-600">{path.faculty?.name || '—'}</td><td className="px-4 py-4 text-slate-600">{majorCount} สาขาวิชา</td></>}
                  {tier === 'majors' && <><td className="px-4 py-4 text-slate-600">{path.department?.name || '—'}</td><td className="px-4 py-4 text-slate-500">{path.faculty?.name || '—'}</td></>}
                  {tier === 'classGroups' && 'admissionYear' in record && <><td className="px-4 py-4 text-slate-600">{path.major ? `[${path.major.code}] ${path.major.name}` : '—'}</td><td className="px-4 py-4 font-semibold">ปีที่เข้าศึกษา {getAdmissionCode(record.admissionYear)}</td><td className="px-4 py-4">{calculateYearLevelFromAdmissionYear(record.admissionYear).isValid ? `ชั้นปี ${calculateYearLevelFromAdmissionYear(record.admissionYear).yearLevel}` : '—'}</td><td className="px-4 py-4">{studentsInAcademicRecord(academicState, students, tier, record.id).length} คน</td></>}
                  <td className="px-4 py-4"><span className={`rounded-full border px-2 py-1 text-[10px] ${record.status === 'active' ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{record.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span></td>
                  <td className="px-3 py-3">{renderActions(record)}</td>
                </tr>;
              })}
              {!rows.length && <tr><td colSpan={tier === 'classGroups' ? 8 : 6} className="px-4 py-12 text-center"><div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-slate-400"><Search className="h-7 w-7" /><p>{emptyMessage}</p><button type="button" onClick={() => openEditor(tier)} className={`${buttonClass} border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}><Plus className="h-4 w-4" />เพิ่ม{academicLabels[tier]}</button></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={`${editor?.id ? 'แก้ไข' : 'เพิ่ม'}${editor ? academicLabels[editor.tier] : ''}`} maxWidth="640">
        {editor && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (formError) setError(formError); else save(); }}>
          {editor.tier !== 'faculties' && <AcademicCascade
            value={{ facultyId: form.facultyId, departmentId: form.departmentId, majorId: form.majorId || '' }}
            onChange={(selection) => setForm((current) => ({ ...current, facultyId: selection.facultyId, departmentId: selection.departmentId, majorId: selection.majorId }))}
            depth={editor.tier === 'departments' ? 1 : editor.tier === 'majors' ? 2 : 3}
            retained={editor.id ? { facultyId: form.facultyId, departmentId: form.departmentId, majorId: form.majorId || '' } : undefined}
            disabled={editorGroupLocked}
          />}
          {editor.tier === 'classGroups' && <label className="block space-y-1 text-xs font-semibold"><span>ปีที่เข้าศึกษา</span><select required disabled={editorGroupLocked} value={form.admissionYear || ''} onChange={(event) => setForm({ ...form, admissionYear: Number(event.target.value) || undefined })} className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`}><option value="">เลือกปีที่เข้าศึกษา</option>{getAdmissionYearOptions().map((year) => <option key={year} value={year}>{getAdmissionCode(year)}</option>)}</select><span className="block font-normal text-slate-500">จัดเก็บเป็นปีการศึกษาเต็ม เช่น 67 = 2567</span></label>}
          {editor.tier === 'classGroups'
            ? <label className="block space-y-1 text-xs font-semibold"><span>รหัสกลุ่ม</span><input readOnly value={generatedClassGroupCode(academicState, form.majorId, form.admissionYear, editor.id)} placeholder="ระบบจะสร้างรหัสหลังเลือกสาขาวิชาและปีที่เข้าศึกษา" className={`${inputClass} bg-slate-100 font-mono text-slate-700`} /><span className="block font-normal text-slate-500">รหัสถูกสร้างอัตโนมัติและไม่สามารถแก้ไขโดยตรง</span></label>
            : <label className="block space-y-1 text-xs font-semibold"><span>รหัส{academicLabels[editor.tier]}</span><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className={inputClass} /></label>}
          <label className="block space-y-1 text-xs font-semibold"><span>{editor.tier === 'classGroups' ? 'ชื่อกลุ่ม (ไม่บังคับ)' : `ชื่อ${academicLabels[editor.tier]}`}</span><input required={editor.tier !== 'classGroups'} maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} /></label>
          <label className="block space-y-1 text-xs font-semibold"><span>สถานะ</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AcademicInput['status'] })} className={inputClass}><option value="active">เปิดใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></label>
          {editorGroupLocked && <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">กลุ่มนี้มีนักศึกษาหรือตอนเรียนอ้างอิงอยู่ จึงล็อกสาขาวิชา ปีที่เข้าศึกษา และรหัสกลุ่มเพื่อรักษาความถูกต้องของข้อมูล</p>}
          {(formError || error) && <p role="alert" className="text-xs text-red-600">{formError || error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setEditor(null)} className={`${buttonClass} border`}>ยกเลิก</button><button disabled={Boolean(formError)} className={`${buttonClass} bg-blue-600 text-white`}>บันทึก</button></div>
        </form>}
      </Modal>

      <Modal isOpen={Boolean(detailRecord)} onClose={() => setDetail(null)} title="รายละเอียด" maxWidth="640">
        {detail && detailRecord && (() => {
          const path = academicPath(academicState, detail.tier, detailRecord.id);
          const departmentCount = detail.tier === 'faculties'
            ? academicState.departments.filter((department) => department.facultyId === detailRecord.id).length
            : 0;
          const majorCount = detail.tier === 'faculties'
            ? academicState.majors.filter((major) => academicState.departments.some((department) => department.id === major.departmentId && department.facultyId === detailRecord.id)).length
            : detail.tier === 'departments'
              ? academicState.majors.filter((major) => major.departmentId === detailRecord.id).length
              : 0;
          const parentRows: Array<[string, string | number]> = detail.tier === 'faculties'
            ? [['จำนวนภาควิชา', departmentCount], ['จำนวนสาขาวิชา', majorCount]]
            : detail.tier === 'departments'
              ? [['คณะ', path.faculty?.name || '—'], ['จำนวนสาขาวิชา', majorCount]]
              : detail.tier === 'majors'
                ? [['คณะ', path.faculty?.name || '—'], ['ภาควิชา', path.department?.name || '—']]
                : 'admissionYear' in detailRecord
                  ? [
                    ['คณะ', path.faculty?.name || '—'],
                    ['ภาควิชา', path.department?.name || '—'],
                    ['สาขาวิชา', path.major ? `[${path.major.code}] ${path.major.name}` : '—'],
                    ['ปีที่เข้าศึกษา', `ปีที่เข้าศึกษา ${getAdmissionCode(detailRecord.admissionYear)}`],
                    ['ชั้นปี', calculateYearLevelFromAdmissionYear(detailRecord.admissionYear).isValid ? `ชั้นปี ${calculateYearLevelFromAdmissionYear(detailRecord.admissionYear).yearLevel}` : '—'],
                  ]
                  : [];
          const detailRows: Array<[string, string | number]> = [
            ['รหัส', detailRecord.code],
            [`ชื่อ${academicLabels[detail.tier]}`, detailRecord.name],
            ...parentRows,
            ['สถานะ', detailRecord.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'],
            ['จำนวนนักศึกษา', `${studentsInAcademicRecord(academicState, students, detail.tier, detailRecord.id).length} คน`],
          ];
          const groupStudents = detail.tier === 'classGroups'
            ? studentsInAcademicRecord(academicState, students, detail.tier, detailRecord.id)
            : [];
          return <div className="space-y-5"><dl className="space-y-3 text-sm">{detailRows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b pb-2"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>)}</dl>{detail.tier === 'classGroups' && <section className="space-y-3 border-t pt-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">นักศึกษาในกลุ่ม</h3><button type="button" onClick={() => openAssignment(detailRecord.id)} className={`${buttonClass} bg-blue-600 text-white`}><UserPlus className="h-4 w-4" />เพิ่มนักศึกษา</button></div>{groupStudents.length ? <div className="max-h-64 divide-y overflow-y-auto rounded-xl border">{groupStudents.map((student) => <div key={student.id} className="flex justify-between gap-3 px-3 py-2 text-xs"><span className="font-semibold">{student.fullName}</span><span className="font-mono text-slate-500">{student.studentCode}</span></div>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">ยังไม่มีนักศึกษาในกลุ่มนี้</p>}</section>}</div>;
        })()}
      </Modal>

      <Modal isOpen={Boolean(assigningGroup)} onClose={() => setAssigningGroupId(null)} title="เพิ่มนักศึกษาเข้ากลุ่มเรียน" maxWidth="3xl">
        {assigningGroup && (() => {
          const path = academicPath(academicState, 'classGroups', assigningGroup.id);
          return <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900"><strong>{path.major?.code} • ปีที่เข้าศึกษา {getAdmissionCode(assigningGroup.admissionYear)} • {assigningGroup.code}</strong><p className="mt-1 text-xs text-blue-700">เลือกได้เฉพาะนักศึกษาที่อยู่ในสาขาวิชาและปีที่เข้าศึกษาเดียวกัน</p></div>
            <label className="relative block"><span className="sr-only">ค้นหานักศึกษา</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder="ค้นหารหัสนักศึกษา / ชื่อ-นามสกุล..." className={`${inputClass} pl-9`} /></label>
            <div className="max-h-80 divide-y overflow-y-auto rounded-xl border border-slate-200">
              {eligibleStudents.map((student) => {
                const currentGroup = academicState.classGroups.find((group) => group.id === student.classGroupId);
                const selected = selectedStudentIds.includes(student.id);
                return <label key={student.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50"><input type="checkbox" checked={selected} disabled={student.classGroupId === assigningGroup.id} onChange={() => setSelectedStudentIds((current) => selected ? current.filter((id) => id !== student.id) : [...current, student.id])} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{student.fullName}</span><span className="text-xs text-slate-500">{student.studentCode}</span></span><span className={`text-xs ${currentGroup && currentGroup.id !== assigningGroup.id ? 'text-amber-700' : 'text-slate-500'}`}>{currentGroup ? currentGroup.id === assigningGroup.id ? 'อยู่ในกลุ่มนี้แล้ว' : `กลุ่มปัจจุบัน ${currentGroup.code}` : 'ยังไม่กำหนด'}</span></label>;
              })}
              {!eligibleStudents.length && <p className="p-8 text-center text-sm text-slate-500">ไม่พบนักศึกษาที่มีสาขาวิชาและปีที่เข้าศึกษาตรงกับกลุ่มนี้</p>}
            </div>
            {selectedNeedsReassignment && <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><input type="checkbox" checked={confirmReassignment} onChange={(event) => setConfirmReassignment(event.target.checked)} className="mt-0.5" /><span><strong>ยืนยันย้ายกลุ่ม</strong><br />นักศึกษาที่เลือกบางคนอยู่ในกลุ่มอื่น การดำเนินการนี้จะเปลี่ยนกลุ่มประจำของนักศึกษาอย่างชัดเจน</span></label>}
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setAssigningGroupId(null)} className={`${buttonClass} border`}>ยกเลิก</button><button type="button" disabled={!selectedStudentIds.length || (selectedNeedsReassignment && !confirmReassignment)} onClick={assignStudents} className={`${buttonClass} bg-blue-600 text-white`}>เพิ่มนักศึกษา ({selectedStudentIds.length})</button></div>
          </div>;
        })()}
      </Modal>

      <Modal isOpen={Boolean(confirmRecord)} onClose={() => setConfirm(null)} title={confirm?.action === 'delete' ? 'ยืนยันการลบ' : 'ยืนยันการเปลี่ยนสถานะ'}>
        {confirm && confirmRecord && <div className="space-y-4 text-sm">
          {deleteError ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-800"><AlertTriangle className="mb-2 h-5 w-5" />{deleteError}</p> : <p>ยืนยัน{confirm.action === 'delete' ? 'ลบ' : confirmRecord.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} “{confirmRecord.name}” หรือไม่?</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setConfirm(null)} className={`${buttonClass} border`}>{deleteError ? 'ปิด' : 'ยกเลิก'}</button>{!deleteError && <button type="button" className={`${buttonClass} bg-blue-600 text-white`} onClick={() => {
            const result = confirm.action === 'delete'
              ? deleteAcademicRecord(confirm.tier, confirm.id)
              : setAcademicStatus(confirm.tier, confirm.id, confirmRecord.status === 'active' ? 'inactive' : 'active');
            if (result.success) setConfirm(null);
          }}>ยืนยัน</button>}</div>
        </div>}
      </Modal>

      {wizardOpen && <AcademicStructureWizard onClose={() => setWizardOpen(false)} onSuccess={finishWizard} />}
    </div>
  );
};
