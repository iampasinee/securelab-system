import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExamSession } from '../types';
import { canAdjustExamTime, canEditExamSeats, canEditExamSetup, canReopenExamSubmissions, canSubmitToExam, countEffectiveExamStatuses, examStatusLabels, getEffectiveExamStatus } from './examStatus';

const exam = {
  examDate: '2026-09-25',
  startTime: '09:00',
  endTime: '11:00',
  status: 'in_progress',
} satisfies Pick<ExamSession, 'examDate' | 'startTime' | 'endTime' | 'status'>;

test('one effective status follows the full local schedule and keeps explicit completion', () => {
  assert.equal(getEffectiveExamStatus(exam, new Date(2026, 8, 25, 8, 59)), 'upcoming');
  assert.equal(getEffectiveExamStatus(exam, new Date(2026, 8, 25, 9, 0)), 'in_progress');
  assert.equal(getEffectiveExamStatus(exam, new Date(2026, 8, 25, 11, 0)), 'in_progress');
  assert.equal(getEffectiveExamStatus(exam, new Date(2026, 8, 25, 11, 1)), 'completed');
  assert.equal(getEffectiveExamStatus(exam, new Date(2026, 8, 26, 8, 0)), 'completed');
  assert.equal(getEffectiveExamStatus({ ...exam, examDate: '2026-09-26' }, new Date(2026, 8, 25, 10, 0)), 'upcoming');
  assert.equal(getEffectiveExamStatus({ ...exam, status: 'upcoming' }, new Date(2026, 8, 25, 10, 0)), 'in_progress');
  assert.equal(getEffectiveExamStatus({ ...exam, status: 'completed' }, new Date(2026, 8, 25, 8, 0)), 'completed');
  assert.equal(exam.status, 'in_progress');
});

test('Thai labels are shared across all effective exam statuses', () => {
  assert.deepEqual(examStatusLabels, {
    upcoming: 'กำลังจะเริ่ม',
    in_progress: 'กำลังสอบ',
    completed: 'เสร็จสิ้น',
  });
});

test('Dashboard counts never keep a stale exam active after its end', () => {
  const before = new Date(2026, 8, 25, 8, 0);
  const during = new Date(2026, 8, 25, 10, 0);
  const after = new Date(2026, 8, 25, 11, 1);
  assert.deepEqual(countEffectiveExamStatuses([exam], before), { upcoming: 1, in_progress: 0, completed: 0 });
  assert.deepEqual(countEffectiveExamStatuses([exam], during), { upcoming: 0, in_progress: 1, completed: 0 });
  assert.deepEqual(countEffectiveExamStatuses([exam], after), { upcoming: 0, in_progress: 0, completed: 1 });
});

test('student entry and submission use the effective window with explicit reopening only', () => {
  const before = new Date(2026, 8, 25, 8, 59);
  const during = new Date(2026, 8, 25, 10, 0);
  const after = new Date(2026, 8, 25, 11, 1);
  assert.equal(canSubmitToExam(exam, before), false);
  assert.equal(canSubmitToExam(exam, during), true);
  assert.equal(canSubmitToExam(exam, after), false);
  assert.equal(canSubmitToExam(exam, after, true), true);
  assert.equal(canSubmitToExam(exam, before, true), false);
  assert.equal(canSubmitToExam({ ...exam, status: 'upcoming' }, during), true);
  assert.equal(canSubmitToExam({ ...exam, status: 'completed' }, during), false);
});

test('Teacher edit, seat, time-adjustment and reopening guards follow effective status', () => {
  const before = new Date(2026, 8, 25, 8, 59);
  const during = new Date(2026, 8, 25, 10, 0);
  const after = new Date(2026, 8, 25, 11, 1);
  assert.equal(canEditExamSetup(exam, before), true);
  assert.equal(canEditExamSetup(exam, during), false);
  assert.equal(canEditExamSetup({ ...exam, status: 'upcoming' }, after), false);
  assert.equal(canEditExamSeats(exam, before), true);
  assert.equal(canEditExamSeats(exam, during), true);
  assert.equal(canEditExamSeats(exam, after), false);
  assert.equal(canAdjustExamTime(exam, before), false);
  assert.equal(canAdjustExamTime(exam, during), true);
  assert.equal(canAdjustExamTime(exam, after), false);
  assert.equal(canReopenExamSubmissions(exam, before), false);
  assert.equal(canReopenExamSubmissions({ ...exam, status: 'completed' }, before), false);
  assert.equal(canReopenExamSubmissions(exam, during), true);
  assert.equal(canReopenExamSubmissions(exam, after), true);
});
