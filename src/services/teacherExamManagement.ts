import type { Course, ExamSession, ExamSessionStatus, Room } from '../types';
import { getAuthorizedMonitoringExams } from './teacherMonitoring';
import { getEffectiveExamStatus } from './examStatus';

export interface TeacherExamFilters {
  search: string;
  status: 'all' | ExamSessionStatus;
  mode: 'all' | ExamSession['format'];
}

export const defaultTeacherExamFilters = (): TeacherExamFilters => ({
  search: '',
  status: 'all',
  mode: 'all',
});

export const filterTeacherExamSessions = (
  examSessions: ExamSession[],
  teacherCourses: Course[],
  rooms: Room[],
  filters: TeacherExamFilters,
  now = new Date(),
) => {
  const query = filters.search.trim().toLocaleLowerCase('th');
  const roomNames = new Map(rooms.map((room) => [room.id, room.labName]));

  return getAuthorizedMonitoringExams(examSessions, teacherCourses).filter(({ exam, course }) => {
    if (filters.status !== 'all' && getEffectiveExamStatus(exam, now) !== filters.status) return false;
    if (filters.mode !== 'all' && exam.format !== filters.mode) return false;
    if (!query) return true;

    return [
      exam.examName,
      course.courseCode,
      course.courseName,
      exam.sectionNo,
      `Section ${exam.sectionNo}`,
      roomNames.get(exam.roomId),
      exam.examDate,
    ].some((value) => value?.toLocaleLowerCase('th').includes(query));
  });
};
