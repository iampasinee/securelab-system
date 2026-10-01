import assert from 'node:assert/strict';
import test from 'node:test';
import { initialStudents } from '../data/initialData';
import {
  academicDeleteError,
  academicPath,
  classGroupsForCohort,
  createInitialAcademicState,
  generatedClassGroupCode,
  isAcademicPathActive,
  legacyGroupToCohort,
  migrateAcademicState,
  migrateAcademicStudents,
  migrateAcademicTeachers,
  normalizeAcademicInput,
  saveAcademicState,
  studentAcademicFields,
  studentsInAcademicRecord,
  validateAcademicInput,
  validateStudentClassGroup,
  validateTeacherAffiliation,
} from './academicState';
import {
  academicSettings,
  calculateYearLevelFromAdmissionYear,
  getAdmissionCode,
  inferAdmissionYearFromStudentId,
  suggestAdmissionYearFromStudentId,
  withCalculatedStudentYear,
} from '../utils/academicYear';
import {
  buildAcademicStructureTransaction,
  createAcademicStructureWizardDraft,
} from './academicStructureWizard';

const activeInput = {
  name: 'สาขาวิชาทดสอบ',
  code: 'TEST',
  facultyId: 'faculty-001',
  departmentId: 'department_it',
  status: 'active' as const,
};

test('canonical hierarchy remains Faculty → Department → Major with lightweight Class Groups', () => {
  const state = createInitialAcademicState();
  assert.ok(state.faculties.length > 0);
  assert.ok(state.departments.every((department) => state.faculties.some((faculty) => faculty.id === department.facultyId)));
  assert.ok(state.majors.every((major) => state.departments.some((department) => department.id === major.departmentId)));
  assert.equal('yearLevels' in state, false);
  assert.ok(state.classGroups.length > 0);
  assert.ok(state.classGroups.every((group) => state.majors.some((major) => major.id === group.majorId)));
  assert.ok(state.classGroups.every((group) => !('facultyId' in group) && !('departmentId' in group) && !('yearLevel' in group)));
});

test('legacy Program records migrate to canonical Major records without changing stable IDs', () => {
  const state = migrateAcademicState({
    faculties: [{ id: 'f1', name: 'คณะทดสอบ', status: 'active' }],
    departments: [{ id: 'd1', facultyId: 'f1', name: 'ภาควิชาทดสอบ', status: 'active' }],
    programs: [{ id: 'legacy-program', departmentId: 'd1', code: 'IT', name: 'สาขาวิชาทดสอบ', status: 'active' }],
    yearLevels: [{ id: 'year-old', programId: 'legacy-program', level: 3 }],
    classGroups: [{ id: 'group-old', programId: 'legacy-program', yearLevelId: 'year-old', code: 'RA' }],
  });
  assert.equal(state.majors[0].id, 'legacy-program');
  assert.deepEqual(Object.keys(state).sort(), ['classGroupSequenceCounters', 'classGroups', 'departments', 'faculties', 'majors']);
  assert.deepEqual(state.classGroups.map(({ majorId, admissionYear, sequence, code }) => ({ majorId, admissionYear, sequence, code })), [
    { majorId: 'legacy-program', admissionYear: 2567, sequence: 1, code: 'IT-RA' },
  ]);
});

test('legacy group migration produces majorId + admissionYear before group data is discarded', () => {
  const state = createInitialAcademicState();
  const cohort = legacyGroupToCohort('group_003', state);
  assert.deepEqual(cohort, { majorId: 'program_inet', admissionYear: 2567 });
  const migrated = migrateAcademicStudents([{ ...initialStudents[0], majorId: undefined, admissionYear: undefined }], state);
  assert.equal(migrated[0].majorId, 'program_inet');
  assert.equal(migrated[0].admissionYear, 2567);
  assert.equal(migrated[0].classGroupId, 'group_inet_de_ra');
});

test('migration upgrades short Class Group codes and reconstructs sequence counters', () => {
  const initial = createInitialAcademicState();
  const migrated = migrateAcademicState({
    faculties: initial.faculties,
    departments: initial.departments,
    majors: initial.majors,
    classGroups: initial.classGroups.map(({ sequence: _sequence, ...group }) => ({
      ...group,
      code: group.code.split('-').at(-1),
    })),
  });
  assert.equal(migrated.classGroups.find((group) => group.id === 'group_inet_de_ra')?.code, 'INET-DE-RA');
  assert.equal(generatedClassGroupCode(migrated, 'program_inet', 2567), 'INET-DE-RC');
});

test('migration does not guess a Major when legacy evidence is ambiguous or absent', () => {
  const state = createInitialAcademicState();
  const legacy = {
    ...initialStudents[0],
    id: 'unmapped',
    studentCode: '6700000000',
    majorId: undefined,
    programId: undefined,
    program: undefined,
    programCode: undefined,
    classGroupId: '',
  };
  const migrated = migrateAcademicStudents([legacy], state)[0];
  assert.equal(migrated.majorId, undefined);
  assert.equal(migrated.admissionYear, 2567);
});

test('Faculty and Department are derived from selected Major', () => {
  const state = createInitialAcademicState();
  const student = { ...initialStudents[0], majorId: 'program_inet', admissionYear: 2567 };
  const fields = studentAcademicFields(state, student);
  const path = academicPath(state, 'majors', 'program_inet');
  assert.equal(fields.departmentId, path.department?.id);
  assert.equal(fields.facultyId, path.faculty?.id);
  assert.equal(fields.programCode, path.major?.code);
});

test('admission code and derived year use stored admissionYear and central academic year', () => {
  const previous = academicSettings.currentAcademicYear;
  try {
    academicSettings.currentAcademicYear = 2569;
    assert.equal(getAdmissionCode(2567), '67');
    assert.equal(calculateYearLevelFromAdmissionYear(2567).yearLevel, 3);
    assert.equal(withCalculatedStudentYear({ studentCode: '9900000000', admissionYear: 2567 }).yearLevel, 3);
    academicSettings.currentAcademicYear = 2570;
    assert.equal(calculateYearLevelFromAdmissionYear(2567).yearLevel, 4);
  } finally {
    academicSettings.currentAcademicYear = previous;
  }
});

test('future admission year is invalid and student ID only provides an editable suggestion', () => {
  assert.equal(calculateYearLevelFromAdmissionYear(2570, 2569).isValid, false);
  assert.equal(inferAdmissionYearFromStudentId('6706022510158'), 2567);
  assert.equal(inferAdmissionYearFromStudentId('6806022510158'), 2568);
  assert.equal(inferAdmissionYearFromStudentId('67'), null);
  assert.equal(inferAdmissionYearFromStudentId('INVALID'), null);
  assert.equal(suggestAdmissionYearFromStudentId('6706022510158'), 2567);
  assert.equal(suggestAdmissionYearFromStudentId('INVALID'), undefined);
});

test('stored admissionYear remains canonical when Student ID suggests another year', () => {
  const state = createInitialAcademicState();
  const stored = { ...initialStudents[0], id: 'stored-year', studentCode: '6806022510158', admissionYear: 2567, classGroupId: undefined };
  const migrated = migrateAcademicStudents([stored], state)[0];
  assert.equal(inferAdmissionYearFromStudentId(stored.studentCode), 2568);
  assert.equal(migrated.admissionYear, 2567);
});

test('cascading path activity rejects inactive ancestors', () => {
  const state = createInitialAcademicState();
  const inactive = {
    ...state,
    faculties: state.faculties.map((faculty) => faculty.id === 'faculty-001' ? { ...faculty, status: 'inactive' as const } : faculty),
  };
  assert.equal(isAcademicPathActive(inactive, 'departments', 'department_it'), false);
  assert.equal(isAcademicPathActive(inactive, 'majors', 'program_inet'), false);
});

test('academic CRUD enforces scoped uniqueness and stable parent IDs', () => {
  const state = createInitialAcademicState();
  const input = normalizeAcademicInput({ ...activeInput, code: ' test ' });
  assert.equal(validateAcademicInput(state, 'majors', input), undefined);
  const next = saveAcademicState(state, 'majors', input);
  const created = next.majors.at(-1)!;
  assert.equal(created.departmentId, 'department_it');
  assert.equal(created.code, 'TEST');
  assert.ok(validateAcademicInput(next, 'majors', input));
});

test('Class Group code generation issues RA, RB and RC per Major + admissionYear', () => {
  let state = createInitialAcademicState();
  const input = normalizeAcademicInput({
    name: 'กลุ่มทดสอบ',
    code: '',
    facultyId: '',
    departmentId: '',
    majorId: 'program_inet',
    admissionYear: 2568,
    status: 'active',
  });
  assert.equal(generatedClassGroupCode(state, input.majorId, input.admissionYear), 'INET-DE-RA');
  assert.equal(validateAcademicInput(state, 'classGroups', input), undefined);
  state = saveAcademicState(state, 'classGroups', input);
  assert.equal(generatedClassGroupCode(state, input.majorId, input.admissionYear), 'INET-DE-RB');
  state = saveAcademicState(state, 'classGroups', input);
  assert.equal(generatedClassGroupCode(state, input.majorId, input.admissionYear), 'INET-DE-RC');
  state = saveAcademicState(state, 'classGroups', input);
  assert.deepEqual(classGroupsForCohort(state, 'program_inet', 2568).map((group) => group.code), ['INET-DE-RA', 'INET-DE-RB', 'INET-DE-RC']);
});

test('Class Group sequence is not reused after inactive or deleted historical groups', () => {
  let state = createInitialAcademicState();
  const input = normalizeAcademicInput({ name: '', code: '', facultyId: '', departmentId: '', majorId: 'program_inet', admissionYear: 2568, status: 'active' });
  state = saveAcademicState(state, 'classGroups', input);
  state = saveAcademicState(state, 'classGroups', input);
  const second = classGroupsForCohort(state, 'program_inet', 2568)[1];
  state = {
    ...state,
    classGroups: state.classGroups.filter((group) => group.id !== second.id).map((group) => ({ ...group, status: 'inactive' as const })),
  };
  assert.equal(generatedClassGroupCode(state, 'program_inet', 2568), 'INET-DE-RC');
});

test('Class Group code uniqueness is scoped by admission year and duplicate persisted codes are rejected', () => {
  const state = createInitialAcademicState();
  const first2567 = state.classGroups.find((group) => group.majorId === 'program_inet' && group.admissionYear === 2567)!;
  const input2568 = normalizeAcademicInput({ name: '', code: '', facultyId: '', departmentId: '', majorId: 'program_inet', admissionYear: 2568, status: 'active' });
  const next = saveAcademicState(state, 'classGroups', input2568);
  const first2568 = next.classGroups.find((group) => group.majorId === 'program_inet' && group.admissionYear === 2568)!;
  assert.equal(first2567.code, first2568.code);
  const corrupted = { ...next, classGroups: [...next.classGroups, { ...first2568, id: 'duplicate-group' }] };
  assert.match(validateAcademicInput(corrupted, 'classGroups', input2568, first2568.id) || '', /มี.*กลุ่มเรียน/);
});

test('student Class Group assignment rejects Major and admission-year mismatches', () => {
  const state = createInitialAcademicState();
  const group = state.classGroups.find((item) => item.majorId === 'program_inet' && item.admissionYear === 2567)!;
  assert.equal(validateStudentClassGroup(state, { majorId: group.majorId, admissionYear: group.admissionYear, classGroupId: group.id }), undefined);
  assert.match(validateStudentClassGroup(state, { majorId: 'program_ine', admissionYear: group.admissionYear, classGroupId: group.id }) || '', /ตรงกับ/);
  assert.match(validateStudentClassGroup(state, { majorId: group.majorId, admissionYear: 2568, classGroupId: group.id }) || '', /ตรงกับ/);
});

test('student reassignment keeps exactly one primary Class Group', () => {
  const state = createInitialAcademicState();
  const groups = classGroupsForCohort(state, 'program_inet', 2567, true);
  assert.ok(groups.length >= 2);
  const student = { ...initialStudents[0], majorId: 'program_inet', admissionYear: 2567, classGroupId: groups[0].id };
  const reassigned = { ...student, classGroupId: groups[1].id };
  assert.equal(validateStudentClassGroup(state, reassigned), undefined);
  assert.equal(reassigned.classGroupId, groups[1].id);
  assert.equal(Array.isArray(reassigned.classGroupId), false);
});

test('inactive Class Groups cannot receive new students but remain readable', () => {
  const state = createInitialAcademicState();
  const group = state.classGroups.find((item) => item.majorId === 'program_inet' && item.admissionYear === 2567)!;
  const inactive = { ...state, classGroups: state.classGroups.map((item) => item.id === group.id ? { ...item, status: 'inactive' as const } : item) };
  const student = { majorId: group.majorId, admissionYear: group.admissionYear, classGroupId: group.id };
  assert.match(validateStudentClassGroup(inactive, student) || '', /ปิดใช้งาน/);
  assert.equal(validateStudentClassGroup(inactive, student, false), undefined);
});

test('deletion guards block parents with children and Majors referenced by students', () => {
  const state = createInitialAcademicState();
  const students = migrateAcademicStudents(initialStudents, state);
  assert.ok(academicDeleteError(state, students, 'faculties', 'faculty-001'));
  assert.ok(academicDeleteError(state, students, 'departments', 'department_it'));
  assert.ok(academicDeleteError(state, students, 'majors', 'program_inet'));
  assert.ok(studentsInAcademicRecord(state, students, 'majors', 'program_inet').length > 0);
  const assignedGroup = students.find((student) => student.classGroupId)?.classGroupId;
  assert.ok(assignedGroup);
  assert.ok(academicDeleteError(state, students, 'classGroups', assignedGroup!));
});

test('academic structure wizard creates a complete new hierarchy atomically', () => {
  const state = createInitialAcademicState();
  const draft = createAcademicStructureWizardDraft();
  draft.faculty = { mode: 'new', existingId: '', code: 'SCI', name: 'คณะวิทยาศาสตร์', status: 'active' };
  draft.department = { mode: 'new', existingId: '', code: 'CS', name: 'ภาควิชาวิทยาการคอมพิวเตอร์', status: 'active' };
  draft.major = { mode: 'new', existingId: '', code: 'CS-DE', name: 'สาขาวิชาวิทยาการคอมพิวเตอร์', status: 'active' };
  draft.admissionYear = 2569;
  draft.groupCount = 2;

  const result = buildAcademicStructureTransaction(state, draft);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.groupCodes, ['CS-DE-RA', 'CS-DE-RB']);
  assert.equal(result.state?.faculties.length, state.faculties.length + 1);
  assert.equal(result.state?.departments.at(-1)?.facultyId, result.faculty?.id);
  assert.equal(result.state?.majors.at(-1)?.departmentId, result.department?.id);
  assert.ok(result.state?.classGroups.slice(-2).every((group) => group.majorId === result.major?.id));
  assert.equal(state.faculties.some((faculty) => faculty.code === 'SCI'), false);
});

test('academic structure wizard supports existing parents mixed with new records', () => {
  const state = createInitialAcademicState();
  const faculty = state.faculties.find((item) => item.status === 'active')!;
  const draft = createAcademicStructureWizardDraft();
  draft.faculty.existingId = faculty.id;
  draft.department = { mode: 'new', existingId: '', code: 'NEW-DEPT', name: 'ภาควิชาใหม่', status: 'active' };
  draft.major = { mode: 'new', existingId: '', code: 'NEW-MAJOR', name: 'สาขาวิชาใหม่', status: 'active' };
  draft.admissionYear = 2569;
  draft.groupCount = 1;

  const result = buildAcademicStructureTransaction(state, draft);
  assert.equal(result.error, undefined);
  assert.equal(result.faculty?.mode, 'existing');
  assert.equal(result.department?.mode, 'new');
  assert.equal(result.major?.mode, 'new');
  assert.deepEqual(result.groupCodes, ['NEW-MAJOR-RA']);
});

test('academic structure wizard continues the persistent Class Group sequence', () => {
  const state = createInitialAcademicState();
  const major = state.majors.find((item) => item.id === 'program_inet')!;
  const department = state.departments.find((item) => item.id === major.departmentId)!;
  const draft = createAcademicStructureWizardDraft();
  draft.faculty.existingId = department.facultyId;
  draft.department.existingId = department.id;
  draft.major.existingId = major.id;
  draft.admissionYear = 2567;
  draft.groupCount = 2;

  const result = buildAcademicStructureTransaction(state, draft);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.groupCodes, ['INET-DE-RC', 'INET-DE-RD']);
});

test('academic structure wizard rejects duplicate records, invalid parents and group counts', () => {
  const state = createInitialAcademicState();
  const faculty = state.faculties.find((item) => item.status === 'active')!;
  const existingDepartment = state.departments.find((item) => item.facultyId === faculty.id)!;
  const duplicate = createAcademicStructureWizardDraft();
  duplicate.faculty.existingId = faculty.id;
  duplicate.department = { mode: 'new', existingId: '', code: existingDepartment.code, name: 'ชื่อใหม่', status: 'active' };
  assert.equal(buildAcademicStructureTransaction(state, duplicate, 2).step, 2);

  const invalidParent = createAcademicStructureWizardDraft();
  invalidParent.faculty.existingId = faculty.id;
  invalidParent.department.existingId = 'missing-department';
  assert.equal(buildAcademicStructureTransaction(state, invalidParent, 2).step, 2);

  const invalidCount = createAcademicStructureWizardDraft();
  invalidCount.faculty.existingId = faculty.id;
  invalidCount.department.existingId = existingDepartment.id;
  invalidCount.major.existingId = state.majors.find((item) => item.departmentId === existingDepartment.id)!.id;
  invalidCount.groupCount = 0;
  assert.match(buildAcademicStructureTransaction(state, invalidCount, 4).error || '', /1 ถึง 20/);
});

test('Teacher affiliation accepts a valid Faculty and Department pair', () => {
  const state = createInitialAcademicState();
  const department = state.departments.find((item) => item.id === 'department_it')!;
  assert.equal(validateTeacherAffiliation(state, {
    facultyId: department.facultyId,
    departmentId: department.id,
  }), undefined);
});

test('Teacher affiliation rejects a Department outside the selected Faculty', () => {
  const state = createInitialAcademicState();
  const extraFaculty = {
    id: 'faculty-other',
    code: 'OTHER',
    name: 'คณะอื่น',
    status: 'active' as const,
    updatedAt: new Date().toISOString(),
  };
  const extended = { ...state, faculties: [...state.faculties, extraFaculty] };
  assert.match(validateTeacherAffiliation(extended, {
    facultyId: extraFaculty.id,
    departmentId: 'department_it',
  }) || '', /ไม่ได้อยู่ในคณะ/);
});

test('inactive Teacher affiliation is blocked for new assignment but remains readable when unchanged', () => {
  const state = createInitialAcademicState();
  const inactive = {
    ...state,
    departments: state.departments.map((department) =>
      department.id === 'department_it' ? { ...department, status: 'inactive' as const } : department),
  };
  const affiliation = { facultyId: 'faculty-001', departmentId: 'department_it' };
  assert.match(validateTeacherAffiliation(inactive, affiliation) || '', /ปิดใช้งาน/);
  assert.equal(validateTeacherAffiliation(inactive, affiliation, affiliation), undefined);
});

test('legacy Teacher affiliation migrates only when an academic record is unambiguous', () => {
  const state = createInitialAcademicState();
  const migrated = migrateAcademicTeachers([{
    id: 'teacher-legacy-mapped',
    teacherCode: 'T9001',
    fullName: 'อาจารย์ทดสอบ',
    email: 'teacher@example.ac.th',
    faculty: 'คณะเทคโนโลยีและการจัดการอุตสาหกรรม',
    department: 'ภาควิชาวิทยาการคอมพิวเตอร์',
    role: 'teacher',
    icitProfileStatus: 'confirmed',
    accountStatus: 'active',
  }, {
    id: 'teacher-legacy-unmapped',
    teacherCode: 'T9002',
    fullName: 'อาจารย์ข้อมูลเดิม',
    email: 'legacy@example.ac.th',
    faculty: 'Unknown Faculty',
    department: 'Unknown Department',
    role: 'teacher',
    icitProfileStatus: 'pending',
    accountStatus: 'active',
  }], state);
  assert.equal(migrated[0].facultyId, 'faculty-001');
  assert.equal(migrated[0].departmentId, 'dep_003');
  assert.equal(migrated[0].department, 'ภาควิชาวิทยาการคอมพิวเตอร์');
  assert.equal(migrated[1].facultyId, undefined);
  assert.equal(migrated[1].departmentId, undefined);
  assert.equal(migrated[1].department, 'Unknown Department');
});
