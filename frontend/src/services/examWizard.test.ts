import assert from 'node:assert/strict';
import test from 'node:test';
import type { Course, ExamSession, Room, Student } from '../types';
import { coursesForTeacher } from './courseState';
import { getAuthorizedMonitoringExams } from './teacherMonitoring';
import {
  calculateExamDurationMinutes,
  applyRecommendedExamResources,
  createEmptyExamWizardState,
  createResourceRule,
  examWizardStateFromSession,
  examWizardToSession,
  filterExamDrafts,
  findExamRoomConflict,
  getNextPolicySubStep,
  getExamResourceMeaning,
  getPolicySubStepLabel,
  getSelectedExamResources,
  getPreviousPolicySubStep,
  getExamRoomCapacity,
  initialPolicySubStep,
  isFinalPolicySubStep,
  loadExamDrafts,
  persistExamDraft,
  policySubSteps,
  removeExamDraft,
  resolveEligibleExamStudents,
  sectionsForWizardCourse,
  selectWizardCourse,
  setSelectedExamResources,
  validateExamWizard,
} from './examWizard';

const courses: Course[] = [
  {
    id: 'course-a', courseCode: 'NET301', courseName: 'Network Security', faculty: '', department: '', status: 'active',
    sections: [
      { sectionNo: '1', semester: 1, academicYear: 2569, teacherId: 'teacher-a', primaryTeacherId: 'teacher-a', cohorts: [{ majorId: 'major-a', admissionYear: 2567 }] },
      { sectionNo: '2', semester: 1, academicYear: 2569, teacherId: 'teacher-b', primaryTeacherId: 'teacher-b', cohorts: [{ majorId: 'major-b', admissionYear: 2567 }] },
    ],
  },
  {
    id: 'course-b', courseCode: 'DB302', courseName: 'Database Systems', faculty: '', department: '', status: 'active',
    sections: [{ sectionNo: '1', semester: 1, academicYear: 2569, teacherId: 'teacher-a', primaryTeacherId: 'teacher-a', cohorts: [{ majorId: 'major-a', admissionYear: 2567 }] }],
  },
];

const student = (id: string, majorId = 'major-a', admissionYear = 2567): Student => ({
  id, studentCode: id, fullName: id, email: `${id}@example.test`, majorId, admissionYear,
  faculty: '', department: '', year: 1, faceReferenceUrl: '', accountStatus: 'active',
});
const students = [student('student-1'), student('student-2'), student('student-other', 'major-b')];
const room = (id: string, status: Room['status'] = 'ready', capacity = 3): Room => ({
  id, building: '', floor: 4, labName: id, status, rows: 1, columns: capacity, deskOrientation: 'front',
  seats: Array.from({ length: capacity }, (_, index) => ({ seatNo: `A${index + 1}`, machineNo: `PC-${index + 1}`, ip: '', mac: '', status: 'online' })),
});
const rooms = [room('room-a'), room('room-small', 'ready', 1), room('room-down', 'maintenance')];

const completeState = () => ({
  ...createEmptyExamWizardState(),
  courseId: 'course-a', sectionNo: '1', examName: 'สอบปลายภาค', examDate: '2026-12-14',
  startTime: '09:00', endTime: '12:00', roomId: 'room-a', format: 'online' as const,
});
const existingExam: ExamSession = {
  id: 'exam-existing', ...examWizardToSession({ ...completeState(), examName: 'สอบกลางภาค', startTime: '13:00', endTime: '15:00' }),
};

test('Teacher receives only Courses and Sections assigned as primary or co-teacher', () => {
  const authorized = coursesForTeacher(courses, 'teacher-a');
  assert.deepEqual(authorized.map((course) => course.id), ['course-a', 'course-b']);
  assert.deepEqual(authorized[0].sections.map((section) => section.sectionNo), ['1']);
  assert.deepEqual(sectionsForWizardCourse(authorized, 'course-a').map((section) => section.sectionNo), ['1']);
});

test('changing Course clears an incompatible Section', () => {
  const authorized = coursesForTeacher(courses, 'teacher-a');
  const selected = { ...completeState(), sectionNo: '2' };
  assert.equal(selectWizardCourse(selected, 'course-b', authorized).sectionNo, '');
});

test('eligible student count resolves from canonical Section cohorts', () => {
  assert.deepEqual(resolveEligibleExamStudents(completeState(), coursesForTeacher(courses, 'teacher-a'), students).map((item) => item.id), ['student-1', 'student-2']);
});

test('start and end time validation derives duration and rejects reversed values', () => {
  assert.equal(calculateExamDurationMinutes('09:00', '12:00'), 180);
  assert.equal(calculateExamDurationMinutes('12:00', '09:00'), null);
  assert.equal(calculateExamDurationMinutes('invalid', '12:00'), null);
});

test('room readiness, overlap and capacity are validated', () => {
  const authorized = coursesForTeacher(courses, 'teacher-a');
  const environment = { courses: authorized, students, rooms, examSessions: [existingExam] };
  assert.equal(Object.keys(validateExamWizard(completeState(), environment)).length, 0);
  assert.ok(findExamRoomConflict([existingExam], { ...completeState(), startTime: '14:00', endTime: '16:00' }));
  assert.equal(findExamRoomConflict([existingExam], completeState()), undefined);
  assert.equal(getExamRoomCapacity(rooms[0]), 3);
  assert.match(validateExamWizard({ ...completeState(), roomId: 'room-small' }, environment).capacity, /ไม่เพียงพอ/);
  assert.match(validateExamWizard({ ...completeState(), roomId: 'room-down' }, environment).roomId, /พร้อมใช้งาน/);
});

test('Online and Offline modes share Common/File policy without losing mode configuration', () => {
  const state = completeState();
  state.policy.common.requireAgent = false;
  state.policy.file.lockAfterFinalSubmit = true;
  state.policy.online.resourceMode = 'allowlist';
  state.policy.offline.blockInternet = true;
  const offline = { ...state, format: 'offline' as const };
  assert.equal(offline.policy.common.requireAgent, false);
  assert.equal(offline.policy.file.lockAfterFinalSubmit, true);
  assert.equal(offline.policy.online.resourceMode, 'allowlist');
  assert.equal(offline.policy.offline.blockInternet, true);
});

test('custom resource rules normalize valid domains and reject invalid input', () => {
  const valid = createResourceRule('Python Docs', 'website', 'https://docs.python.org/3/');
  assert.equal(valid.rule?.value, 'docs.python.org');
  assert.equal(createResourceRule('Invalid', 'website', 'not a domain').rule, undefined);
  assert.match(createResourceRule('', 'application', 'AnyDesk').error || '', /ชื่อ/);
});

test('draft persistence preserves the complete Wizard state without creating ExamSession data', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const state = completeState();
  state.policy.online.allowedDomains.push('docs.python.org');
  persistExamDraft({ id: 'draft-1', teacherId: 'teacher-a', updatedAt: '2026-01-01', state }, storage);
  const loaded = loadExamDrafts('teacher-a', storage);
  assert.equal(loaded.length, 1);
  assert.deepEqual(loaded[0].state, state);
  assert.equal(loadExamDrafts('teacher-b', storage).length, 0);
});

test('Step 5 sub-wizard advances through four views without duplicating policy state', () => {
  const state = completeState();
  state.policy.file.requireDeviceSignature = false;
  state.policy.online.allowedDomains.push('docs.python.org');
  state.policy.offline.blockSsh = false;
  const policyReference = state.policy;

  assert.equal(initialPolicySubStep, 0);
  assert.deepEqual(policySubSteps, ['ตัวตนและเครื่อง', 'ไฟล์คำตอบ', 'รูปแบบการสอบ', 'ทรัพยากร']);
  assert.equal(getPolicySubStepLabel(2, 'online'), 'ออนไลน์');
  assert.equal(getPolicySubStepLabel(2, 'offline'), 'ออฟไลน์');
  assert.equal(getPolicySubStepLabel(3, 'online'), 'ทรัพยากร');
  assert.equal(getNextPolicySubStep(initialPolicySubStep), 1);
  assert.equal(getNextPolicySubStep(1), 2);
  assert.equal(getNextPolicySubStep(2), 3);
  assert.equal(getNextPolicySubStep(3), 3);
  assert.equal(getPreviousPolicySubStep(3), 2);
  assert.equal(getPreviousPolicySubStep(0), 0);
  assert.equal(isFinalPolicySubStep(2), false);
  assert.equal(isFinalPolicySubStep(3), true);
  assert.equal(state.policy, policyReference);
  assert.equal(state.policy.file.requireDeviceSignature, false);
  assert.deepEqual(state.policy.online.allowedDomains, ['securelab.ic.it.ac.th', 'docs.python.org']);
  assert.equal(state.policy.offline.blockSsh, false);
});

test('Allowlist and Blocklist keep different resource meanings without rewriting legacy blocked rules', () => {
  const oldBlocked = createResourceRule('Discord', 'application', 'Discord').rule!;
  const allowed = createResourceRule('Python Docs', 'website', 'docs.python.org').rule!;
  const original = createEmptyExamWizardState().policy;
  original.online.blockedResources = [oldBlocked];
  assert.equal(getExamResourceMeaning(original, 'online'), 'allowed');
  assert.deepEqual(getSelectedExamResources(original, 'online'), []);
  const withAllowed = setSelectedExamResources(original, 'online', [allowed]);
  assert.deepEqual(getSelectedExamResources(withAllowed, 'online'), [allowed]);
  assert.deepEqual(withAllowed.online.blockedResources, [oldBlocked]);
  const blocklist = { ...withAllowed, online: { ...withAllowed.online, resourceMode: 'blocklist' as const } };
  assert.equal(getExamResourceMeaning(blocklist, 'online'), 'blocked');
  assert.deepEqual(getSelectedExamResources(blocklist, 'online'), [oldBlocked]);
  assert.deepEqual(getSelectedExamResources(blocklist, 'offline'), [oldBlocked]);
  assert.deepEqual(getSelectedExamResources(withAllowed, 'online'), [allowed]);
});

test('custom resources and recommended presets follow the selected policy mode', () => {
  const custom = createResourceRule('Custom App', 'application', 'Custom App').rule!;
  const allowlist = setSelectedExamResources(createEmptyExamWizardState().policy, 'online', [custom]);
  assert.equal(getSelectedExamResources(allowlist, 'online')[0].name, 'Custom App');
  const recommendedAllowed = applyRecommendedExamResources(allowlist, 'online');
  assert.ok(getSelectedExamResources(recommendedAllowed, 'online').some((item) => item.value === 'docs.python.org'));
  assert.deepEqual(recommendedAllowed.online.blockedResources, []);
  const blocklist = { ...recommendedAllowed, online: { ...recommendedAllowed.online, resourceMode: 'blocklist' as const } };
  const recommendedBlocked = applyRecommendedExamResources(blocklist, 'online');
  assert.ok(getSelectedExamResources(recommendedBlocked, 'online').some((item) => item.name === 'Discord'));
  assert.deepEqual(recommendedBlocked.online.allowedResources, recommendedAllowed.online.allowedResources);
});

test('resource-only Allowlist validates and survives draft and saved-exam round trips', () => {
  const state = completeState();
  state.policy.online.allowedDomains = [];
  state.policy = setSelectedExamResources(state.policy, 'online', [createResourceRule('Python Docs', 'website', 'docs.python.org').rule!]);
  assert.deepEqual(validateExamWizard(state, { courses: coursesForTeacher(courses, 'teacher-a'), students, rooms, examSessions: [] }), {});
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
  persistExamDraft({ id: 'draft-allow', teacherId: 'teacher-a', updatedAt: '2026-01-01', state }, storage);
  assert.deepEqual(loadExamDrafts('teacher-a', storage)[0].state.policy.online.allowedResources, state.policy.online.allowedResources);
  const saved = { id: 'exam-allow', ...examWizardToSession(state) };
  assert.deepEqual(examWizardStateFromSession(saved).policy.online.allowedResources, state.policy.online.allowedResources);
  const legacy = { ...saved, policy: { ...saved.policy!, online: { ...saved.policy!.online, allowedResources: undefined } } };
  assert.deepEqual(getSelectedExamResources(examWizardStateFromSession(legacy).policy, 'online'), []);
});

test('Offline policy remains independent and still validates required Local Server', () => {
  const state = { ...completeState(), format: 'offline' as const };
  state.policy.offline.localServerHost = '';
  assert.match(validateExamWizard(state, { courses: coursesForTeacher(courses, 'teacher-a'), students, rooms, examSessions: [] }).offlinePolicy, /Local Exam Server/);
  state.policy.offline.localServerHost = 'exam.local';
  state.policy.online.resourceMode = 'blocklist';
  assert.equal(validateExamWizard(state, { courses: coursesForTeacher(courses, 'teacher-a'), students, rooms, examSessions: [] }).offlinePolicy, undefined);
  assert.equal(getExamResourceMeaning(state.policy, 'offline'), 'blocked');
});

test('Draft list is teacher-scoped, searchable and deletes only the selected stable ID', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
  persistExamDraft({ id: 'draft-a', teacherId: 'teacher-a', updatedAt: '2026-01-01', state: { ...completeState(), examName: 'สอบปลายภาค' } }, storage);
  persistExamDraft({ id: 'draft-b', teacherId: 'teacher-a', updatedAt: '2026-01-02', state: { ...completeState(), examName: 'Lab Test', courseId: 'course-b' } }, storage);
  persistExamDraft({ id: 'draft-other', teacherId: 'teacher-b', updatedAt: '2026-01-03', state: completeState() }, storage);

  const teacherDrafts = loadExamDrafts('teacher-a', storage);
  assert.deepEqual(teacherDrafts.map((draft) => draft.id), ['draft-a', 'draft-b']);
  assert.deepEqual(filterExamDrafts(teacherDrafts, courses, 'DB302').map((draft) => draft.id), ['draft-b']);
  assert.deepEqual(filterExamDrafts(teacherDrafts, courses, 'section 1').map((draft) => draft.id), ['draft-a', 'draft-b']);

  removeExamDraft('draft-a', storage);
  assert.deepEqual(loadExamDrafts('teacher-a', storage).map((draft) => draft.id), ['draft-b']);
  assert.deepEqual(loadExamDrafts('teacher-b', storage).map((draft) => draft.id), ['draft-other']);
});

test('final validation reports missing required steps and blocks unrelated Teachers', () => {
  const empty = createEmptyExamWizardState();
  const errors = validateExamWizard(empty, { courses: coursesForTeacher(courses, 'teacher-a'), students, rooms, examSessions: [] });
  assert.ok(errors.courseId && errors.sectionNo && errors.examName && errors.examDate && errors.roomId);
  const unauthorized = validateExamWizard(completeState(), { courses: coursesForTeacher(courses, 'teacher-b'), students, rooms, examSessions: [] });
  assert.ok(unauthorized.courseId || unauthorized.sectionNo);
});

test('created ExamSession enters the canonical monitoring source and edits preserve stable ID', () => {
  const authorized = coursesForTeacher(courses, 'teacher-a');
  const created = { id: 'exam-new', ...examWizardToSession(completeState()) };
  assert.deepEqual(getAuthorizedMonitoringExams([created], authorized).map((item) => item.exam.id), ['exam-new']);
  const editing = examWizardStateFromSession(created);
  editing.examName = 'แก้ไขชื่อ';
  const updated = { ...created, ...examWizardToSession(editing, created.status) };
  assert.equal(updated.id, 'exam-new');
  assert.equal(updated.examName, 'แก้ไขชื่อ');
});
