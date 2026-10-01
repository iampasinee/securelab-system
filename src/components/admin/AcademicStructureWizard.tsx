import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Layers3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  AcademicStructureChoice,
  AcademicStructureChoiceMode,
  AcademicStructureTransactionResult,
  buildAcademicStructureTransaction,
  createAcademicStructureWizardDraft,
} from '../../services/academicStructureWizard';
import { AcademicStatus } from '../../types/academic';
import { getAdmissionCode, getAdmissionYearOptions } from '../../utils/academicYear';
import { Modal } from '../common/Modal';

const steps = ['คณะ', 'ภาควิชา', 'สาขาวิชา', 'ปีที่เข้าศึกษาและกลุ่มเรียน', 'ตรวจสอบและบันทึก'];
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40';

interface AcademicStructureWizardProps {
  onClose: () => void;
  onSuccess: (result: AcademicStructureTransactionResult) => void;
}

const blankChoice = (mode: AcademicStructureChoiceMode = 'existing'): AcademicStructureChoice => ({
  mode,
  existingId: '',
  code: '',
  name: '',
  status: 'active',
});

const statusLabel = (status: AcademicStatus) => status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน';

export const AcademicStructureWizard: React.FC<AcademicStructureWizardProps> = ({ onClose, onSuccess }) => {
  const { academicState, saveAcademicStructure } = useApp();
  const [initialDraft] = useState(createAcademicStructureWizardDraft);
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [confirmed, setConfirmed] = useState(false);
  const [exitConfirmation, setExitConfirmation] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validation = useMemo(
    () => buildAcademicStructureTransaction(academicState, draft, step),
    [academicState, draft, step],
  );
  const preview = useMemo(
    () => buildAcademicStructureTransaction(academicState, draft, 4),
    [academicState, draft],
  );
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const requestClose = () => {
    if (isDirty) setExitConfirmation(true);
    else onClose();
  };

  const updateChoice = (
    key: 'faculty' | 'department' | 'major',
    patch: Partial<AcademicStructureChoice>,
  ) => {
    setSubmitError('');
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  };

  const changeFacultyMode = (mode: AcademicStructureChoiceMode) => setDraft((current) => ({
    ...current,
    faculty: blankChoice(mode),
    department: blankChoice(mode === 'new' ? 'new' : 'existing'),
    major: blankChoice(mode === 'new' ? 'new' : 'existing'),
  }));
  const changeFaculty = (existingId: string) => setDraft((current) => ({
    ...current,
    faculty: { ...current.faculty, existingId },
    department: blankChoice(),
    major: blankChoice(),
  }));
  const changeDepartmentMode = (mode: AcademicStructureChoiceMode) => setDraft((current) => ({
    ...current,
    department: blankChoice(mode),
    major: blankChoice(mode === 'new' ? 'new' : 'existing'),
  }));
  const changeDepartment = (existingId: string) => setDraft((current) => ({
    ...current,
    department: { ...current.department, existingId },
    major: blankChoice(),
  }));
  const changeMajorMode = (mode: AcademicStructureChoiceMode) => setDraft((current) => ({
    ...current,
    major: blankChoice(mode),
  }));

  const selectedFacultyId = draft.faculty.mode === 'existing' ? draft.faculty.existingId : '';
  const selectedDepartmentId = draft.department.mode === 'existing' ? draft.department.existingId : '';
  const departments = academicState.departments.filter((item) => item.facultyId === selectedFacultyId && item.status === 'active');
  const majors = academicState.majors.filter((item) => item.departmentId === selectedDepartmentId && item.status === 'active');

  const modeSelector = (
    label: string,
    value: AcademicStructureChoiceMode,
    onChange: (mode: AcademicStructureChoiceMode) => void,
    existingDisabled = false,
  ) => (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-slate-700">วิธีเพิ่ม{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          { value: 'existing' as const, label: `เลือก${label}ที่มีอยู่`, disabled: existingDisabled },
          { value: 'new' as const, label: `สร้าง${label}ใหม่`, disabled: false },
        ]).map((option) => <label key={option.value} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${value === option.value ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200'} ${option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
          <input type="radio" checked={value === option.value} disabled={option.disabled} onChange={() => onChange(option.value)} />
          <span className="font-semibold">{option.label}</span>
        </label>)}
      </div>
    </fieldset>
  );

  const newRecordFields = (
    key: 'faculty' | 'department' | 'major',
    label: string,
  ) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-xs font-semibold text-slate-700">
        <span>รหัส{label}</span>
        <input value={draft[key].code} maxLength={30} onChange={(event) => updateChoice(key, { code: event.target.value.toUpperCase() })} className={inputClass} placeholder={`กรอกรหัส${label}`} />
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-700">
        <span>ชื่อ{label}</span>
        <input value={draft[key].name} maxLength={150} onChange={(event) => updateChoice(key, { name: event.target.value })} className={inputClass} placeholder={`กรอกชื่อ${label}`} />
      </label>
      <label className="space-y-1 text-xs font-semibold text-slate-700 sm:col-span-2">
        <span>สถานะ</span>
        <select value={draft[key].status} onChange={(event) => updateChoice(key, { status: event.target.value as AcademicStatus })} className={inputClass}>
          <option value="active">เปิดใช้งาน</option>
          <option value="inactive">ปิดใช้งาน</option>
        </select>
      </label>
    </div>
  );

  const reviewRow = (label: string, record?: AcademicStructureTransactionResult['faculty']) => (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{record ? `[${record.code}] ${record.name}` : '—'}</p></div>
      {record && <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${record.mode === 'new' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{record.mode === 'new' ? 'สร้างใหม่' : 'มีอยู่แล้ว'}</span><span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] text-teal-700">{statusLabel(record.status)}</span></div>}
    </div>
  );

  const submit = () => {
    if (step < 5) {
      if (!validation.error) setStep((current) => Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5);
      return;
    }
    if (!confirmed) return;
    const result = saveAcademicStructure(draft);
    if (result.success) onSuccess(result);
    else {
      setSubmitError(result.error || 'ไม่สามารถเพิ่มโครงสร้างการศึกษาได้');
      if (result.step) setStep(result.step);
    }
  };

  return (
    <Modal
      isOpen
      onClose={exitConfirmation ? () => setExitConfirmation(false) : requestClose}
      title={exitConfirmation ? 'ยกเลิกการเพิ่มโครงสร้างการศึกษา' : 'เพิ่มโครงสร้างการศึกษา'}
      maxWidth="4xl"
      headerContent={!exitConfirmation && <nav aria-label="ขั้นตอนเพิ่มโครงสร้างการศึกษา" className="border-b border-slate-100 px-4 py-3 sm:px-6">
        <p className="text-xs font-semibold text-blue-700 md:hidden">ขั้นตอนที่ {step} จาก 5 · {steps[step - 1]}</p>
        <ol className="hidden grid-cols-5 gap-3 md:grid">{steps.map((title, index) => {
          const number = index + 1;
          const completed = number < step;
          const current = number === step;
          return <li key={title} aria-current={current ? 'step' : undefined} className="min-w-0 text-center">
            <div className="flex items-center"><span className={`h-px flex-1 ${number === 1 ? 'invisible' : completed || current ? 'bg-blue-300' : 'bg-slate-200'}`} /><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${completed ? 'border-teal-600 bg-teal-600 text-white' : current ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-400'}`}>{completed ? <Check className="h-4 w-4" /> : number}</span><span className={`h-px flex-1 ${number === steps.length ? 'invisible' : completed ? 'bg-blue-300' : 'bg-slate-200'}`} /></div>
            <span className={`mt-1 block truncate text-[11px] ${current ? 'font-semibold text-blue-700' : 'text-slate-500'}`}>{title}</span>
          </li>;
        })}</ol>
      </nav>}
      footer={exitConfirmation
        ? <><button type="button" onClick={() => setExitConfirmation(false)} className={`${buttonClass} border border-slate-200 bg-white text-slate-700`}>กลับไปทำต่อ</button><button type="button" onClick={onClose} className={`${buttonClass} bg-red-600 text-white`}>ออกโดยไม่บันทึก</button></>
        : <><button type="button" onClick={requestClose} className={`${buttonClass} mr-auto border border-slate-200 bg-white text-slate-700`}>ยกเลิก</button>{step > 1 && <button type="button" onClick={() => { setStep((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5); setSubmitError(''); }} className={`${buttonClass} border border-slate-200 bg-white text-slate-700`}><ChevronLeft className="h-4 w-4" />ย้อนกลับ</button>}<button type="button" onClick={submit} disabled={Boolean(validation.error) || (step === 5 && !confirmed)} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>{step === 5 ? <><Check className="h-4 w-4" />ยืนยันและบันทึก</> : <>ถัดไป<ChevronRight className="h-4 w-4" /></>}</button></>}
    >
      {exitConfirmation ? <div className="space-y-3 text-sm text-slate-600"><p>ข้อมูลที่กรอกไว้ยังไม่ได้บันทึก</p><p>หากออกตอนนี้ ระบบจะยกเลิกข้อมูลร่างทั้งหมดและจะไม่มีการสร้างข้อมูลใด ๆ</p></div> : <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="space-y-5">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2 text-blue-600"><Layers3 className="h-5 w-5" /></div><div><h2 className="font-bold text-slate-950">{step}. {steps[step - 1]}</h2><p className="text-xs text-slate-500">ข้อมูลจะถูกบันทึกพร้อมกันเมื่อยืนยันในขั้นตอนสุดท้าย</p></div></div>

        {step === 1 && <div className="space-y-4">{modeSelector('คณะ', draft.faculty.mode, changeFacultyMode)}{draft.faculty.mode === 'existing' ? <label className="block space-y-1 text-xs font-semibold text-slate-700"><span>คณะ</span><select value={draft.faculty.existingId} onChange={(event) => changeFaculty(event.target.value)} className={inputClass}><option value="">เลือกคณะ</option>{academicState.faculties.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>)}</select></label> : newRecordFields('faculty', 'คณะ')}</div>}

        {step === 2 && <div className="space-y-4">{modeSelector('ภาควิชา', draft.department.mode, changeDepartmentMode, draft.faculty.mode === 'new')}{draft.department.mode === 'existing' ? <label className="block space-y-1 text-xs font-semibold text-slate-700"><span>ภาควิชา</span><select value={draft.department.existingId} onChange={(event) => changeDepartment(event.target.value)} className={inputClass}><option value="">เลือกภาควิชาในคณะที่เลือก</option>{departments.map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>)}</select></label> : newRecordFields('department', 'ภาควิชา')}</div>}

        {step === 3 && <div className="space-y-4">{modeSelector('สาขาวิชา', draft.major.mode, changeMajorMode, draft.department.mode === 'new')}{draft.major.mode === 'existing' ? <label className="block space-y-1 text-xs font-semibold text-slate-700"><span>สาขาวิชา</span><select value={draft.major.existingId} onChange={(event) => updateChoice('major', { existingId: event.target.value })} className={inputClass}><option value="">เลือกสาขาวิชาในภาควิชาที่เลือก</option>{majors.map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>)}</select></label> : newRecordFields('major', 'สาขาวิชา')}</div>}

        {step === 4 && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-xs font-semibold text-slate-700"><span>ปีที่เข้าศึกษา</span><select value={draft.admissionYear || ''} onChange={(event) => setDraft((current) => ({ ...current, admissionYear: Number(event.target.value) || undefined }))} className={inputClass}><option value="">เลือกปีที่เข้าศึกษา</option>{getAdmissionYearOptions().map((year) => <option key={year} value={year}>{getAdmissionCode(year)}</option>)}</select><span className="block font-normal text-slate-500">ระบบจัดเก็บเป็นปีเต็ม เช่น 67 = 2567</span></label><label className="space-y-1 text-xs font-semibold text-slate-700"><span>จำนวนกลุ่มเรียน</span><input type="number" min="1" max="20" value={draft.groupCount || ''} onChange={(event) => setDraft((current) => ({ ...current, groupCount: Number(event.target.value) }))} className={inputClass} /><span className="block font-normal text-slate-500">เพิ่มได้ครั้งละ 1–20 กลุ่ม</span></label></div>{!preview.error && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><h3 className="text-sm font-bold text-blue-950">ตัวอย่างกลุ่มเรียนใหม่</h3><p className="mt-1 text-xs text-blue-700">ระบบจะต่อรหัสจากลำดับล่าสุด รวมกลุ่มที่ปิดใช้งานหรือเคยใช้งานแล้ว</p><ul className="mt-3 grid gap-2 sm:grid-cols-2">{preview.groupCodes.map((code) => <li key={code} className="rounded-lg border border-blue-200 bg-white px-3 py-2 font-mono text-sm font-semibold text-blue-800">{code}</li>)}</ul></div>}</div>}

        {step === 5 && <div className="space-y-4">{reviewRow('คณะ', validation.faculty)}{reviewRow('ภาควิชา', validation.department)}{reviewRow('สาขาวิชา', validation.major)}<div className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-slate-500">ปีที่เข้าศึกษา</p><p className="font-bold">{validation.admissionYear ? getAdmissionCode(validation.admissionYear) : '—'}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">สร้าง {validation.groupCodes.length} กลุ่ม</span></div><ul className="mt-3 grid gap-2 sm:grid-cols-2">{validation.groupCodes.map((code) => <li key={code} className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm font-semibold">{code}</li>)}</ul></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" /><span><strong>ยืนยันข้อมูลก่อนบันทึก</strong><br /><span className="text-xs text-blue-700">ระบบจะสร้างเฉพาะรายการที่ระบุว่า “สร้างใหม่” และกลุ่มเรียนตามรายการด้านบนพร้อมกัน</span></span></label></div>}

        {(validation.error || submitError) && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">{submitError || validation.error}</p>}
      </form>}
    </Modal>
  );
};
