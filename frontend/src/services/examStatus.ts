import type { ExamSession, ExamSessionStatus } from '../types';
import { getServerNow } from './serverClock';

type ScheduledExam = Pick<ExamSession, 'examDate' | 'startTime' | 'endTime' | 'status'> & Partial<Pick<ExamSession, 'startsAt' | 'endsAt'>>;

export const examStatusLabels: Record<ExamSessionStatus, string> = {
  upcoming: 'กำลังจะเริ่ม',
  in_progress: 'กำลังสอบ',
  completed: 'เสร็จสิ้น',
};

const examDateTime = (date: string, time: string): Date => new Date(`${date}T${time}`);

export const getEffectiveExamStatus = (exam: ScheduledExam, now = getServerNow()): ExamSessionStatus => {
  if (exam.startsAt && exam.endsAt) {
    if (now.getTime() >= Date.parse(exam.endsAt)) return 'completed';
    return now.getTime() >= Date.parse(exam.startsAt) ? 'in_progress' : 'upcoming';
  }
  if (exam.status === 'completed') return 'completed';

  const start = examDateTime(exam.examDate, exam.startTime);
  const end = examDateTime(exam.examDate, exam.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return exam.status;
  }

  if (now > end) return 'completed';
  if (now >= start) return 'in_progress';
  return 'upcoming';
};

export const countEffectiveExamStatuses = (exams: ScheduledExam[], now = new Date()) =>
  exams.reduce((counts, exam) => {
    counts[getEffectiveExamStatus(exam, now)] += 1;
    return counts;
  }, { upcoming: 0, in_progress: 0, completed: 0 });

export const canEditExamSetup = (exam: ScheduledExam, now = new Date()): boolean =>
  getEffectiveExamStatus(exam, now) === 'upcoming';

export const canEditExamSeats = (exam: ScheduledExam, now = new Date()): boolean =>
  getEffectiveExamStatus(exam, now) !== 'completed';

export const canAdjustExamTime = (exam: ScheduledExam, now = new Date()): boolean =>
  getEffectiveExamStatus(exam, now) === 'in_progress';

export const canReopenExamSubmissions = (exam: ScheduledExam, now = new Date()): boolean =>
  getEffectiveExamStatus(exam, now) !== 'upcoming' && now >= (exam.startsAt ? new Date(exam.startsAt) : examDateTime(exam.examDate, exam.startTime));

// A Teacher's explicit reopening can permit another submission after the scheduled end.
// It does not change the exam's effective display status or open an exam before its start.
export const canSubmitToExam = (
  exam: ScheduledExam,
  now = new Date(),
  hasActiveReopening = false,
): boolean => getEffectiveExamStatus(exam, now) === 'in_progress' || (
  hasActiveReopening && now >= examDateTime(exam.examDate, exam.startTime)
);

export const canStartStudentExam = (
  exam: ScheduledExam,
  now: Date,
  guards: {
    rulesAccepted: boolean;
    hasFaceReference: boolean;
    accountActive: boolean;
    isEligible: boolean;
    hasActiveReopening?: boolean;
    allowDemoTimeBypass?: boolean;
  },
): boolean => guards.rulesAccepted && guards.hasFaceReference && guards.accountActive && guards.isEligible &&
  (guards.allowDemoTimeBypass || canSubmitToExam(exam, now, guards.hasActiveReopening));
