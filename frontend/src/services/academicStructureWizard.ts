import { AcademicInput, AcademicState, AcademicStatus } from '../types/academic';
import { academicSettings, calculateYearLevelFromAdmissionYear } from '../utils/academicYear';
import {
  isAcademicPathActive,
  normalizeAcademicInput,
  saveAcademicState,
  validateAcademicInput,
} from './academicState';

export type AcademicStructureChoiceMode = 'existing' | 'new';

export interface AcademicStructureChoice {
  mode: AcademicStructureChoiceMode;
  existingId: string;
  code: string;
  name: string;
  status: AcademicStatus;
}

export interface AcademicStructureWizardDraft {
  faculty: AcademicStructureChoice;
  department: AcademicStructureChoice;
  major: AcademicStructureChoice;
  admissionYear?: number;
  groupCount: number;
}

export interface AcademicStructureWizardRecord {
  id: string;
  code: string;
  name: string;
  status: AcademicStatus;
  mode: AcademicStructureChoiceMode;
}

export interface AcademicStructureTransactionResult {
  state?: AcademicState;
  error?: string;
  step?: 1 | 2 | 3 | 4 | 5;
  faculty?: AcademicStructureWizardRecord;
  department?: AcademicStructureWizardRecord;
  major?: AcademicStructureWizardRecord;
  admissionYear?: number;
  groupCodes: string[];
}

const emptyChoice = (): AcademicStructureChoice => ({
  mode: 'existing',
  existingId: '',
  code: '',
  name: '',
  status: 'active',
});

export const createAcademicStructureWizardDraft = (): AcademicStructureWizardDraft => ({
  faculty: emptyChoice(),
  department: emptyChoice(),
  major: emptyChoice(),
  admissionYear: academicSettings.currentAcademicYear,
  groupCount: 1,
});

const failure = (
  error: string,
  step: 1 | 2 | 3 | 4 | 5,
): AcademicStructureTransactionResult => ({ error, step, groupCodes: [] });

const newInput = (
  choice: AcademicStructureChoice,
  parents: Partial<Pick<AcademicInput, 'facultyId' | 'departmentId' | 'majorId' | 'admissionYear'>> = {},
): AcademicInput => normalizeAcademicInput({
  name: choice.name,
  code: choice.code,
  facultyId: parents.facultyId || '',
  departmentId: parents.departmentId || '',
  majorId: parents.majorId || '',
  admissionYear: parents.admissionYear,
  status: choice.status,
});

/**
 * Builds an isolated academic transaction. The source object is never mutated,
 * so the caller can validate every step before committing the returned state.
 */
export const buildAcademicStructureTransaction = (
  source: AcademicState,
  draft: AcademicStructureWizardDraft,
  throughStep: 1 | 2 | 3 | 4 | 5 = 5,
): AcademicStructureTransactionResult => {
  let state = source;
  let faculty: AcademicStructureWizardRecord;
  let department: AcademicStructureWizardRecord;
  let major: AcademicStructureWizardRecord;

  if (draft.faculty.mode === 'existing') {
    const record = state.faculties.find((item) => item.id === draft.faculty.existingId);
    if (!record || !isAcademicPathActive(state, 'faculties', record.id)) {
      return failure('กรุณาเลือกคณะที่เปิดใช้งาน', 1);
    }
    faculty = { ...record, mode: 'existing' };
  } else {
    const input = newInput(draft.faculty);
    const error = validateAcademicInput(state, 'faculties', input);
    if (error) return failure(error, 1);
    state = saveAcademicState(state, 'faculties', input);
    faculty = { ...state.faculties.at(-1)!, mode: 'new' };
  }
  if (throughStep === 1) return { state, faculty, groupCodes: [] };

  if (draft.department.mode === 'existing') {
    const record = state.departments.find((item) => item.id === draft.department.existingId);
    if (!record || record.facultyId !== faculty.id || !isAcademicPathActive(state, 'departments', record.id)) {
      return failure('กรุณาเลือกภาควิชาที่เปิดใช้งานและอยู่ในคณะที่เลือก', 2);
    }
    department = { ...record, mode: 'existing' };
  } else {
    const input = newInput(draft.department, { facultyId: faculty.id });
    const error = validateAcademicInput(state, 'departments', input);
    if (error) return failure(error, 2);
    state = saveAcademicState(state, 'departments', input);
    department = { ...state.departments.at(-1)!, mode: 'new' };
  }
  if (throughStep === 2) return { state, faculty, department, groupCodes: [] };

  if (draft.major.mode === 'existing') {
    const record = state.majors.find((item) => item.id === draft.major.existingId);
    if (!record || record.departmentId !== department.id || !isAcademicPathActive(state, 'majors', record.id)) {
      return failure('กรุณาเลือกสาขาวิชาที่เปิดใช้งานและอยู่ในภาควิชาที่เลือก', 3);
    }
    major = { ...record, mode: 'existing' };
  } else {
    const input = newInput(draft.major, { departmentId: department.id });
    const error = validateAcademicInput(state, 'majors', input);
    if (error) return failure(error, 3);
    state = saveAcademicState(state, 'majors', input);
    major = { ...state.majors.at(-1)!, mode: 'new' };
  }
  if (throughStep === 3) return { state, faculty, department, major, groupCodes: [] };

  const yearResult = draft.admissionYear
    ? calculateYearLevelFromAdmissionYear(draft.admissionYear, academicSettings.currentAcademicYear)
    : undefined;
  if (!yearResult?.isValid) return failure('กรุณาเลือกปีที่เข้าศึกษาที่ถูกต้อง', 4);
  if (!Number.isSafeInteger(draft.groupCount) || draft.groupCount < 1 || draft.groupCount > 20) {
    return failure('จำนวนกลุ่มเรียนต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 20 กลุ่ม', 4);
  }

  const groupCodes: string[] = [];
  for (let index = 0; index < draft.groupCount; index += 1) {
    const input = newInput({
      mode: 'new',
      existingId: '',
      code: '',
      name: '',
      status: 'active',
    }, {
      majorId: major.id,
      admissionYear: draft.admissionYear,
    });
    const error = validateAcademicInput(state, 'classGroups', input);
    if (error) return failure(`กลุ่มเรียนลำดับที่ ${index + 1}: ${error}`, 4);
    state = saveAcademicState(state, 'classGroups', input);
    groupCodes.push(state.classGroups.at(-1)!.code);
  }

  return {
    state,
    faculty,
    department,
    major,
    admissionYear: draft.admissionYear,
    groupCodes,
  };
};
