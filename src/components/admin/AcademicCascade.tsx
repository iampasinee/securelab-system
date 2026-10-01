import React from 'react';
import { useApp } from '../../context/AppContext';
import { isAcademicPathActive } from '../../services/academicState';

export interface AcademicSelection {
  facultyId: string;
  departmentId: string;
  majorId: string;
}

export const emptyAcademicSelection: AcademicSelection = {
  facultyId: '',
  departmentId: '',
  majorId: '',
};

export const defaultAcademicSelection = (state: ReturnType<typeof useApp>['academicState']): AcademicSelection => {
  const faculty = state.faculties.find((item) => isAcademicPathActive(state, 'faculties', item.id));
  const department = state.departments.find((item) => item.facultyId === faculty?.id && isAcademicPathActive(state, 'departments', item.id));
  const major = state.majors.find((item) => item.departmentId === department?.id && isAcademicPathActive(state, 'majors', item.id));
  return { facultyId: faculty?.id || '', departmentId: department?.id || '', majorId: major?.id || '' };
};

interface AcademicCascadeProps {
  value: AcademicSelection;
  onChange: (value: AcademicSelection) => void;
  depth?: 1 | 2 | 3;
  activeOnly?: boolean;
  retained?: AcademicSelection;
  disabled?: boolean;
  required?: boolean;
}

const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:outline-blue-600';

export const AcademicCascade: React.FC<AcademicCascadeProps> = ({
  value,
  onChange,
  depth = 3,
  activeOnly = true,
  retained,
  disabled = false,
  required = false,
}) => {
  const { academicState } = useApp();
  const available = (tier: 'faculties' | 'departments' | 'majors', id: string) =>
    !activeOnly || isAcademicPathActive(academicState, tier, id) || retained?.[tier === 'faculties' ? 'facultyId' : tier === 'departments' ? 'departmentId' : 'majorId'] === id;
  const faculties = academicState.faculties.filter((item) => available('faculties', item.id));
  const departments = academicState.departments.filter((item) => item.facultyId === value.facultyId && available('departments', item.id));
  const majors = academicState.majors.filter((item) => item.departmentId === value.departmentId && available('majors', item.id));
  const gridClass = depth === 1
    ? 'grid gap-3'
    : depth === 2
      ? 'grid gap-3 md:grid-cols-2'
      : 'grid gap-3 md:grid-cols-3';

  return (
    <div className={gridClass}>
      <label className="space-y-1 text-xs font-semibold text-slate-700">
        <span>คณะ{required && <span className="ml-1 text-red-500">*</span>}</span>
        <select
          required={required}
          value={value.facultyId}
          disabled={disabled}
          onChange={(event) => onChange({ facultyId: event.target.value, departmentId: '', majorId: '' })}
          className={selectClass}
        >
          <option value="">เลือกคณะ</option>
          {faculties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {depth >= 2 && <label className="space-y-1 text-xs font-semibold text-slate-700">
        <span>ภาควิชา{required && <span className="ml-1 text-red-500">*</span>}</span>
        <select
          required={required}
          value={value.departmentId}
          disabled={disabled || !value.facultyId}
          onChange={(event) => onChange({ ...value, departmentId: event.target.value, majorId: '' })}
          className={selectClass}
        >
          <option value="">เลือกภาควิชา</option>
          {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      {depth >= 3 && <label className="space-y-1 text-xs font-semibold text-slate-700">
        <span>สาขาวิชา{required && <span className="ml-1 text-red-500">*</span>}</span>
        <select
          required={required}
          value={value.majorId}
          disabled={disabled || !value.departmentId}
          onChange={(event) => onChange({ ...value, majorId: event.target.value })}
          className={selectClass}
        >
          <option value="">เลือกสาขาวิชา</option>
          {majors.map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>)}
        </select>
      </label>}
    </div>
  );
};
