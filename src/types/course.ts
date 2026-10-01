import { Course, SectionCohort } from '../types';

export interface CourseRecord {
  id: string;
  code: string;
  name: string;
  facultyId: string;
  departmentId: string;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SectionRecord {
  id: string;
  courseId: string;
  sectionNumber: number;
  semester: CourseSemester;
  academicYear: number;
  primaryTeacherId: string;
  coTeacherIds: string[];
  cohorts: SectionCohort[];
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export type CourseStatus = 'active' | 'inactive';
export type CourseSemester = 1 | 2 | 'summer';

export interface CourseInput {
  code: string;
  name: string;
  facultyId: string;
  departmentId: string;
  status: CourseStatus;
}

export interface SectionInput {
  courseId: string;
  sectionNumber: number;
  semester: CourseSemester;
  academicYear: number;
  primaryTeacherId: string;
  coTeacherIds: string[];
  cohorts: SectionCohort[];
  status: CourseStatus;
}

export interface CourseActionResult {
  success: boolean;
  error?: string;
  courseId?: string;
  sectionId?: string;
}

export interface LocatedSection {
  course: Course;
  section: Course['sections'][number];
}
