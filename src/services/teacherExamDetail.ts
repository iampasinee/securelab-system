import type { Course, ExamSession } from '../types';
import { teacherCanManageSection } from './courseState';
import { getAuthorizedMonitoringExams } from './teacherMonitoring';

/** Resolve by stable exam ID, then enforce the same Section assignment used by Teacher flows. */
export const resolveAuthorizedExamDetail = (
  examId: string,
  examSessions: ExamSession[],
  teacherCourses: Course[],
  teacherId?: string,
) => {
  if (!teacherId) return undefined;
  return getAuthorizedMonitoringExams(examSessions, teacherCourses)
    .find(({ exam, section }) => exam.id === examId && teacherCanManageSection(section, teacherId));
};
