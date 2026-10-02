import assert from 'node:assert/strict';
import test from 'node:test';
import type { Course, ExamSession } from '../types';
import { canStartStudentExam, countEffectiveExamStatuses, getEffectiveExamStatus } from './examStatus';
import { getDemoTimeState, getEffectiveNow, setDemoTimePreset, subscribeDemoTime } from './demoTime';
import { defaultTeacherExamFilters, filterTeacherExamSessions } from './teacherExamManagement';
import { getAuthorizedMonitoringExams, getMonitoringStatusCounts } from './teacherMonitoring';

const exam = {
  id: 'exam-demo', courseId: 'course-demo', sectionNo: '1', roomId: 'room-demo',
  examDate: '2026-09-25', startTime: '09:00', endTime: '11:00',
  status: 'upcoming', format: 'offline',
} as ExamSession;

const teacherCourses = [{
  id: 'course-demo', courseCode: 'CS301', courseName: 'Data Structures',
  sections: [{ sectionNo: '1', primaryTeacherId: 'teacher-demo' }],
}] as Course[];

test.afterEach(() => setDemoTimePreset('real'));

test('real mode uses supplied real time and switching back clears the override', () => {
  const realNow = new Date(2026, 8, 25, 7, 0);
  assert.equal(getDemoTimeState().enabled, false);
  assert.equal(getEffectiveNow(realNow), realNow);
  assert.equal(setDemoTimePreset('during', exam), true);
  assert.equal(getDemoTimeState().enabled, true);
  assert.equal(setDemoTimePreset('real'), true);
  assert.equal(getDemoTimeState().enabled, false);
  assert.equal(getDemoTimeState().simulatedNow, null);
  assert.equal(getDemoTimeState().preset, 'real');
  assert.equal(getDemoTimeState().examId, null);
  assert.equal(getEffectiveNow(realNow), realNow);
});

test('exam-relative presets publish immediately and never mutate canonical exam fields', () => {
  const original = structuredClone(exam);
  const notifications: string[] = [];
  const unsubscribe = subscribeDemoTime(() => notifications.push(getDemoTimeState().preset));

  assert.equal(setDemoTimePreset('before', exam), true);
  assert.equal(getEffectiveExamStatus(exam, getEffectiveNow()), 'upcoming');
  assert.equal(getEffectiveNow().getTime(), new Date(2026, 8, 25, 8, 55).getTime());
  assert.equal(setDemoTimePreset('during', exam), true);
  assert.equal(getEffectiveExamStatus(exam, getEffectiveNow()), 'in_progress');
  assert.equal(getEffectiveNow().getTime(), new Date(2026, 8, 25, 10, 0).getTime());
  assert.equal(setDemoTimePreset('after', exam), true);
  assert.equal(getEffectiveExamStatus(exam, getEffectiveNow()), 'completed');
  assert.equal(getEffectiveNow().getTime(), new Date(2026, 8, 25, 11, 5).getTime());
  assert.deepEqual(notifications, ['before', 'during', 'after']);
  assert.deepEqual(exam, original);
  unsubscribe();
});

test('invalid or absent schedules never enable a demo override', () => {
  assert.equal(setDemoTimePreset('during'), false);
  assert.equal(setDemoTimePreset('before', { ...exam, startTime: 'invalid' }), false);
  assert.equal(setDemoTimePreset('after', { ...exam, endTime: '08:00' }), false);
  assert.equal(getDemoTimeState().enabled, false);
});

test('Student start guard follows time but retains face, rules, account and eligibility checks', () => {
  const ready = { rulesAccepted: true, hasFaceReference: true, accountActive: true, isEligible: true };
  setDemoTimePreset('before', exam);
  assert.equal(canStartStudentExam(exam, getEffectiveNow(), ready), false);
  setDemoTimePreset('during', exam);
  assert.equal(canStartStudentExam(exam, getEffectiveNow(), ready), true);
  assert.equal(canStartStudentExam(exam, getEffectiveNow(), { ...ready, hasFaceReference: false }), false);
  assert.equal(canStartStudentExam(exam, getEffectiveNow(), { ...ready, rulesAccepted: false }), false);
  assert.equal(canStartStudentExam(exam, getEffectiveNow(), { ...ready, accountActive: false }), false);
  assert.equal(canStartStudentExam(exam, getEffectiveNow(), { ...ready, isEligible: false }), false);
  setDemoTimePreset('after', exam);
  assert.equal(canStartStudentExam(exam, getEffectiveNow(), ready), false);
});

test('the same effective time reaches Teacher monitoring, exam management and Admin counts', () => {
  setDemoTimePreset('during', exam);
  const now = getEffectiveNow();
  assert.equal(getEffectiveExamStatus(exam, now), 'in_progress');
  assert.equal(getMonitoringStatusCounts(getAuthorizedMonitoringExams([exam], teacherCourses), exam.examDate, now).in_progress, 1);
  assert.equal(filterTeacherExamSessions([exam], teacherCourses, [], {
    ...defaultTeacherExamFilters(), status: 'in_progress',
  }, now).length, 1);
  assert.equal(countEffectiveExamStatuses([exam], now).in_progress, 1);
});
