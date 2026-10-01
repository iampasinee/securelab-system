import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Course, ExamSession, Room } from '../types';
import { MonitoringCalendar } from '../components/teacher/MonitoringCalendar';
import { MonitoringExamStatusBadge } from '../components/teacher/LiveExamMonitoring';
import {
  clearMonitoringFilters,
  defaultMonitoringView,
  deriveExamDisplayStatus,
  filterMonitoringExams,
  findAuthorizedMonitoringExam,
  formatMonitoringExamCount,
  getCalendarMonthCells,
  getMonitoringCalendarDateCells,
  getAuthorizedMonitoringExams,
  getLocalDateInputValue,
  getMonitoringDateSummaries,
  getMonitoringMonthSummary,
  getMonitoringStatusCounts,
  getViolationsForMonitoringExam,
  selectMonitoringCalendarDate,
} from './teacherMonitoring';

const section = (sectionNo: string, teacherId: string) => ({
  sectionNo,
  semester: 1,
  academicYear: 2026,
  teacherId,
  primaryTeacherId: teacherId,
  cohorts: [{ majorId: 'major_inet', admissionYear: 2567 }],
});

const courses: Course[] = [
  {
    id: 'course-a', courseCode: 'NET301', courseName: 'Network Security', faculty: '', department: '', status: 'active',
    sections: [section('1', 'teacher-a')],
  },
  {
    id: 'course-b', courseCode: 'DB302', courseName: 'Database Systems', faculty: '', department: '', status: 'active',
    sections: [section('2', 'teacher-a')],
  },
];

const exam = (
  id: string,
  courseId: string,
  sectionNo: string,
  examDate: string,
  roomId: string,
  status: ExamSession['status'],
): ExamSession => ({
  id,
  courseId,
  sectionNo,
  examDate,
  startTime: '09:00',
  endTime: '12:00',
  durationMinutes: 180,
  roomId,
  format: 'offline',
  fileRequirements: {
    acceptedExtensions: ['.zip'], maxSizeMb: 25, filenamePattern: '{studentCode}', requiredFileCount: 1, instructions: '',
  },
  rules: [],
  status,
});

const sessions = [
  exam('exam-a', 'course-a', '1', '2026-09-25', 'room-a', 'in_progress'),
  { ...exam('exam-b', 'course-b', '2', '2026-09-25', 'room-b', 'upcoming'), startTime: '13:00', endTime: '16:00' },
  exam('exam-c', 'course-a', '1', '2026-09-25', 'room-b', 'completed'),
  exam('exam-other-day', 'course-a', '1', '2026-09-26', 'room-a', 'upcoming'),
  exam('exam-other-teacher', 'course-a', '9', '2026-09-25', 'room-a', 'upcoming'),
];

const rooms = [
  { id: 'room-a', labName: 'B4-08' },
  { id: 'room-b', labName: 'B4-09' },
] as Room[];

const referenceNow = new Date(2026, 8, 25, 10, 0);

test('display status uses full local exam date and time over stale canonical status', () => {
  const scheduled = exam('scheduled', 'course-a', '1', '2026-09-15', 'room-a', 'in_progress');
  scheduled.endTime = '11:00';

  assert.equal(deriveExamDisplayStatus(scheduled, new Date(2026, 8, 15, 8, 59)), 'upcoming');
  assert.equal(deriveExamDisplayStatus(scheduled, new Date(2026, 8, 15, 9, 0)), 'in_progress');
  assert.equal(deriveExamDisplayStatus(scheduled, new Date(2026, 8, 15, 11, 0)), 'in_progress');
  assert.equal(deriveExamDisplayStatus(scheduled, new Date(2026, 8, 15, 11, 1)), 'completed');
  assert.equal(deriveExamDisplayStatus(scheduled, new Date(2026, 8, 16, 8, 0)), 'completed');
  assert.equal(deriveExamDisplayStatus({ ...scheduled, examDate: '2026-09-16' }, new Date(2026, 8, 15, 12, 0)), 'upcoming');
  assert.equal(deriveExamDisplayStatus({ ...scheduled, status: 'upcoming' }, new Date(2026, 8, 15, 10, 0)), 'in_progress');
  assert.equal(deriveExamDisplayStatus({ ...scheduled, status: 'completed' }, new Date(2026, 8, 15, 8, 0)), 'completed');
});

test('daily counters and status filters move an ended exam together', () => {
  const endedExam = {
    ...exam('ended', 'course-a', '1', '2026-09-15', 'room-a', 'in_progress'),
    endTime: '11:00',
  };
  const authorized = getAuthorizedMonitoringExams([endedExam], courses);
  const filters = { date: '2026-09-15', status: 'in_progress' as const, courseId: '', roomId: '', search: '' };
  const duringExam = new Date(2026, 8, 15, 10, 59);
  const afterExam = new Date(2026, 8, 15, 11, 1);

  assert.deepEqual(getMonitoringStatusCounts(authorized, filters.date, duringExam), {
    all: 1, upcoming: 0, in_progress: 1, completed: 0,
  });
  assert.deepEqual(filterMonitoringExams(authorized, rooms, filters, duringExam).map(({ exam: item }) => item.id), ['ended']);
  assert.deepEqual(getMonitoringStatusCounts(authorized, filters.date, afterExam), {
    all: 1, upcoming: 0, in_progress: 0, completed: 1,
  });
  assert.deepEqual(filterMonitoringExams(authorized, rooms, filters, afterExam), []);
  assert.deepEqual(filterMonitoringExams(authorized, rooms, { ...filters, status: 'completed' }, afterExam).map(({ exam: item }) => item.id), ['ended']);
  assert.equal(deriveExamDisplayStatus(endedExam, afterExam), 'completed');
  const cardBadge = renderToStaticMarkup(React.createElement(MonitoringExamStatusBadge, { exam: endedExam, now: afterExam }));
  const detailBadge = renderToStaticMarkup(React.createElement(MonitoringExamStatusBadge, { exam: endedExam, now: afterExam, compact: true }));
  assert.match(cardBadge, /เสร็จสิ้น/);
  assert.match(detailBadge, /เสร็จสิ้น/);
  assert.doesNotMatch(cardBadge + detailBadge, /กำลังสอบ/);
});

test('selected date defaults to a local YYYY-MM-DD value', () => {
  assert.equal(getLocalDateInputValue(new Date(2026, 8, 25, 23, 30)), '2026-09-25');
  assert.equal(defaultMonitoringView, 'daily');
});

test('authorization requires the exact Teacher Course and Section assignment', () => {
  const authorized = getAuthorizedMonitoringExams(sessions, courses);
  assert.deepEqual(authorized.map(({ exam: item }) => item.id), ['exam-a', 'exam-b', 'exam-c', 'exam-other-day']);
});

test('daily overview includes every authorized exam on the selected date', () => {
  const authorized = getAuthorizedMonitoringExams(sessions, courses);
  const result = filterMonitoringExams(authorized, rooms, {
    date: '2026-09-25', status: 'all', courseId: '', roomId: '', search: '',
  }, referenceNow);
  assert.deepEqual(result.map(({ exam: item }) => item.id), ['exam-a', 'exam-b', 'exam-c']);
});

test('status, Course, Room and search filters remain independent', () => {
  const authorized = getAuthorizedMonitoringExams(sessions, courses);
  const base = { date: '2026-09-25', status: 'all' as const, courseId: '', roomId: '', search: '' };

  assert.deepEqual(filterMonitoringExams(authorized, rooms, { ...base, status: 'in_progress' }, referenceNow).map((item) => item.exam.id), ['exam-a']);
  assert.deepEqual(filterMonitoringExams(authorized, rooms, { ...base, courseId: 'course-b' }).map((item) => item.exam.id), ['exam-b']);
  assert.deepEqual(filterMonitoringExams(authorized, rooms, { ...base, roomId: 'room-b' }).map((item) => item.exam.id), ['exam-b', 'exam-c']);
  assert.deepEqual(filterMonitoringExams(authorized, rooms, { ...base, search: 'network' }).map((item) => item.exam.id), ['exam-a', 'exam-c']);
});

test('an alternate date without exams returns the empty state collection', () => {
  const authorized = getAuthorizedMonitoringExams(sessions, courses);
  assert.equal(filterMonitoringExams(authorized, rooms, {
    date: '2026-10-01', status: 'all', courseId: '', roomId: '', search: '',
  }).length, 0);
});

test('schedule summaries count only authorized exams without live-status categories', () => {
  const authorized = getAuthorizedMonitoringExams(sessions, courses);
  const summaries = getMonitoringDateSummaries(authorized);
  assert.deepEqual(summaries, [
    { date: '2026-09-25', examCount: 3 },
    { date: '2026-09-26', examCount: 1 },
  ]);
  assert.equal(summaries.find(({ date }) => date === '2026-09-22'), undefined);
  assert.equal(formatMonitoringExamCount(1), '1 รอบ');
  assert.equal(formatMonitoringExamCount(3), '3 รอบ');
  assert.deepEqual(getMonitoringStatusCounts(authorized, '2026-09-25', referenceNow), {
    all: 3, in_progress: 1, upcoming: 1, completed: 1,
  });
});

test('calendar month cells and date selection share the Daily Overview date state', () => {
  const cells = getCalendarMonthCells(2026, 8);
  assert.equal(cells.length, 42);
  assert.ok(cells.includes('2026-09-25'));
  assert.deepEqual(selectMonitoringCalendarDate('2026-09-25'), {
    selectedDate: '2026-09-25', monitoringView: 'daily',
  });
});

test('popover month grid includes adjacent dates and authorized monthly totals', () => {
  const authorized = getAuthorizedMonitoringExams(sessions, courses);
  const cells = getMonitoringCalendarDateCells(2026, 8);
  const month = getMonitoringMonthSummary(authorized, 2026, 8);

  assert.equal(cells.length, 42);
  assert.deepEqual(cells.find((cell) => cell.date === '2026-09-25'), {
    date: '2026-09-25',
    isCurrentMonth: true,
  });
  assert.ok(cells.some((cell) => !cell.isCurrentMonth));
  assert.equal(month.totalExams, 4);
  assert.deepEqual(month.dates, [
    { date: '2026-09-25', examCount: 3 },
    { date: '2026-09-26', examCount: 1 },
  ]);
});

test('full calendar renders only session counts, including quick dates, without status markers', () => {
  const authorized = getAuthorizedMonitoringExams(sessions, courses);
  const markup = renderToStaticMarkup(React.createElement(MonitoringCalendar, {
    exams: authorized,
    selectedDate: '2026-09-25',
    onSelectDate: () => undefined,
    onShowDaily: () => undefined,
  }));

  assert.match(markup, /25 กันยายน 2569 มีการสอบ 3 รอบ/);
  assert.match(markup, /26 กันยายน 2569 มีการสอบ 1 รอบ/);
  assert.match(markup, /22 กันยายน 2569 ไม่มีการสอบ/);
  assert.match(markup, /25 ก.ย. 2569/);
  assert.match(markup, /3 รอบ/);
  assert.doesNotMatch(markup, /0 รอบ|กำลังสอบ|กำลังจะเริ่ม|เสร็จสิ้น|bg-emerald-500|bg-amber-500|bg-gray-400/);
});

test('status counter filtering, rich search and clear filters preserve the selected date', () => {
  const authorized = getAuthorizedMonitoringExams(sessions, courses);
  const base = { date: '2026-09-25', status: 'all' as const, courseId: '', roomId: '', search: '' };
  assert.deepEqual(filterMonitoringExams(authorized, rooms, { ...base, status: 'completed' }, referenceNow).map((item) => item.exam.id), ['exam-c']);
  assert.deepEqual(filterMonitoringExams(authorized, rooms, { ...base, search: 'Section 2' }).map((item) => item.exam.id), ['exam-b']);
  assert.deepEqual(clearMonitoringFilters({ ...base, status: 'in_progress', courseId: 'course-a', roomId: 'room-a', search: 'NET' }), base);
});

test('detail selection and violations use stable ExamSession ID', () => {
  const authorized = getAuthorizedMonitoringExams(sessions, courses);
  assert.equal(findAuthorizedMonitoringExam(authorized, 'exam-b')?.course.id, 'course-b');
  assert.equal(findAuthorizedMonitoringExam(authorized, 'missing'), undefined);
  const violations = [
    { id: 'v1', examId: 'exam-a', studentId: 'student-a' },
    { id: 'v2', examId: 'exam-b', studentId: 'student-b' },
  ] as never[];
  assert.deepEqual(getViolationsForMonitoringExam(violations, 'exam-a').map((item) => item.id), ['v1']);
});
