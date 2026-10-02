import type { Course, ExamSession, ExamSessionStatus, Room, Violation } from '../types';
import { getEffectiveExamStatus } from './examStatus';

export interface TeacherMonitoringExam {
  exam: ExamSession;
  course: Course;
  section: Course['sections'][number];
}

export interface TeacherMonitoringFilters {
  date: string;
  status: 'all' | ExamSessionStatus;
  courseId: string;
  roomId: string;
  search: string;
}

export type MonitoringView = 'daily' | 'calendar';

export interface MonitoringStatusCounts {
  all: number;
  upcoming: number;
  in_progress: number;
  completed: number;
}

export interface MonitoringDateSummary {
  date: string;
  examCount: number;
}

export interface MonitoringCalendarDateCell {
  date: string;
  isCurrentMonth: boolean;
}

export interface MonitoringMonthSummary {
  totalExams: number;
  dates: MonitoringDateSummary[];
}

export const defaultMonitoringView: MonitoringView = 'daily';

export const getLocalDateInputValue = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Teacher-scoped courses are supplied by AppContext. Requiring a matching
 * Section prevents an exam from becoming visible through its Course alone.
 */
export const getAuthorizedMonitoringExams = (
  examSessions: ExamSession[],
  teacherCourses: Course[],
): TeacherMonitoringExam[] => examSessions.flatMap((exam) => {
  const course = teacherCourses.find((candidate) => candidate.id === exam.courseId);
  const section = course?.sections.find((candidate) => candidate.sectionNo === exam.sectionNo);
  return course && section ? [{ exam, course, section }] : [];
});

export { getEffectiveExamStatus as deriveExamDisplayStatus } from './examStatus';

export const getMonitoringStatusCounts = (
  exams: TeacherMonitoringExam[],
  date?: string,
  now = new Date(),
): MonitoringStatusCounts => exams.reduce<MonitoringStatusCounts>((counts, { exam }) => {
  if (date && exam.examDate !== date) return counts;
  const status = getEffectiveExamStatus(exam, now);
  return {
    ...counts,
    all: counts.all + 1,
    [status]: counts[status] + 1,
  };
}, { all: 0, upcoming: 0, in_progress: 0, completed: 0 });

export const getMonitoringDateSummaries = (
  exams: TeacherMonitoringExam[],
): MonitoringDateSummary[] => {
  const counts = new Map<string, number>();
  exams.forEach(({ exam }) => counts.set(exam.examDate, (counts.get(exam.examDate) || 0) + 1));
  return Array.from(counts, ([date, examCount]) => ({ date, examCount }))
    .sort((first, second) => first.date.localeCompare(second.date));
};

export const formatMonitoringExamCount = (count: number): string => `${count} รอบ`;

export const getMonitoringMonthSummary = (
  exams: TeacherMonitoringExam[],
  year: number,
  monthIndex: number,
): MonitoringMonthSummary => {
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  const dates = getMonitoringDateSummaries(exams)
    .filter((summary) => summary.date.startsWith(monthPrefix));
  return {
    totalExams: dates.reduce((total, summary) => total + summary.examCount, 0),
    dates,
  };
};

export const getCalendarMonthCells = (year: number, monthIndex: number): Array<string | null> => {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > daysInMonth) return null;
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });
};

export const getMonitoringCalendarDateCells = (
  year: number,
  monthIndex: number,
): MonitoringCalendarDateCell[] => {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const gridStart = new Date(year, monthIndex, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    return {
      date: getLocalDateInputValue(date),
      isCurrentMonth: date.getMonth() === monthIndex && date.getFullYear() === year,
    };
  });
};

export const selectMonitoringCalendarDate = (date: string) => ({
  selectedDate: date,
  monitoringView: 'daily' as const,
});

export const clearMonitoringFilters = (
  filters: TeacherMonitoringFilters,
): TeacherMonitoringFilters => ({
  ...filters,
  status: 'all',
  courseId: '',
  roomId: '',
  search: '',
});

export const findAuthorizedMonitoringExam = (
  exams: TeacherMonitoringExam[],
  examSessionId: string,
) => exams.find(({ exam }) => exam.id === examSessionId);

export const getViolationsForMonitoringExam = (
  violations: Violation[],
  examSessionId: string,
) => violations.filter((violation) => violation.examId === examSessionId);

export const filterMonitoringExams = (
  exams: TeacherMonitoringExam[],
  rooms: Room[],
  filters: TeacherMonitoringFilters,
  now = new Date(),
): TeacherMonitoringExam[] => {
  const query = filters.search.trim().toLocaleLowerCase('th');

  return exams.filter(({ exam, course }) => {
    if (exam.examDate !== filters.date) return false;
    if (filters.status !== 'all' && getEffectiveExamStatus(exam, now) !== filters.status) return false;
    if (filters.courseId && exam.courseId !== filters.courseId) return false;
    if (filters.roomId && exam.roomId !== filters.roomId) return false;
    if (!query) return true;

    const roomName = rooms.find((room) => room.id === exam.roomId)?.labName || '';
    return [course.courseCode, course.courseName, exam.examName, exam.sectionNo, `Section ${exam.sectionNo}`, roomName]
      .some((value) => value?.toLocaleLowerCase('th').includes(query));
  });
};
