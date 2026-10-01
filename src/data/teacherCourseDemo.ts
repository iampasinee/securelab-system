import type { Course } from '../types';

/** Adds the demo teacher to the untouched CS301 Section 2 without changing its roster or primary teacher. */
export const addCs301DemoCoTeacher = (courses: Course[]): Course[] => courses.map((course) => {
  if (course.id !== 'crs_0001' || course.courseCode !== 'CS301' || course.status !== 'active' || course.sections.length !== 2) return course;
  return {
    ...course,
    sections: course.sections.map((section) => {
      const untouchedSeed = section.sectionNo === '2' && section.academicYear === 2569 &&
        String(section.semester) === '1' && section.status === 'active' && section.studentCount === 35 &&
        (section.primaryTeacherId || section.teacherId) === 'tch_0002' &&
        !section.coTeacherIds?.length && !section.includedStudentIds?.length && !section.excludedStudentIds?.length &&
        section.cohorts?.length === 1 && section.cohorts[0].majorId === 'program_ine' &&
        section.cohorts[0].admissionYear === 2567 && !section.cohorts[0].classGroupIds?.length;
      return untouchedSeed ? { ...section, coTeacherIds: ['tch_0001'] } : section;
    }),
  };
});
