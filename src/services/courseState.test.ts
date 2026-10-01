import assert from 'node:assert/strict';
import test from 'node:test';
import { initialCourses, initialExamSessions, initialStudents, initialTeachers } from '../data/initialData';
import { addCs301DemoCoTeacher } from '../data/teacherCourseDemo';
import { Course } from '../types';
import { SectionInput } from '../types/course';
import { createInitialAcademicState, migrateAcademicStudents } from './academicState';
import {
  addStudentToSection,
  courseDeleteError,
  courseStudentCount,
  cohortsOverlap,
  coursesForStudent,
  coursesForTeacher,
  enrollmentExamReferenceError,
  findSection,
  findStudentEnrollmentInCourse,
  migrateCourses,
  moveStudentBetweenSections,
  normalizeSectionOverrides,
  saveCourse,
  saveSection,
  searchStudentsByIdentity,
  sectionDeleteError,
  sectionIdOf,
  sectionStudentCount,
  snapshotAffectedExamRosters,
  studentMatchesExamSection,
  studentMatchesSectionBase,
  teacherCanManageSection,
  studentMatchesSection,
  validateCourseInput,
  validateSectionInput,
} from './courseState';

const academic = createInitialAcademicState();
const students = migrateAcademicStudents(initialStudents, academic);
const courses = migrateCourses(initialCourses, academic);
const primaryTeacher = initialTeachers.find((teacher) => teacher.accountStatus === 'active')!;
const baseCourse = courses.find((course) => course.status === 'active')!;
const baseMajor = academic.majors.find((major) => major.departmentId === baseCourse.departmentId)!;
const sectionInput = (values: Partial<SectionInput> = {}): SectionInput => ({
  courseId: baseCourse.id,
  sectionNumber: 99,
  semester: 1,
  academicYear: 2569,
  primaryTeacherId: primaryTeacher.id,
  coTeacherIds: [],
  cohorts: [{ majorId: baseMajor.id, admissionYear: 2567 }],
  status: 'active',
  ...values,
});

test('CS301 demo exposes two authorized Sections with distinct effective rosters', () => {
  const teacherCourses = coursesForTeacher(courses, 'tch_0001');
  const cs301 = teacherCourses.find((course) => course.courseCode === 'CS301')!;
  assert.equal(teacherCourses.length, 3);
  assert.equal(teacherCourses.reduce((count, course) => count + course.sections.length, 0), 4);
  assert.deepEqual(cs301.sections.map((section) => section.sectionNo), ['1', '2']);
  assert.equal(cs301.sections[0].primaryTeacherId, 'tch_0001');
  assert.equal(cs301.sections[1].primaryTeacherId, 'tch_0002');
  assert.ok(cs301.sections[1].coTeacherIds?.includes('tch_0001'));
  const [firstRoster, secondRoster] = cs301.sections.map((section) => students.filter((student) => studentMatchesSection(student, section)));
  assert.ok(firstRoster.length > 0 && secondRoster.length > 0);
  assert.equal(firstRoster.some((student) => secondRoster.some((other) => other.id === student.id)), false);
  assert.equal(new Set([...firstRoster, ...secondRoster].map((student) => student.id)).size, firstRoster.length + secondRoster.length);
  assert.equal(coursesForTeacher(courses, 'unknown-teacher').length, 0);
});

test('CS301 demo forward update touches only an unchanged seed Section', () => {
  const oldSeed = migrateCourses([{ ...initialCourses[0], sections: initialCourses[0].sections.map((section) =>
    section.sectionNo === '2' ? { ...section, coTeacherIds: [] } : section) }], academic);
  const updated = addCs301DemoCoTeacher(oldSeed);
  assert.deepEqual(updated[0].sections[0], oldSeed[0].sections[0]);
  assert.deepEqual(updated[0].sections[1].coTeacherIds, ['tch_0001']);
  assert.deepEqual(updated[0].sections[1].cohorts, oldSeed[0].sections[1].cohorts);
  const customized = [{ ...oldSeed[0], sections: [oldSeed[0].sections[0], { ...oldSeed[0].sections[1], includedStudentIds: ['custom-student'] }] }];
  assert.deepEqual(addCs301DemoCoTeacher(customized), customized);
  assert.deepEqual(addCs301DemoCoTeacher(updated), updated);
});

test('CS301 demo move updates both Section rosters without changing Student Master', () => {
  const cs301 = courses.find((course) => course.courseCode === 'CS301')!;
  const [first, second] = cs301.sections;
  const student = students.find((item) => studentMatchesSection(item, first))!;
  const originalStudent = structuredClone(student);
  const originalFirstCount = students.filter((item) => studentMatchesSection(item, first)).length;
  const originalSecondCount = students.filter((item) => studentMatchesSection(item, second)).length;
  const moved = moveStudentBetweenSections(courses, students, student.id, sectionIdOf(cs301.id, first), sectionIdOf(cs301.id, second), 'tch_0001');
  assert.equal(moved.success, true);
  const [source, destination] = moved.courses!.find((course) => course.id === cs301.id)!.sections;
  assert.equal(students.filter((item) => studentMatchesSection(item, source)).length, originalFirstCount - 1);
  assert.equal(students.filter((item) => studentMatchesSection(item, destination)).length, originalSecondCount + 1);
  assert.deepEqual(student, originalStudent);
});

test('legacy course migration converts groupIds into stable Major/admission cohorts', () => {
  const legacyCourses: Course[] = [{
    ...initialCourses[0],
    sections: [{ ...initialCourses[0].sections[0], cohorts: undefined, groupIds: ['group_003'] }],
  }];
  const migrated = migrateCourses(legacyCourses, academic);
  const migratedSections = migrated.flatMap((course) => course.sections);
  assert.ok(migratedSections.length > 0);
  assert.ok(migratedSections.every((section) => Array.isArray(section.cohorts)));
  assert.ok(migratedSections.some((section) => section.cohorts?.some((cohort) => cohort.majorId === 'program_inet' && cohort.admissionYear === 2567)));
  assert.ok(migratedSections.some((section) => section.cohorts?.some((cohort) => cohort.classGroupIds?.includes('group_inet_de_ra'))));
  assert.ok(migratedSections.every((section) => section.groupIds === undefined));
});

test('course validation and CRUD preserve Faculty/Department stable relationships', () => {
  const input = { code: 'NEW101', name: 'รายวิชาทดสอบ', facultyId: baseCourse.facultyId!, departmentId: baseCourse.departmentId!, status: 'active' as const };
  assert.equal(validateCourseInput(courses, academic, input), undefined);
  const next = saveCourse(courses, academic, input);
  assert.equal(next[0].courseCode, 'NEW101');
  assert.equal(next[0].departmentId, baseCourse.departmentId);
  assert.ok(validateCourseInput(next, academic, input));
});

test('section validation preserves composite uniqueness', () => {
  const existing = baseCourse.sections[0];
  const duplicate = sectionInput({
    sectionNumber: Number(existing.sectionNumber || existing.sectionNo),
    semester: existing.semester as SectionInput['semester'],
    academicYear: existing.academicYear,
  });
  assert.ok(validateSectionInput(courses, academic, initialTeachers, duplicate));
});

test('primary and co-teacher validation remains enforced', () => {
  assert.ok(validateSectionInput(courses, academic, initialTeachers, sectionInput({ primaryTeacherId: 'missing' })));
  assert.ok(validateSectionInput(courses, academic, initialTeachers, sectionInput({ coTeacherIds: [primaryTeacher.id] })));
});

test('cohort validation enforces active Major, admission year and course Department', () => {
  assert.ok(validateSectionInput(courses, academic, initialTeachers, sectionInput({ cohorts: [] })));
  assert.ok(validateSectionInput(courses, academic, initialTeachers, sectionInput({ cohorts: [{ majorId: 'missing', admissionYear: 2567 }] })));
  assert.ok(validateSectionInput(courses, academic, initialTeachers, sectionInput({ cohorts: [{ majorId: baseMajor.id, admissionYear: 2570 }] })));
  const mismatchedGroup = academic.classGroups.find((group) => group.majorId !== baseMajor.id);
  if (mismatchedGroup) assert.ok(validateSectionInput(courses, academic, initialTeachers, sectionInput({ cohorts: [{ majorId: baseMajor.id, admissionYear: 2567, classGroupIds: [mismatchedGroup.id] }] })));
});

test('same Major/admission cohort cannot join two sections of the same course and term', () => {
  const firstInput = sectionInput({ sectionNumber: 97 });
  const once = saveSection(courses, firstInput);
  const collision = validateSectionInput(once, academic, initialTeachers, sectionInput({ sectionNumber: 98 }));
  assert.match(collision || '', /รหัส/);
});

test('Section cohorts distinguish RA, RB and whole-cohort overlap', () => {
  const ra = academic.classGroups.find((group) => group.majorId === 'program_inet' && group.admissionYear === 2567 && group.code.endsWith('-RA'))!;
  const rb = academic.classGroups.find((group) => group.majorId === 'program_inet' && group.admissionYear === 2567 && group.code.endsWith('-RB'))!;
  const base = { majorId: 'program_inet', admissionYear: 2567 };
  assert.equal(cohortsOverlap({ ...base, classGroupIds: [ra.id] }, { ...base, classGroupIds: [rb.id] }), false);
  assert.equal(cohortsOverlap({ ...base, classGroupIds: [ra.id] }, { ...base, classGroupIds: [ra.id] }), true);
  assert.equal(cohortsOverlap(base, { ...base, classGroupIds: [ra.id] }), true);
});

test('separate Sections may target RA and RB while duplicate RA is rejected', () => {
  const ra = academic.classGroups.find((group) => group.majorId === baseMajor.id && group.admissionYear === 2567 && group.code.endsWith('-RA'));
  const rb = academic.classGroups.find((group) => group.majorId === baseMajor.id && group.admissionYear === 2567 && group.code.endsWith('-RB'));
  if (!ra || !rb) return;
  const isolated = courses.map((course) => course.id === baseCourse.id ? { ...course, sections: [] } : course);
  const raInput = sectionInput({ sectionNumber: 71, cohorts: [{ majorId: baseMajor.id, admissionYear: 2567, classGroupIds: [ra.id] }] });
  const withRa = saveSection(isolated, raInput);
  const rbInput = sectionInput({ sectionNumber: 72, cohorts: [{ majorId: baseMajor.id, admissionYear: 2567, classGroupIds: [rb.id] }] });
  assert.equal(validateSectionInput(withRa, academic, initialTeachers, rbInput), undefined);
  const withRaAndRb = saveSection(withRa, rbInput);
  assert.equal(withRaAndRb.find((course) => course.id === baseCourse.id)?.sections.length, 2);
  const duplicateRa = sectionInput({ sectionNumber: 73, cohorts: [{ majorId: baseMajor.id, admissionYear: 2567, classGroupIds: [ra.id] }] });
  assert.match(validateSectionInput(withRaAndRb, academic, initialTeachers, duplicateRa) || '', /รหัส/);
});

test('one Section may combine RA + RB and eligibility follows the student primary group', () => {
  const ra = academic.classGroups.find((group) => group.majorId === 'program_inet' && group.admissionYear === 2567 && group.code.endsWith('-RA'))!;
  const rb = academic.classGroups.find((group) => group.majorId === 'program_inet' && group.admissionYear === 2567 && group.code.endsWith('-RB'))!;
  const cohort = { majorId: 'program_inet', admissionYear: 2567, classGroupIds: [ra.id, rb.id] };
  const isolated = courses.map((course) => course.id === baseCourse.id ? { ...course, sections: [] } : course);
  assert.equal(validateSectionInput(isolated, academic, initialTeachers, sectionInput({ sectionNumber: 74, cohorts: [cohort] })), undefined);
  const expected = students.filter((student) => student.accountStatus === 'active' && student.majorId === cohort.majorId && student.admissionYear === cohort.admissionYear && Boolean(student.classGroupId && cohort.classGroupIds.includes(student.classGroupId))).length;
  assert.equal(courseStudentCount(students, [cohort]), expected);
  const section = { ...baseCourse.sections[0], cohorts: [cohort] };
  assert.ok(students.filter((student) => student.classGroupId === ra.id || student.classGroupId === rb.id).every((student) => studentMatchesSection(student, section)));
  const unassigned = { ...students.find((student) => student.majorId === cohort.majorId && student.admissionYear === cohort.admissionYear)!, classGroupId: undefined };
  assert.equal(studentMatchesSection(unassigned, section), false);
});

test('section edits retain identity and can move between courses', () => {
  const created = saveSection(courses, sectionInput({ sectionNumber: 96 }));
  const locatedCourse = created.find((course) => course.id === baseCourse.id)!;
  const createdSection = locatedCourse.sections.at(-1)!;
  const sectionId = sectionIdOf(locatedCourse.id, createdSection);
  const alternate = created.find((course) => course.id !== baseCourse.id && course.status === 'active' && course.departmentId === baseCourse.departmentId);
  if (!alternate) {
    assert.ok(findSection(created, sectionId));
    return;
  }
  const moved = saveSection(created, sectionInput({ courseId: alternate.id, sectionNumber: 95 }), sectionId);
  assert.equal(findSection(moved, sectionId)?.course.id, alternate.id);
});

test('teacher and student portal projections follow section assignments', () => {
  const teacherCourses = coursesForTeacher(courses, primaryTeacher.id);
  assert.ok(teacherCourses.every((course) => course.sections.every((section) =>
    section.primaryTeacherId === primaryTeacher.id || section.coTeacherIds?.includes(primaryTeacher.id))));
  const eligible = students.find((student) => courses.some((course) => course.sections.some((section) => studentMatchesSection(student, section))));
  assert.ok(eligible);
  assert.ok(coursesForStudent(courses, eligible).length > 0);
});

test('student count resolves dynamically from majorId + admissionYear', () => {
  const cohort = { majorId: 'program_inet', admissionYear: 2567 };
  const expected = students.filter((student) => student.accountStatus === 'active' && student.majorId === cohort.majorId && student.admissionYear === cohort.admissionYear).length;
  assert.equal(courseStudentCount(students, [cohort]), expected);
});

test('course and section deletion guards preserve exam references', () => {
  const referenced = courses.find((course) => initialExamSessions.some((exam) => exam.courseId === course.id));
  assert.ok(referenced);
  assert.ok(courseDeleteError(referenced!, initialExamSessions));
  const section = referenced!.sections.find((item) => initialExamSessions.some((exam) => exam.courseId === referenced!.id && exam.sectionNo === item.sectionNo));
  if (section) assert.ok(sectionDeleteError(referenced!, section, initialExamSessions));
});

test('section ID remains stable for migrated records', () => {
  const course: Course = courses[0];
  const section = course.sections[0];
  assert.equal(findSection(courses, sectionIdOf(course.id, section))?.section.id, section.id);
});

const enrollmentStudent = students.find((student) => student.majorId && student.admissionYear)!;
const exceptionalStudent = students.find((student) => student.id !== enrollmentStudent.id &&
  (student.majorId !== enrollmentStudent.majorId || student.admissionYear !== enrollmentStudent.admissionYear))!;
const enrollmentTeacherId = primaryTeacher.id;
const enrollmentCourse: Course = {
  ...baseCourse,
  id: 'course-enrollment-test',
  sections: [
    {
      id: 'section-enrollment-1', courseId: 'course-enrollment-test', sectionNo: '1', semester: 1, academicYear: 2569,
      teacherId: enrollmentTeacherId, primaryTeacherId: enrollmentTeacherId, coTeacherIds: [],
      cohorts: [{ majorId: enrollmentStudent.majorId!, admissionYear: enrollmentStudent.admissionYear! }],
    },
    {
      id: 'section-enrollment-2', courseId: 'course-enrollment-test', sectionNo: '2', semester: 1, academicYear: 2569,
      teacherId: enrollmentTeacherId, primaryTeacherId: enrollmentTeacherId, coTeacherIds: [],
      cohorts: [{ majorId: 'other-major', admissionYear: 2568 }],
    },
  ],
};

test('enrollment overrides preserve base cohort and normalize duplicate/conflicting IDs', () => {
  const section = enrollmentCourse.sections[0];
  assert.equal(studentMatchesSectionBase(enrollmentStudent, section), true);
  assert.equal(studentMatchesSection(enrollmentStudent, section), true);
  assert.deepEqual(normalizeSectionOverrides({ includedStudentIds: ['a', 'a'], excludedStudentIds: ['a', 'b', 'b'] }),
    { includedStudentIds: ['a'], excludedStudentIds: ['b'] });
});

test('Student roster and candidate search match ID, name and email without changing Student master', () => {
  assert.ok(searchStudentsByIdentity(students, enrollmentStudent.studentCode).some((student) => student.id === enrollmentStudent.id));
  assert.ok(searchStudentsByIdentity(students, enrollmentStudent.fullName.toUpperCase()).some((student) => student.id === enrollmentStudent.id));
  assert.ok(searchStudentsByIdentity(students, enrollmentStudent.email.toUpperCase()).some((student) => student.id === enrollmentStudent.id));
  assert.deepEqual(searchStudentsByIdentity(students, ''), students);
});

test('adding an existing Student master record creates only an individual Section inclusion', () => {
  const before = structuredClone(students);
  const result = addStudentToSection([enrollmentCourse], students, exceptionalStudent.id, 'section-enrollment-1', enrollmentTeacherId);
  assert.equal(result.success, true);
  const section = result.courses![0].sections[0];
  assert.deepEqual(section.includedStudentIds, [exceptionalStudent.id]);
  assert.equal(studentMatchesSection(exceptionalStudent, section), true);
  assert.deepEqual(students, before);
  assert.equal(section.id, 'section-enrollment-1');
  assert.equal(result.courses![0].id, enrollmentCourse.id);
  assert.ok(coursesForStudent(result.courses!, exceptionalStudent).some((course) => course.sections.some((item) => item.id === section.id)));
});

test('individual inclusion remains eligible when legacy Student academic fields are incomplete', () => {
  const incomplete = { ...exceptionalStudent, id: 'student-incomplete', majorId: undefined, admissionYear: undefined };
  const result = addStudentToSection([enrollmentCourse], [...students, incomplete], incomplete.id, 'section-enrollment-1', enrollmentTeacherId);
  assert.equal(result.success, true);
  assert.ok(coursesForStudent(result.courses!, incomplete).length);
});

test('add rejects missing Student, duplicate membership and unauthorized Teacher', () => {
  assert.match(addStudentToSection([enrollmentCourse], students, 'missing', 'section-enrollment-1', enrollmentTeacherId).error || '', /ไม่พบ/);
  assert.match(addStudentToSection([enrollmentCourse], students, enrollmentStudent.id, 'section-enrollment-1', enrollmentTeacherId).error || '', /อยู่ใน Section นี้แล้ว/);
  assert.match(addStudentToSection([enrollmentCourse], students, exceptionalStudent.id, 'section-enrollment-1', 'other-teacher').error || '', /ไม่มีสิทธิ์/);
  assert.equal(addStudentToSection([enrollmentCourse], students, exceptionalStudent.id, 'section-enrollment-1', enrollmentTeacherId).success, true);
});

test('add requires Move when Student already belongs to another Section of the offering', () => {
  const result = addStudentToSection([enrollmentCourse], students, enrollmentStudent.id, 'section-enrollment-2', enrollmentTeacherId);
  assert.match(result.error || '', /ย้าย/);
  assert.deepEqual(findStudentEnrollmentInCourse([enrollmentCourse], enrollmentStudent, enrollmentCourse.id, 'section-enrollment-2', enrollmentTeacherId),
    { sectionId: 'section-enrollment-1', sectionNo: '1', manageable: true });
});

test('move excludes cohort Student from source and includes them in destination without changing Student master', () => {
  const before = structuredClone(enrollmentStudent);
  const result = moveStudentBetweenSections([enrollmentCourse], students, enrollmentStudent.id, 'section-enrollment-1', 'section-enrollment-2', enrollmentTeacherId);
  assert.equal(result.success, true);
  const [source, destination] = result.courses![0].sections;
  assert.deepEqual(source.excludedStudentIds, [enrollmentStudent.id]);
  assert.deepEqual(destination.includedStudentIds, [enrollmentStudent.id]);
  assert.equal(studentMatchesSection(enrollmentStudent, source), false);
  assert.equal(studentMatchesSection(enrollmentStudent, destination), true);
  assert.deepEqual(enrollmentStudent, before);
});

test('move rejects another Course, unauthorized destination and invalid source', () => {
  const otherCourse = { ...enrollmentCourse, id: 'other-course', sections: [{ ...enrollmentCourse.sections[1], id: 'other-section', courseId: 'other-course' }] };
  assert.match(moveStudentBetweenSections([enrollmentCourse, otherCourse], students, enrollmentStudent.id, 'section-enrollment-1', 'other-section', enrollmentTeacherId).error || '', /เดียวกัน/);
  const blocked = { ...enrollmentCourse, sections: [enrollmentCourse.sections[0], { ...enrollmentCourse.sections[1], teacherId: 'other', primaryTeacherId: 'other' }] };
  assert.match(moveStudentBetweenSections([blocked], students, enrollmentStudent.id, 'section-enrollment-1', 'section-enrollment-2', enrollmentTeacherId).error || '', /ไม่มีสิทธิ์/);
  assert.match(moveStudentBetweenSections([enrollmentCourse], students, exceptionalStudent.id, 'section-enrollment-1', 'section-enrollment-2', enrollmentTeacherId).error || '', /ต้นทาง/);
});

test('co-Teacher can manage an assigned Section without seeing unrelated Sections', () => {
  const coTeacherId = 'co-teacher-test';
  const assigned = { ...enrollmentCourse.sections[0], coTeacherIds: [coTeacherId] };
  assert.equal(teacherCanManageSection(assigned, coTeacherId), true);
  assert.equal(teacherCanManageSection(enrollmentCourse.sections[1], coTeacherId), false);
  const projected = coursesForTeacher([{ ...enrollmentCourse, sections: [assigned, enrollmentCourse.sections[1]] }], coTeacherId);
  assert.deepEqual(projected[0].sections.map((section) => section.id), [assigned.id]);
});

test('restoring a cohort Student clears exclusion without redundant inclusion', () => {
  const excluded = { ...enrollmentCourse, sections: [{ ...enrollmentCourse.sections[0], excludedStudentIds: [enrollmentStudent.id] }, enrollmentCourse.sections[1]] };
  const result = addStudentToSection([excluded], students, enrollmentStudent.id, 'section-enrollment-1', enrollmentTeacherId);
  assert.equal(result.success, true);
  assert.deepEqual(result.courses![0].sections[0].includedStudentIds, []);
  assert.deepEqual(result.courses![0].sections[0].excludedStudentIds, []);
});

test('moving an individually included Student removes their source inclusion', () => {
  const included = { ...enrollmentCourse, sections: [{ ...enrollmentCourse.sections[0], includedStudentIds: [exceptionalStudent.id] }, enrollmentCourse.sections[1]] };
  const result = moveStudentBetweenSections([included], students, exceptionalStudent.id, 'section-enrollment-1', 'section-enrollment-2', enrollmentTeacherId);
  assert.equal(result.success, true);
  assert.deepEqual(result.courses![0].sections[0].includedStudentIds, []);
  assert.deepEqual(result.courses![0].sections[0].excludedStudentIds, []);
  assert.deepEqual(result.courses![0].sections[1].includedStudentIds, [exceptionalStudent.id]);
});

test('Section count reflects effective roster while cohort preview remains unchanged', () => {
  const result = moveStudentBetweenSections([enrollmentCourse], students, enrollmentStudent.id, 'section-enrollment-1', 'section-enrollment-2', enrollmentTeacherId);
  const [source, destination] = result.courses![0].sections;
  assert.equal(sectionStudentCount(students, source), students.filter((student) => student.accountStatus === 'active' && studentMatchesSection(student, source)).length);
  assert.equal(sectionStudentCount(students, destination), students.filter((student) => student.accountStatus === 'active' && studentMatchesSection(student, destination)).length);
  assert.equal(courseStudentCount(students, source.cohorts || []), courseStudentCount(students, enrollmentCourse.sections[0].cohorts || []));
});

test('saved Section edits and migration preserve normalized overrides and stable IDs', () => {
  const withOverride: Course = { ...enrollmentCourse, sections: [{ ...enrollmentCourse.sections[0], includedStudentIds: [exceptionalStudent.id, exceptionalStudent.id] }, enrollmentCourse.sections[1]] };
  const migrated = migrateCourses([withOverride], academic);
  assert.deepEqual(migrated[0].sections[0].includedStudentIds, [exceptionalStudent.id]);
  const input: SectionInput = { courseId: withOverride.id, sectionNumber: 1, semester: 1, academicYear: 2569, primaryTeacherId: enrollmentTeacherId, coTeacherIds: [], cohorts: withOverride.sections[0].cohorts!, status: 'active' };
  const saved = saveSection(migrated, input, 'section-enrollment-1');
  assert.deepEqual(saved[0].sections.find((section) => section.id === 'section-enrollment-1')?.includedStudentIds, [exceptionalStudent.id]);
});

test('historical exam roster is frozen before override while upcoming exam stays dynamic', () => {
  const now = new Date(2026, 8, 25, 8, 0);
  const baseExam = { ...initialExamSessions[0], courseId: enrollmentCourse.id, sectionNo: '1', examDate: '2026-09-25' };
  const historical = { ...baseExam, id: 'historical', status: 'completed' as const };
  const upcoming = { ...baseExam, id: 'future', status: 'upcoming' as const };
  const frozen = snapshotAffectedExamRosters([historical, upcoming], [enrollmentCourse], students, ['section-enrollment-1'], now);
  assert.ok(frozen[0].eligibleStudentIds?.includes(enrollmentStudent.id));
  assert.equal(frozen[1].eligibleStudentIds, undefined);
  const moved = moveStudentBetweenSections([enrollmentCourse], students, enrollmentStudent.id, 'section-enrollment-1', 'section-enrollment-2', enrollmentTeacherId).courses!;
  assert.equal(studentMatchesExamSection(enrollmentStudent, frozen[0], moved[0].sections[0], now), true);
  assert.equal(studentMatchesExamSection(enrollmentStudent, frozen[1], moved[0].sections[0], now), false);
  assert.ok(coursesForStudent(moved, enrollmentStudent, frozen, now).some((course) => course.sections.some((section) => section.id === 'section-enrollment-1')));
});

test('stale upcoming status cannot make an ended exam roster mutable', () => {
  const now = new Date(2026, 8, 26, 8, 0);
  const ended = { ...initialExamSessions[0], id: 'ended-stale', courseId: enrollmentCourse.id, sectionNo: '1', examDate: '2026-09-25', startTime: '09:00', endTime: '11:00', status: 'upcoming' as const };
  const [frozen] = snapshotAffectedExamRosters([ended], [enrollmentCourse], students, ['section-enrollment-1'], now);
  assert.ok(frozen.eligibleStudentIds?.includes(enrollmentStudent.id));
  const moved = moveStudentBetweenSections([enrollmentCourse], students, enrollmentStudent.id, 'section-enrollment-1', 'section-enrollment-2', enrollmentTeacherId).courses!;
  assert.equal(studentMatchesExamSection(enrollmentStudent, frozen, moved[0].sections[0], now), true);
});

test('ambiguous legacy exam Section number blocks unsafe individual roster changes', () => {
  const duplicate = { ...enrollmentCourse.sections[0], id: 'section-enrollment-next-year', academicYear: 2570 };
  const ambiguous = { ...enrollmentCourse, sections: [...enrollmentCourse.sections, duplicate] };
  const exam = { ...initialExamSessions[0], courseId: enrollmentCourse.id, sectionNo: '1' };
  assert.match(enrollmentExamReferenceError([exam], [ambiguous], ['section-enrollment-1']) || '', /Section ID/);
  assert.equal(enrollmentExamReferenceError([exam], [enrollmentCourse], ['section-enrollment-1']), undefined);
});
