import assert from 'node:assert/strict';
import test from 'node:test';
import { initialExamSessions, initialStudents, initialSubmissions } from '../data/initialData';
import { canStartStudentExam } from './examStatus';
import {
  canSubmitStudentAttempt,
  createFreshStudentExamAttemptId,
  getStudentAttemptStagingKey,
  isDemoSubmissionRetry,
  recordStudentSubmission,
} from './studentDemoRetry';

const exam = initialExamSessions.find((item) => item.id === 'exam_0001')!;
const student = initialStudents.find((item) => item.id === 'std_0001')!;
const originalSubmission = initialSubmissions.find((item) => item.examId === exam.id && item.studentId === student.id)!;
const afterExam = new Date(2026, 8, 26, 12, 0);

test('completed demo exam can be entered and submitted after the real schedule and final submission', () => {
  const guards = {
    rulesAccepted: true,
    hasFaceReference: Boolean(student.faceReferenceUrl),
    accountActive: student.accountStatus === 'active',
    isEligible: true,
  };
  assert.equal(canStartStudentExam(exam, afterExam, guards), false);
  assert.equal(canStartStudentExam(exam, afterExam, { ...guards, allowDemoTimeBypass: true }), true);
  assert.equal(canStartStudentExam(exam, afterExam, { ...guards, isEligible: false, allowDemoTimeBypass: true }), false);
  assert.equal(canStartStudentExam(exam, afterExam, { ...guards, hasFaceReference: false, allowDemoTimeBypass: true }), false);
  assert.equal(canStartStudentExam(exam, afterExam, { ...guards, rulesAccepted: false, allowDemoTimeBypass: true }), false);
  assert.equal(canSubmitStudentAttempt(exam, afterExam, false, true, true), true);
  assert.equal(canSubmitStudentAttempt(exam, afterExam, false, true, false), false);
});

test('fresh login and demo retry use new student/exam-scoped upload workspaces', () => {
  const firstAttemptId = createFreshStudentExamAttemptId();
  const secondAttemptId = createFreshStudentExamAttemptId();
  assert.notEqual(firstAttemptId, secondAttemptId);

  const firstKey = getStudentAttemptStagingKey(exam.id, student.id, firstAttemptId);
  const currentFiles = new Map([[firstKey, ['answer_1.py', 'answer_2.py']]]);
  const sameAttemptKey = getStudentAttemptStagingKey(exam.id, student.id, firstAttemptId);
  const retryKey = getStudentAttemptStagingKey(exam.id, student.id, secondAttemptId);
  const anotherStudentKey = getStudentAttemptStagingKey(exam.id, 'std_other', firstAttemptId);
  const anotherExamKey = getStudentAttemptStagingKey('exam_other', student.id, firstAttemptId);

  assert.deepEqual(currentFiles.get(sameAttemptKey), ['answer_1.py', 'answer_2.py']);
  assert.equal(currentFiles.get(retryKey), undefined);
  assert.equal(currentFiles.get(anotherStudentKey), undefined);
  assert.equal(currentFiles.get(anotherExamKey), undefined);
  assert.deepEqual(currentFiles.get(firstKey), ['answer_1.py', 'answer_2.py']);
  assert.notEqual(retryKey, `${exam.id}:${student.id}`);
});

test('demo submissions can repeat indefinitely while canonical submission and master data stay unchanged', () => {
  const canonical = [...initialSubmissions];
  const studentSnapshot = structuredClone(student);
  const examSnapshot = structuredClone(exam);
  let demoAttempts: typeof canonical = [];
  for (let index = 1; index <= 3; index += 1) {
    const attempt = {
      ...originalSubmission,
      id: `demo_${index}`,
      submittedAt: new Date(2026, 8, 26, 12, index).toISOString(),
      files: [{ ...originalSubmission.files[0], fileName: `retry_${index}.zip` }],
    };
    const recorded = recordStudentSubmission(canonical, demoAttempts, attempt, isDemoSubmissionRetry(true, false, true));
    assert.equal(recorded.canonical, canonical);
    assert.equal(recorded.demoAttempts.length, index);
    assert.equal(recorded.demoAttempts[index - 1].files[0].fileName, `retry_${index}.zip`);
    demoAttempts = recorded.demoAttempts;
  }
  assert.deepEqual(canonical.find((item) => item.id === originalSubmission.id), originalSubmission);
  assert.deepEqual(student, studentSnapshot);
  assert.deepEqual(exam, examSnapshot);
});

test('non-demo final lock and teacher reopening retain existing behavior', () => {
  const duringExam = new Date(2026, 8, 15, 10, 0);
  assert.equal(canSubmitStudentAttempt(exam, duringExam, false, true, false), false);
  assert.equal(canSubmitStudentAttempt(exam, afterExam, true, true, false), true);
  assert.equal(isDemoSubmissionRetry(true, true, true), false);
  const replacement = { ...originalSubmission, id: 'teacher_reopened' };
  const result = recordStudentSubmission(initialSubmissions, [], replacement, false);
  assert.equal(result.canonical.filter((item) => item.examId === exam.id && item.studentId === student.id).length, 1);
  assert.equal(result.canonical.find((item) => item.id === 'teacher_reopened')?.id, 'teacher_reopened');
  assert.deepEqual(result.demoAttempts, []);
});
