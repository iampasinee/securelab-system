from sqlalchemy import Column, SmallInteger, String, Integer, UniqueConstraint, ForeignKeyConstraint, Index, func

from app.models.helpers import table, uuid, choice, check, year, catalog


academic_settings = table('academic_settings', Column('id', SmallInteger, primary_key=True), *year('current_academic_year'),
                          *choice('current_semester', '1/2/summer', '1'), check('id = 1', 'singleton'))
faculties = catalog('faculties')
departments = catalog('departments', ('faculty_id', 'faculties.id'))
majors = catalog('majors', ('department_id', 'departments.id'))

class_group_counters = table('class_group_counters', uuid('major_id', 'majors.id', primary=True),
                             Column('admission_year', SmallInteger, primary_key=True), Column('last_sequence', Integer, nullable=False, server_default='0'),
                             check('admission_year >= 2500', 'year'), check('last_sequence >= 0', 'sequence'))
class_groups = table('class_groups', uuid(primary=True), uuid('major_id', 'majors.id'), *year('admission_year'),
                     Column('sequence', Integer, nullable=False), Column('code', String(80), nullable=False), Column('name', String(150), nullable=False),
                     *choice('status', 'active/inactive', 'active'), check('sequence > 0', 'sequence'),
                     UniqueConstraint('major_id', 'admission_year', 'sequence', name='uq_class_groups_sequence'),
                     UniqueConstraint('id', 'major_id', 'admission_year', name='uq_class_groups_scope'))
Index('uq_class_groups_code', class_groups.c.major_id, class_groups.c.admission_year, func.lower(class_groups.c.code), unique=True)

student_profiles = table('student_profiles', uuid('user_id', 'users.id', primary=True), Column('student_code', String(15), nullable=False, unique=True),
                         *[Column(name, String(150)) for name in ('first_name', 'last_name', 'first_name_th', 'last_name_th', 'first_name_en', 'last_name_en')],
                         uuid('major_id', 'majors.id'), *year('admission_year'), uuid('class_group_id', 'class_groups.id', True),
                         check("student_code ~ '^[0-9]{10,15}$'", 'student_code'),
                         ForeignKeyConstraint(['class_group_id', 'major_id', 'admission_year'], ['class_groups.id', 'class_groups.major_id', 'class_groups.admission_year'],
                                              name='fk_student_profiles_group_scope', ondelete='RESTRICT'))
Index('ix_student_profiles_scope', student_profiles.c.major_id, student_profiles.c.admission_year, student_profiles.c.class_group_id, student_profiles.c.user_id)
teacher_profiles = table('teacher_profiles', uuid('user_id', 'users.id', primary=True), Column('teacher_code', String(30), nullable=False),
                         uuid('department_id', 'departments.id'), *choice('icit_profile_status', 'pending/confirmed', 'pending'))
Index('uq_teacher_profiles_code', func.lower(teacher_profiles.c.teacher_code), unique=True)
