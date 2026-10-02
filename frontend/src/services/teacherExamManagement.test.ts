import assert from 'node:assert/strict';
import test from 'node:test';
import type { Course, ExamSession, Room } from '../types';
import { coursesForTeacher } from './courseState';
import { ExamDraftRecord, filterExamDrafts } from './examWizard';
import {
  defaultTeacherExamFilters,
  filterTeacherExamSessions,
  TeacherExamFilters,
} from './teacherExamManagement';

const courses = [
  {
    id: 'course-net', courseCode: 'NET301', courseName: 'Network Security',
    sections: [{ sectionNo: '1', primaryTeacherId: 'teacher-a' }],
  },
  {
    id: 'course-db', courseCode: 'DB302', courseName: 'Database Systems',
    sections: [{ sectionNo: '2', primaryTeacherId: 'teacher-a' }],
  },
  {
    id: 'course-other', courseCode: 'SECRET401', courseName: 'Private Course',
    sections: [{ sectionNo: '9', primaryTeacherId: 'teacher-b' }],
  },
] as Course[];

const rooms = [
  { id: 'room-a', labName: 'B4-08' },
  { id: 'room-b', labName: 'B4-09' },
] as Room[];

const exam = (
  id: string,
  courseId: string,
  sectionNo: string,
  examName: string,
  status: ExamSession['status'],
  format: ExamSession['format'],
  roomId: string,
) => ({ id, courseId, sectionNo, examName, status, format, roomId, examDate: '2026-09-25', startTime: status === 'upcoming' ? '13:00' : '09:00', endTime: status === 'upcoming' ? '16:00' : '11:00' }) as ExamSession;

const sessions = [
  exam('exam-midterm', 'course-net', '1', 'สอบกลางภาค', 'upcoming', 'online', 'room-a'),
  exam('exam-final', 'course-db', '2', 'สอบปลายภาค', 'in_progress', 'offline', 'room-b'),
  exam('exam-lab', 'course-net', '1', 'Lab Test', 'completed', 'offline', 'room-a'),
  exam('exam-other', 'course-other', '9', 'Private Exam', 'upcoming', 'online', 'room-b'),
];

const teacherCourses = coursesForTeacher(courses, 'teacher-a');
const referenceNow = new Date(2026, 8, 25, 10, 0);
const filter = (updates: Partial<TeacherExamFilters> = {}) => filterTeacherExamSessions(
  sessions,
  teacherCourses,
  rooms,
  { ...defaultTeacherExamFilters(), ...updates },
  referenceNow,
).map(({ exam: item }) => item.id);

test('search matches exam name without case sensitivity', () => {
  assert.deepEqual(filter({ search: 'lab test' }), ['exam-lab']);
});

test('search matches Course code without case sensitivity', () => {
  assert.deepEqual(filter({ search: 'net301' }), ['exam-midterm', 'exam-lab']);
});

test('search matches Course name without case sensitivity', () => {
  assert.deepEqual(filter({ search: 'DATABASE SYSTEMS' }), ['exam-final']);
});

test('search matches prefixed Section labels', () => {
  assert.deepEqual(filter({ search: 'Section 2' }), ['exam-final']);
  assert.deepEqual(filter({ search: 'Section 1' }), ['exam-midterm', 'exam-lab']);
});

test('search matches room name and ignores surrounding whitespace', () => {
  assert.deepEqual(filter({ search: '  b4-08  ' }), ['exam-midterm', 'exam-lab']);
});

test('effective status filters cover upcoming, in-progress and completed', () => {
  assert.deepEqual(filter({ status: 'upcoming' }), ['exam-midterm']);
  assert.deepEqual(filter({ status: 'in_progress' }), ['exam-final']);
  assert.deepEqual(filter({ status: 'completed' }), ['exam-lab']);
});

test('mode filters cover online and offline exams', () => {
  assert.deepEqual(filter({ mode: 'online' }), ['exam-midterm']);
  assert.deepEqual(filter({ mode: 'offline' }), ['exam-final', 'exam-lab']);
});

test('combined filters narrow results and can produce an empty filtered state', () => {
  assert.deepEqual(filter({ search: 'NET', status: 'upcoming', mode: 'online' }), ['exam-midterm']);
  assert.deepEqual(filter({ search: 'NET', status: 'completed', mode: 'online' }), []);
});

test('clearing filters restores the authorized full list', () => {
  const filters = { search: 'NET', status: 'completed' as const, mode: 'offline' as const };
  assert.deepEqual(filter(filters), ['exam-lab']);
  assert.deepEqual(defaultTeacherExamFilters(), { search: '', status: 'all', mode: 'all' });
  assert.deepEqual(filter(defaultTeacherExamFilters()), ['exam-midterm', 'exam-final', 'exam-lab']);
});

test('Teacher authorization is applied before every search or filter', () => {
  assert.deepEqual(filter({ search: 'Private' }), []);
  assert.deepEqual(filter({ status: 'upcoming', mode: 'online' }), ['exam-midterm']);
  assert.deepEqual(filterTeacherExamSessions(sessions, coursesForTeacher(courses, 'teacher-b'), rooms, defaultTeacherExamFilters())
    .map(({ exam: item }) => item.id), ['exam-other']);
});

test('stale canonical status moves between filters after its scheduled end', () => {
  const stale = { ...sessions[1], status: 'upcoming' as const };
  const beforeEnd = new Date(2026, 8, 25, 10, 0);
  const afterEnd = new Date(2026, 8, 25, 11, 1);
  const statusIds = (status: TeacherExamFilters['status'], now: Date) => filterTeacherExamSessions(
    [stale], teacherCourses, rooms, { ...defaultTeacherExamFilters(), status }, now,
  ).map(({ exam: item }) => item.id);
  assert.deepEqual(statusIds('in_progress', beforeEnd), ['exam-final']);
  assert.deepEqual(statusIds('in_progress', afterEnd), []);
  assert.deepEqual(statusIds('completed', afterEnd), ['exam-final']);
});

test('canonical filters do not change the independent Draft search', () => {
  const drafts = [{ id: 'draft-a', state: { courseId: 'course-net', sectionNo: '1', examName: 'ร่างกลางภาค' } }] as ExamDraftRecord[];
  assert.deepEqual(filter({ status: 'completed', mode: 'offline' }), ['exam-lab']);
  assert.deepEqual(filterExamDrafts(drafts, teacherCourses, '').map((draft) => draft.id), ['draft-a']);
  assert.deepEqual(filterExamDrafts(drafts, teacherCourses, 'กลางภาค').map((draft) => draft.id), ['draft-a']);
});
