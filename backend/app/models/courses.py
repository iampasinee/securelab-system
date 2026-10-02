from sqlalchemy import Column, String, Integer, UniqueConstraint, Index, func

from app.models.helpers import table, uuid, choice, check, year


courses = table('courses', uuid(primary=True), Column('code', String(20), nullable=False), Column('name', String(200), nullable=False),
                uuid('department_id', 'departments.id'), *choice('status', 'active/inactive', 'active'),
                check('length(btrim(code)) > 0 AND length(btrim(name)) > 0', 'labels'))
Index('uq_courses_code', func.lower(courses.c.code), unique=True)
course_offerings = table('course_offerings', uuid(primary=True), uuid('course_id', 'courses.id'), *year('academic_year'), *choice('semester', '1/2/summer'),
                        UniqueConstraint('course_id', 'academic_year', 'semester', name='uq_course_offerings_scope'))
sections = table('sections', uuid(primary=True), uuid('offering_id', 'course_offerings.id'), Column('section_number', Integer, nullable=False),
                 *choice('status', 'active/inactive', 'active'), check('section_number > 0', 'number'),
                 UniqueConstraint('offering_id', 'section_number', name='uq_sections_offering_number'))
section_teachers = table('section_teachers', uuid('section_id', 'sections.id', primary=True), uuid('teacher_id', 'teacher_profiles.user_id', primary=True),
                         *choice('assignment_role', 'primary/co'), mutable=False)
Index('uq_section_teachers_primary', section_teachers.c.section_id, unique=True, postgresql_where=section_teachers.c.assignment_role == 'primary')
Index('ix_section_teachers_teacher_id', section_teachers.c.teacher_id)
section_cohorts = table('section_cohorts', uuid(primary=True), uuid('section_id', 'sections.id'), uuid('major_id', 'majors.id'), *year('admission_year'),
                        UniqueConstraint('section_id', 'major_id', 'admission_year', name='uq_section_cohorts_scope'))
section_cohort_groups = table('section_cohort_groups', uuid('cohort_id', 'section_cohorts.id', primary=True), uuid('class_group_id', 'class_groups.id', primary=True), mutable=False)
Index('ix_section_cohort_groups_group', section_cohort_groups.c.class_group_id)
section_student_overrides = table('section_student_overrides', uuid('section_id', 'sections.id', primary=True), uuid('student_id', 'student_profiles.user_id', primary=True),
                                  *choice('mode', 'include/exclude'), uuid('changed_by', 'users.id'))
Index('ix_section_student_overrides_student_id', section_student_overrides.c.student_id)
