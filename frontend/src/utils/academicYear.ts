import { useSyncExternalStore } from 'react';

export const initialAcademicYear = 2569;
let currentAcademicYear = initialAcademicYear;
const listeners = new Set<() => void>();

// Academic years are a system setting, never the workstation's calendar year.
export const academicSettings = {
  get currentAcademicYear() { return currentAcademicYear; },
  set currentAcademicYear(value: number) {
    if (!Number.isSafeInteger(value) || value < 2500) throw new Error('ปีการศึกษาไม่ถูกต้อง');
    if (value === currentAcademicYear) return;
    currentAcademicYear = value;
    listeners.forEach((listener) => listener());
  },
};

export const useAcademicYear = () => useSyncExternalStore(
  (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  () => academicSettings.currentAcademicYear,
);

export interface YearLevelCalculationResult {
  admissionYear: number;
  admissionYearShort: string;
  yearLevel: number;
  formattedYearLevel: string;
  isExtended: boolean;
  isValid: boolean;
  errorMessage?: string;
}

export const getAdmissionCode = (admissionYear: number): string =>
  Number.isSafeInteger(admissionYear) ? String(admissionYear).slice(-2) : '';

export const getAdmissionYearOptions = (academicYear = academicSettings.currentAcademicYear): number[] =>
  Array.from({ length: Math.max(0, academicYear - 2499) }, (_, index) => academicYear - index);

export function calculateYearLevelFromAdmissionYear(
  admissionYear: number,
  academicYear = academicSettings.currentAcademicYear,
): YearLevelCalculationResult {
  const level = academicYear - admissionYear + 1;
  const errorMessage = !Number.isSafeInteger(admissionYear) || admissionYear < 2500
    ? 'ปีการศึกษาที่เข้าไม่ถูกต้อง'
    : !Number.isSafeInteger(academicYear) || academicYear < 2500
      ? 'ปีการศึกษาปัจจุบันไม่ถูกต้อง'
      : level < 1
        ? 'ปีการศึกษาที่เข้ามากกว่าปีการศึกษาปัจจุบัน'
        : undefined;
  return {
    admissionYear,
    admissionYearShort: getAdmissionCode(admissionYear),
    yearLevel: errorMessage ? 0 : level,
    formattedYearLevel: errorMessage ? '' : `ชั้นปีที่ ${level}`,
    isExtended: !errorMessage && level > 4,
    isValid: !errorMessage,
    errorMessage,
  };
}

/** Student ID is only an input suggestion; admissionYear remains the persisted source of truth. */
export function inferAdmissionYearFromStudentId(studentId: string): number | null {
  const match = studentId?.trim().match(/^(\d{2})\d{8,}$/);
  if (!match) return null;
  const admissionYear = 2500 + Number(match[1]);
  return admissionYear <= academicSettings.currentAcademicYear ? admissionYear : null;
}

/** Compatibility wrapper for existing consumers that expect undefined. */
export function suggestAdmissionYearFromStudentId(studentId: string): number | undefined {
  return inferAdmissionYearFromStudentId(studentId) ?? undefined;
}

export function calculateStudentYearLevel(studentId: string, academicYear = academicSettings.currentAcademicYear): YearLevelCalculationResult | null {
  if (!studentId?.trim()) return null;
  const admissionYear = suggestAdmissionYearFromStudentId(studentId);
  if (!admissionYear) return {
    admissionYear: 0,
    admissionYearShort: '',
    yearLevel: 0,
    formattedYearLevel: '',
    isExtended: false,
    isValid: false,
    errorMessage: 'รูปแบบรหัสนักศึกษาไม่ถูกต้อง (ต้องขึ้นต้นด้วยเลขปี พ.ศ. 2 หลัก)',
  };
  return calculateYearLevelFromAdmissionYear(admissionYear, academicYear);
}

export const withCalculatedStudentYear = <T extends { studentCode: string; admissionYear?: number }>(student: T, year = academicSettings.currentAcademicYear) => {
  const calculated = student.admissionYear
    ? calculateYearLevelFromAdmissionYear(student.admissionYear, year)
    : calculateStudentYearLevel(student.studentCode, year);
  return { ...student, year: calculated?.yearLevel || 0, yearLevel: calculated?.yearLevel || 0 };
};

/** Canonical persistence keeps majorId + admissionYear and drops derived/legacy academic fields. */
export const withoutStudentYear = <T extends {
  year?: number;
  yearLevel?: number;
  yearLevelId?: string;
  faculty?: string;
  facultyId?: string;
  department?: string;
  departmentId?: string;
  program?: string;
  programCode?: string;
  programId?: string;
  classGroup?: string;
}>(student: T) => {
  const {
    year: _year,
    yearLevel: _yearLevel,
    yearLevelId: _yearLevelId,
    faculty: _faculty,
    facultyId: _facultyId,
    department: _department,
    departmentId: _departmentId,
    program: _program,
    programCode: _programCode,
    programId: _programId,
    classGroup: _classGroup,
    ...stored
  } = student;
  return stored;
};
