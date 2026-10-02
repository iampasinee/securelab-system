CREATE TABLE courses (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	code VARCHAR(20) NOT NULL,
	name VARCHAR(200) NOT NULL,
	department_id UUID NOT NULL,
	status TEXT DEFAULT 'active' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_courses PRIMARY KEY (id),
	CONSTRAINT ck_courses_status CHECK (status IN ('active','inactive')),
	CONSTRAINT ck_courses_labels CHECK (length(btrim(code)) > 0 AND length(btrim(name)) > 0),
	CONSTRAINT ck_courses_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_courses_department_id_departments FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE RESTRICT
);

CREATE INDEX ix_courses_department_id ON courses (department_id);

CREATE UNIQUE INDEX uq_courses_code ON courses (lower(code));

CREATE TABLE course_offerings (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	course_id UUID NOT NULL,
	academic_year SMALLINT NOT NULL,
	semester TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_course_offerings PRIMARY KEY (id),
	CONSTRAINT ck_course_offerings_academic_year CHECK (academic_year >= 2500),
	CONSTRAINT ck_course_offerings_semester CHECK (semester IN ('1','2','summer')),
	CONSTRAINT uq_course_offerings_scope UNIQUE (course_id, academic_year, semester),
	CONSTRAINT ck_course_offerings_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_course_offerings_course_id_courses FOREIGN KEY(course_id) REFERENCES courses (id) ON DELETE RESTRICT
);

CREATE INDEX ix_course_offerings_course_id ON course_offerings (course_id);

CREATE TABLE sections (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	offering_id UUID NOT NULL,
	section_number INTEGER NOT NULL,
	status TEXT DEFAULT 'active' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_sections PRIMARY KEY (id),
	CONSTRAINT ck_sections_status CHECK (status IN ('active','inactive')),
	CONSTRAINT ck_sections_number CHECK (section_number > 0),
	CONSTRAINT uq_sections_offering_number UNIQUE (offering_id, section_number),
	CONSTRAINT ck_sections_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_sections_offering_id_course_offerings FOREIGN KEY(offering_id) REFERENCES course_offerings (id) ON DELETE RESTRICT
);

CREATE INDEX ix_sections_offering_id ON sections (offering_id);

CREATE TABLE section_teachers (
	section_id UUID NOT NULL,
	teacher_id UUID NOT NULL,
	assignment_role TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_section_teachers PRIMARY KEY (section_id, teacher_id),
	CONSTRAINT ck_section_teachers_assignment_role CHECK (assignment_role IN ('primary','co')),
	CONSTRAINT fk_section_teachers_section_id_sections FOREIGN KEY(section_id) REFERENCES sections (id) ON DELETE RESTRICT,
	CONSTRAINT fk_section_teachers_teacher_id_teacher_profiles FOREIGN KEY(teacher_id) REFERENCES teacher_profiles (user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_section_teachers_primary ON section_teachers (section_id) WHERE assignment_role = 'primary';

CREATE TABLE section_cohorts (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	section_id UUID NOT NULL,
	major_id UUID NOT NULL,
	admission_year SMALLINT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_section_cohorts PRIMARY KEY (id),
	CONSTRAINT ck_section_cohorts_admission_year CHECK (admission_year >= 2500),
	CONSTRAINT uq_section_cohorts_scope UNIQUE (section_id, major_id, admission_year),
	CONSTRAINT ck_section_cohorts_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_section_cohorts_section_id_sections FOREIGN KEY(section_id) REFERENCES sections (id) ON DELETE RESTRICT,
	CONSTRAINT fk_section_cohorts_major_id_majors FOREIGN KEY(major_id) REFERENCES majors (id) ON DELETE RESTRICT
);

CREATE INDEX ix_section_cohorts_major_id ON section_cohorts (major_id);

CREATE INDEX ix_section_cohorts_section_id ON section_cohorts (section_id);

CREATE TABLE section_cohort_groups (
	cohort_id UUID NOT NULL,
	class_group_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_section_cohort_groups PRIMARY KEY (cohort_id, class_group_id),
	CONSTRAINT fk_section_cohort_groups_cohort_id_section_cohorts FOREIGN KEY(cohort_id) REFERENCES section_cohorts (id) ON DELETE RESTRICT,
	CONSTRAINT fk_section_cohort_groups_class_group_id_class_groups FOREIGN KEY(class_group_id) REFERENCES class_groups (id) ON DELETE RESTRICT
);

CREATE TABLE section_student_overrides (
	section_id UUID NOT NULL,
	student_id UUID NOT NULL,
	mode TEXT NOT NULL,
	changed_by UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_section_student_overrides PRIMARY KEY (section_id, student_id),
	CONSTRAINT ck_section_student_overrides_mode CHECK (mode IN ('include','exclude')),
	CONSTRAINT ck_section_student_overrides_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_section_student_overrides_section_id_sections FOREIGN KEY(section_id) REFERENCES sections (id) ON DELETE RESTRICT,
	CONSTRAINT fk_section_student_overrides_student_id_student_profiles FOREIGN KEY(student_id) REFERENCES student_profiles (user_id) ON DELETE RESTRICT,
	CONSTRAINT fk_section_student_overrides_changed_by_users FOREIGN KEY(changed_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_section_student_overrides_changed_by ON section_student_overrides (changed_by);
