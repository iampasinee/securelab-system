import { academicStructure, findAcademicPathByGroup, legacyStudentAcademicAssignments, resolveAcademicGroupId } from '../data/academicStructure';
import { Student, Teacher } from '../types';
import { AcademicInput, AcademicRecord, AcademicState, AcademicTier } from '../types/academic';
import {
  academicSettings,
  calculateYearLevelFromAdmissionYear,
  suggestAdmissionYearFromStudentId,
  withCalculatedStudentYear,
} from '../utils/academicYear';

export const academicLabels: Record<AcademicTier, string> = {
  faculties: 'คณะ',
  departments: 'ภาควิชา',
  majors: 'สาขาวิชา',
  classGroups: 'กลุ่มเรียน',
};

type LegacyAcademicState = {
  faculties?: Array<{ id: string; code?: string; name: string; status?: 'active' | 'inactive'; updatedAt?: string }>;
  departments?: Array<{ id: string; facultyId: string; code?: string; name: string; status?: 'active' | 'inactive'; updatedAt?: string }>;
  programs?: Array<{ id: string; departmentId: string; code: string; name: string; status?: 'active' | 'inactive'; updatedAt?: string }>;
  majors?: AcademicState['majors'];
  yearLevels?: Array<{ id: string; programId: string; level: number; admissionYear?: number }>;
  classGroups?: Array<{
    id: string;
    programId?: string;
    majorId?: string;
    yearLevelId?: string;
    admissionYear?: number;
    sequence?: number;
    code?: string;
    name?: string;
    status?: 'active' | 'inactive';
    updatedAt?: string;
  }>;
  classGroupSequenceCounters?: Record<string, number>;
};

const stamp = '2026-09-17T00:00:00.000Z';
const statusOf = (status?: string) => status === 'inactive' ? 'inactive' as const : 'active' as const;
const classGroupCounterKey = (majorId: string, admissionYear: number) => `${majorId}:${admissionYear}`;

const sequenceToLetters = (sequence: number) => {
  let value = sequence;
  let letters = '';
  while (value > 0) {
    value -= 1;
    letters = String.fromCharCode(65 + (value % 26)) + letters;
    value = Math.floor(value / 26);
  }
  return letters;
};

const classGroupSequenceFromCode = (code?: string) => {
  const match = code?.trim().toUpperCase().match(/^R([A-Z]+)$|^.+-R([A-Z]+)$/);
  const letters = match?.[1] || match?.[2];
  if (!letters) return undefined;
  return [...letters].reduce((sequence, letter) => sequence * 26 + letter.charCodeAt(0) - 64, 0);
};

const classGroupPrefixFromCode = (code?: string) => code?.trim().toUpperCase().match(/^(.+)-R[A-Z]+$/)?.[1];

export const createInitialAcademicState = (): AcademicState => {
  const faculties: AcademicState['faculties'] = [];
  const departments: AcademicState['departments'] = [];
  const majors: AcademicState['majors'] = [];
  const classGroups: AcademicState['classGroups'] = [];
  const classGroupSequenceCounters: AcademicState['classGroupSequenceCounters'] = {};
  academicStructure.forEach((faculty, facultyIndex) => {
    faculties.push({
      id: faculty.id,
      code: `FAC${String(facultyIndex + 1).padStart(2, '0')}`,
      name: faculty.name,
      status: statusOf(faculty.status),
      updatedAt: stamp,
    });
    faculty.departments.forEach((department, departmentIndex) => {
      departments.push({
        id: department.id,
        facultyId: faculty.id,
        code: department.code || `DEP${String(departmentIndex + 1).padStart(2, '0')}`,
        name: department.nameTh,
        status: statusOf(department.status),
        updatedAt: stamp,
      });
      department.programs.forEach((program) => {
        majors.push({
          id: program.id,
          departmentId: department.id,
          code: program.code,
          name: program.nameTh,
          status: statusOf(program.status),
          updatedAt: stamp,
        });
        program.classGroups.forEach((group) => {
          const code = group.code.trim().toUpperCase();
          const admissionYear = academicSettings.currentAcademicYear - group.yearLevel + 1;
          const sequence = classGroupSequenceFromCode(code) || classGroups.filter((item) => item.majorId === program.id && item.admissionYear === admissionYear).length + 1;
          classGroups.push({
            id: group.id,
            majorId: program.id,
            admissionYear,
            sequence,
            code,
            name: `กลุ่ม ${code.split('-').at(-1) || code}`,
            status: statusOf(group.status),
            updatedAt: stamp,
          });
          const counterKey = classGroupCounterKey(program.id, admissionYear);
          classGroupSequenceCounters[counterKey] = Math.max(classGroupSequenceCounters[counterKey] || 0, sequence);
        });
      });
    });
  });
  return { faculties, departments, majors, classGroups, classGroupSequenceCounters };
};

/** One-way migration from Faculty → Department → Program → Year → Group. */
export const migrateAcademicState = (raw: unknown): AcademicState => {
  const legacy = (raw && typeof raw === 'object' ? raw : {}) as LegacyAcademicState;
  const seed = createInitialAcademicState();
  const faculties = Array.isArray(legacy.faculties) && legacy.faculties.length
    ? legacy.faculties.map((record, index) => ({
      id: record.id,
      code: record.code?.trim().toUpperCase() || `FAC${String(index + 1).padStart(2, '0')}`,
      name: record.name,
      status: statusOf(record.status),
      updatedAt: record.updatedAt || stamp,
    }))
    : seed.faculties;
  const departments = Array.isArray(legacy.departments) && legacy.departments.length
    ? legacy.departments.map((record, index) => ({
      id: record.id,
      facultyId: record.facultyId,
      code: record.code?.trim().toUpperCase() || `DEP${String(index + 1).padStart(2, '0')}`,
      name: record.name,
      status: statusOf(record.status),
      updatedAt: record.updatedAt || stamp,
    })).filter((record) => faculties.some((faculty) => faculty.id === record.facultyId))
    : seed.departments;
  const sourceMajors = Array.isArray(legacy.majors) && legacy.majors.length
    ? legacy.majors
    : Array.isArray(legacy.programs) ? legacy.programs : [];
  const majors = sourceMajors.length
    ? sourceMajors.map((record) => ({
      id: record.id,
      departmentId: record.departmentId,
      code: record.code.trim().toUpperCase(),
      name: record.name,
      status: statusOf(record.status),
      updatedAt: record.updatedAt || stamp,
    })).filter((record) => departments.some((department) => department.id === record.departmentId))
    : seed.majors;
  const hasStoredGroups = Array.isArray(legacy.classGroups);
  const sourceGroups = hasStoredGroups ? legacy.classGroups! : [];
  const classGroups = hasStoredGroups
    ? sourceGroups.map((record, recordIndex) => {
      const staticPath = findAcademicPathByGroup(record.id);
      const storedYear = legacy.yearLevels?.find((year) => year.id === record.yearLevelId);
      const majorId = record.majorId || record.programId || staticPath?.program.id || '';
      const admissionYear = record.admissionYear ?? storedYear?.admissionYear ??
        (storedYear?.level ? academicSettings.currentAcademicYear - storedYear.level + 1 : undefined) ??
        (staticPath?.group.yearLevel ? academicSettings.currentAcademicYear - staticPath.group.yearLevel + 1 : 0);
      const sourceCode = (record.code || staticPath?.group.code || '').trim().toUpperCase();
      const sequence = record.sequence || classGroupSequenceFromCode(sourceCode) || classGroupSequenceFromCode(staticPath?.group.code) ||
        sourceGroups.slice(0, recordIndex).filter((item) => (item.majorId || item.programId) === majorId &&
          (item.admissionYear ?? legacy.yearLevels?.find((year) => year.id === item.yearLevelId)?.admissionYear) === admissionYear).length + 1;
      const prefix = classGroupPrefixFromCode(sourceCode) || classGroupPrefixFromCode(staticPath?.group.code) ||
        sourceGroups.map((item) => item.majorId === majorId || item.programId === majorId ? classGroupPrefixFromCode(item.code) : undefined).find(Boolean) ||
        seed.classGroups.find((group) => group.majorId === majorId && classGroupPrefixFromCode(group.code))?.code.replace(/-R[A-Z]+$/, '') ||
        majors.find((major) => major.id === majorId)?.code || '';
      const code = classGroupSequenceFromCode(sourceCode) || classGroupSequenceFromCode(staticPath?.group.code)
        ? `${prefix}-R${sequenceToLetters(sequence)}`
        : sourceCode;
      return {
        id: resolveAcademicGroupId(record.id) || record.id,
        majorId,
        admissionYear,
        sequence,
        code,
        name: record.name?.trim() || (code ? `กลุ่ม ${code}` : ''),
        status: statusOf(record.status),
        updatedAt: record.updatedAt || stamp,
      };
    }).filter((record) => record.code && Number.isSafeInteger(record.admissionYear) && majors.some((major) => major.id === record.majorId))
    : seed.classGroups;
  const classGroupSequenceCounters = {
    ...(hasStoredGroups ? {} : seed.classGroupSequenceCounters),
    ...(legacy.classGroupSequenceCounters || {}),
  };
  classGroups.forEach((group) => {
    const key = classGroupCounterKey(group.majorId, group.admissionYear);
    classGroupSequenceCounters[key] = Math.max(classGroupSequenceCounters[key] || 0, group.sequence);
  });
  return { faculties, departments, majors, classGroups, classGroupSequenceCounters };
};

export const academicPath = (state: AcademicState, tier: AcademicTier, id: string) => {
  const classGroup = state.classGroups.find((item) => item.id === (tier === 'classGroups' ? id : undefined));
  const major = state.majors.find((item) => item.id === (tier === 'majors' ? id : classGroup?.majorId));
  const department = state.departments.find((item) => item.id === (tier === 'departments' ? id : major?.departmentId));
  const faculty = state.faculties.find((item) => item.id === (tier === 'faculties' ? id : department?.facultyId));
  return { faculty, department, major, classGroup };
};

export const isAcademicPathActive = (state: AcademicState, tier: AcademicTier, id: string): boolean => {
  const path = academicPath(state, tier, id);
  const required = tier === 'faculties'
    ? [path.faculty]
    : tier === 'departments'
      ? [path.faculty, path.department]
      : tier === 'majors'
        ? [path.faculty, path.department, path.major]
        : [path.faculty, path.department, path.major, path.classGroup];
  return required.every((record) => record?.status === 'active');
};

export interface AcademicCohort {
  majorId: string;
  admissionYear: number;
}

export const legacyGroupToCohort = (
  groupId: string | undefined,
  state: AcademicState,
  rawAcademic?: unknown,
): AcademicCohort | undefined => {
  const resolvedId = resolveAcademicGroupId(groupId);
  if (!resolvedId) return undefined;
  const canonical = state.classGroups.find((group) => group.id === resolvedId);
  if (canonical) return { majorId: canonical.majorId, admissionYear: canonical.admissionYear };
  const legacy = (rawAcademic && typeof rawAcademic === 'object' ? rawAcademic : {}) as LegacyAcademicState;
  const storedGroup = legacy.classGroups?.find((group) => resolveAcademicGroupId(group.id) === resolvedId);
  const storedYear = legacy.yearLevels?.find((year) => year.id === storedGroup?.yearLevelId);
  const staticPath = findAcademicPathByGroup(resolvedId);
  const majorId = storedGroup?.programId || staticPath?.program.id;
  const admissionYear = storedGroup?.admissionYear ?? storedYear?.admissionYear ??
    (storedYear?.level ? academicSettings.currentAcademicYear - storedYear.level + 1 : undefined) ??
    (staticPath?.group.yearLevel ? academicSettings.currentAcademicYear - staticPath.group.yearLevel + 1 : undefined);
  if (!majorId || !state.majors.some((major) => major.id === majorId) || !admissionYear) return undefined;
  return { majorId, admissionYear };
};

const resolveLegacyMajor = (state: AcademicState, student: Student, rawAcademic?: unknown) => {
  if (student.majorId && state.majors.some((major) => major.id === student.majorId)) return student.majorId;
  if (student.programId && state.majors.some((major) => major.id === student.programId)) return student.programId;
  const cohort = legacyGroupToCohort(
    student.classGroupId === undefined ? legacyStudentAcademicAssignments[student.id] : student.classGroupId,
    state,
    rawAcademic,
  );
  if (cohort) return cohort.majorId;
  const matches = state.majors.filter((major) =>
    major.code.toLowerCase() === student.programCode?.trim().toLowerCase() ||
    major.name.trim().toLowerCase() === student.program?.trim().toLowerCase());
  return matches.length === 1 ? matches[0].id : undefined;
};

export const migrateAcademicStudents = (
  students: Student[],
  state: AcademicState,
  rawAcademic?: unknown,
): Student[] => students.map((student) => {
  const cohort = legacyGroupToCohort(
    student.classGroupId === undefined ? legacyStudentAcademicAssignments[student.id] : student.classGroupId,
    state,
    rawAcademic,
  );
  const majorId = resolveLegacyMajor(state, student, rawAcademic);
  const admissionYear = student.admissionYear || cohort?.admissionYear || suggestAdmissionYearFromStudentId(student.studentCode);
  const candidateGroupId = resolveAcademicGroupId(
    student.classGroupId === undefined ? legacyStudentAcademicAssignments[student.id] : student.classGroupId,
  );
  const candidateGroup = state.classGroups.find((group) => group.id === candidateGroupId);
  const classGroupId = candidateGroup && candidateGroup.majorId === majorId && candidateGroup.admissionYear === admissionYear
    ? candidateGroup.id
    : undefined;
  const migrated = { ...student, majorId, admissionYear, classGroupId };
  return { ...migrated, ...studentAcademicFields(state, migrated) };
});

export const studentAcademicFields = (state: AcademicState, student: Student): Partial<Student> => {
  const major = state.majors.find((item) => item.id === student.majorId);
  const department = state.departments.find((item) => item.id === major?.departmentId);
  const faculty = state.faculties.find((item) => item.id === department?.facultyId);
  const classGroup = state.classGroups.find((item) => item.id === student.classGroupId && item.majorId === major?.id && item.admissionYear === student.admissionYear);
  return {
    ...(faculty && { facultyId: faculty.id, faculty: faculty.name }),
    ...(department && { departmentId: department.id, department: department.name }),
    ...(major && {
      majorId: major.id,
      programId: major.id,
      programCode: major.code,
      program: major.name,
    }),
    classGroupId: classGroup?.id,
    classGroup: classGroup?.code,
    ...withCalculatedStudentYear(student),
  };
};

const normalizedAcademicLabel = (value?: string) => value?.trim().toLocaleLowerCase('th-TH') || '';

const facultyAliases = (id: string, state: AcademicState) => {
  const canonical = state.faculties.find((item) => item.id === id);
  const legacy = academicStructure.find((item) => item.id === id);
  return [canonical?.id, canonical?.code, canonical?.name, legacy?.name]
    .map(normalizedAcademicLabel)
    .filter(Boolean);
};

const departmentAliases = (id: string, state: AcademicState) => {
  const canonical = state.departments.find((item) => item.id === id);
  const legacy = academicStructure.flatMap((faculty) => faculty.departments).find((item) => item.id === id);
  return [canonical?.id, canonical?.code, canonical?.name, legacy?.code, legacy?.nameTh, legacy?.nameEn]
    .map(normalizedAcademicLabel)
    .filter(Boolean);
};

/** Resolves stable Teacher affiliation IDs without guessing ambiguous legacy labels. */
export const teacherAcademicFields = (
  state: AcademicState,
  teacher: Pick<Teacher, 'facultyId' | 'departmentId' | 'faculty' | 'department'>,
): Partial<Teacher> => {
  const storedDepartment = state.departments.find((item) => item.id === teacher.departmentId);
  const storedFaculty = state.faculties.find((item) => item.id === storedDepartment?.facultyId);
  if (storedDepartment && storedFaculty) {
    return {
      facultyId: storedFaculty.id,
      departmentId: storedDepartment.id,
      faculty: storedFaculty.name,
      department: storedDepartment.name,
    };
  }

  const facultyLabel = normalizedAcademicLabel(teacher.faculty);
  const departmentLabel = normalizedAcademicLabel(teacher.department);
  const facultyMatches = facultyLabel
    ? state.faculties.filter((item) => facultyAliases(item.id, state).includes(facultyLabel))
    : [];
  const departmentMatches = departmentLabel
    ? state.departments.filter((item) =>
      departmentAliases(item.id, state).includes(departmentLabel) &&
      (!facultyMatches.length || facultyMatches.some((faculty) => faculty.id === item.facultyId)))
    : [];
  if (departmentMatches.length === 1) {
    const department = departmentMatches[0];
    const faculty = state.faculties.find((item) => item.id === department.facultyId);
    if (faculty) return {
      facultyId: faculty.id,
      departmentId: department.id,
      faculty: faculty.name,
      department: department.name,
    };
  }
  if (facultyMatches.length === 1) {
    return { facultyId: facultyMatches[0].id, faculty: facultyMatches[0].name };
  }
  return {};
};

export const migrateAcademicTeachers = (
  teachers: Teacher[],
  state: AcademicState,
): Teacher[] => teachers.map((teacher) => ({
  ...teacher,
  ...teacherAcademicFields(state, teacher),
}));

export const validateTeacherAffiliation = (
  state: AcademicState,
  teacher: Pick<Teacher, 'facultyId' | 'departmentId'>,
  existing?: Pick<Teacher, 'facultyId' | 'departmentId'>,
): string | undefined => {
  const faculty = state.faculties.find((item) => item.id === teacher.facultyId);
  if (!faculty) return 'กรุณาเลือกคณะ';
  const department = state.departments.find((item) => item.id === teacher.departmentId);
  if (!department) return 'กรุณาเลือกภาควิชา';
  if (department.facultyId !== faculty.id) return 'ภาควิชาที่เลือกไม่ได้อยู่ในคณะที่เลือก';
  const unchanged = existing?.facultyId === faculty.id && existing.departmentId === department.id;
  if (!unchanged && !isAcademicPathActive(state, 'departments', department.id)) {
    return 'คณะหรือภาควิชาที่เลือกถูกปิดใช้งาน';
  }
};

export const studentsInAcademicRecord = (
  state: AcademicState,
  students: Student[],
  tier: AcademicTier,
  id: string,
) => students.filter((student) => {
  const path = student.majorId ? academicPath(state, 'majors', student.majorId) : undefined;
  if (tier === 'faculties') return path?.faculty?.id === id;
  if (tier === 'departments') return path?.department?.id === id;
  if (tier === 'majors') return student.majorId === id;
  return student.classGroupId === id;
});

export const academicDeleteError = (
  state: AcademicState,
  students: Student[],
  tier: AcademicTier,
  id: string,
): string | undefined => {
  const hasChildren = tier === 'faculties'
    ? state.departments.some((department) => department.facultyId === id)
    : tier === 'departments'
      ? state.majors.some((major) => major.departmentId === id)
      : tier === 'majors'
        ? state.classGroups.some((group) => group.majorId === id)
        : false;
  if (hasChildren) return `ไม่สามารถลบ${academicLabels[tier]}นี้ได้ เนื่องจากยังมีข้อมูลภายใต้รายการนี้`;
  if (studentsInAcademicRecord(state, students, tier, id).length) {
    return `ไม่สามารถลบ${academicLabels[tier]}นี้ได้ เนื่องจากยังมีนักศึกษาอ้างอิงอยู่`;
  }
};

const classGroupPrefix = (state: AcademicState, majorId: string) => {
  const existingPrefix = state.classGroups
    .filter((group) => group.majorId === majorId)
    .map((group) => classGroupPrefixFromCode(group.code))
    .find(Boolean);
  return existingPrefix || state.majors.find((major) => major.id === majorId)?.code || '';
};

export const nextClassGroupSequence = (state: AcademicState, majorId: string, admissionYear: number) => {
  const key = classGroupCounterKey(majorId, admissionYear);
  const highestRecord = state.classGroups
    .filter((group) => group.majorId === majorId && group.admissionYear === admissionYear)
    .reduce((highest, group) => Math.max(highest, group.sequence || classGroupSequenceFromCode(group.code) || 0), 0);
  return Math.max(state.classGroupSequenceCounters[key] || 0, highestRecord) + 1;
};

export const generatedClassGroupCode = (
  state: AcademicState,
  majorId?: string,
  admissionYear?: number,
  id?: string,
) => {
  if (!majorId || !admissionYear) return '';
  const existing = id ? state.classGroups.find((group) => group.id === id) : undefined;
  if (existing && existing.majorId === majorId && existing.admissionYear === admissionYear) return existing.code;
  const prefix = classGroupPrefix(state, majorId);
  return prefix ? `${prefix}-R${sequenceToLetters(nextClassGroupSequence(state, majorId, admissionYear))}` : '';
};

export const normalizeAcademicInput = (input: AcademicInput): AcademicInput => ({
  ...input,
  name: input.name.trim(),
  code: input.code.trim().toUpperCase(),
});

export const validateAcademicInput = (
  state: AcademicState,
  tier: AcademicTier,
  input: AcademicInput,
  id?: string,
): string | undefined => {
  const existing = state[tier].find((record) => record.id === id);
  const effectiveCode = tier === 'classGroups'
    ? generatedClassGroupCode(state, input.majorId, input.admissionYear, id)
    : input.code;
  if (id && !existing) return 'ไม่พบข้อมูลที่ต้องการแก้ไข';
  if ((tier !== 'classGroups' && !input.name) || input.name.length > 150) return tier === 'classGroups' ? 'ชื่อกลุ่มต้องไม่เกิน 150 ตัวอักษร' : 'กรุณากรอกชื่อ 1–150 ตัวอักษร';
  if (tier !== 'classGroups' && !/^[A-Z0-9-]{1,30}$/.test(effectiveCode)) return 'รหัสต้องเป็นอักษรอังกฤษ ตัวเลข หรือขีดกลาง ไม่เกิน 30 ตัวอักษร';
  if (input.status !== 'active' && input.status !== 'inactive') return 'สถานะไม่ถูกต้อง';
  if (tier === 'departments' && !state.faculties.some((faculty) => faculty.id === input.facultyId)) return 'กรุณาเลือกคณะ';
  if (tier === 'majors' && !state.departments.some((department) => department.id === input.departmentId)) return 'กรุณาเลือกภาควิชา';
  if (tier === 'classGroups') {
    if (!input.majorId || !state.majors.some((major) => major.id === input.majorId)) return 'กรุณาเลือกสาขาวิชา';
    if (!Number.isSafeInteger(input.admissionYear) || !input.admissionYear || input.admissionYear < 2500 || input.admissionYear > academicSettings.currentAcademicYear) return 'กรุณาเลือกปีที่เข้าศึกษาที่ถูกต้อง';
    if (!/^[A-Z0-9-]{1,30}$/.test(effectiveCode)) return 'ไม่สามารถสร้างรหัสกลุ่มได้ กรุณาตรวจสอบสาขาวิชาและปีที่เข้าศึกษา';
  }
  if (tier === 'departments' && (!existing || !('facultyId' in existing) || existing.facultyId !== input.facultyId) &&
    !isAcademicPathActive(state, 'faculties', input.facultyId)) return 'คณะที่เลือกถูกปิดใช้งาน';
  if (tier === 'majors' && (!existing || !('departmentId' in existing) || existing.departmentId !== input.departmentId) &&
    !isAcademicPathActive(state, 'departments', input.departmentId)) return 'ภาควิชาที่เลือกถูกปิดใช้งาน';
  if (tier === 'classGroups' && (!existing || !('majorId' in existing) || existing.majorId !== input.majorId) &&
    !isAcademicPathActive(state, 'majors', input.majorId!)) return 'สาขาวิชาที่เลือกถูกปิดใช้งาน';
  const duplicate = tier === 'faculties'
    ? state.faculties.some((record) => record.id !== id && (record.code === input.code || record.name.toLowerCase() === input.name.toLowerCase()))
    : tier === 'departments'
      ? state.departments.some((record) => record.id !== id && record.facultyId === input.facultyId && (record.code === input.code || record.name.toLowerCase() === input.name.toLowerCase()))
      : tier === 'majors'
        ? state.majors.some((record) => record.id !== id && record.departmentId === input.departmentId && (record.code === input.code || record.name.toLowerCase() === input.name.toLowerCase()))
        : state.classGroups.some((record) => record.id !== id && record.majorId === input.majorId && record.admissionYear === input.admissionYear && record.code === effectiveCode);
  if (duplicate) return `มี${academicLabels[tier]}นี้อยู่แล้ว กรุณาใช้ชื่อหรือรหัสอื่น`;
};

export const saveAcademicState = (
  state: AcademicState,
  tier: AcademicTier,
  input: AcademicInput,
  id?: string,
): AcademicState => {
  const existingGroup = tier === 'classGroups' && id ? state.classGroups.find((group) => group.id === id) : undefined;
  const retainedGroupIdentity = existingGroup && existingGroup.majorId === input.majorId && existingGroup.admissionYear === input.admissionYear;
  const groupSequence = tier === 'classGroups'
    ? retainedGroupIdentity ? existingGroup.sequence : nextClassGroupSequence(state, input.majorId!, input.admissionYear!)
    : undefined;
  const groupCode = tier === 'classGroups'
    ? retainedGroupIdentity ? existingGroup.code : generatedClassGroupCode(state, input.majorId, input.admissionYear, id)
    : input.code;
  const common = {
    id: id || crypto.randomUUID(),
    code: groupCode,
    name: input.name,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  const record: AcademicRecord = tier === 'faculties'
    ? common
    : tier === 'departments'
      ? { ...common, facultyId: input.facultyId }
      : tier === 'majors'
      ? { ...common, departmentId: input.departmentId }
        : { ...common, majorId: input.majorId!, admissionYear: input.admissionYear!, sequence: groupSequence! };
  const next = {
    ...state,
    [tier]: id
      ? state[tier].map((item) => item.id === id ? record : item)
      : [...state[tier], record],
  } as AcademicState;
  if (tier === 'classGroups') {
    const key = classGroupCounterKey(input.majorId!, input.admissionYear!);
    next.classGroupSequenceCounters = {
      ...state.classGroupSequenceCounters,
      [key]: Math.max(state.classGroupSequenceCounters[key] || 0, groupSequence!),
    };
  }
  return next;
};

export const deriveStudentYearLevel = (student: Student, currentAcademicYear = academicSettings.currentAcademicYear) =>
  student.admissionYear
    ? calculateYearLevelFromAdmissionYear(student.admissionYear, currentAcademicYear)
    : undefined;

export const classGroupsForCohort = (
  state: AcademicState,
  majorId?: string,
  admissionYear?: number,
  activeOnly = false,
) => state.classGroups.filter((group) =>
  (!majorId || group.majorId === majorId) &&
  (!admissionYear || group.admissionYear === admissionYear) &&
  (!activeOnly || isAcademicPathActive(state, 'classGroups', group.id)));

export const validateStudentClassGroup = (
  state: AcademicState,
  student: Pick<Student, 'majorId' | 'admissionYear' | 'classGroupId'>,
  requireActive = true,
): string | undefined => {
  if (!student.classGroupId) return undefined;
  const group = state.classGroups.find((item) => item.id === student.classGroupId);
  if (!group) return 'ไม่พบกลุ่มเรียนที่เลือก';
  if (group.majorId !== student.majorId || group.admissionYear !== student.admissionYear) return 'กลุ่มเรียนต้องตรงกับสาขาวิชาและปีที่เข้าศึกษาของนักศึกษา';
  if (requireActive && !isAcademicPathActive(state, 'classGroups', group.id)) return 'กลุ่มเรียนที่เลือกถูกปิดใช้งาน';
};
