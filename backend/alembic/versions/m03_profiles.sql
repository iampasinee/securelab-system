CREATE TABLE student_profiles (
	user_id UUID NOT NULL,
	student_code VARCHAR(15) NOT NULL,
	first_name VARCHAR(150),
	last_name VARCHAR(150),
	first_name_th VARCHAR(150),
	last_name_th VARCHAR(150),
	first_name_en VARCHAR(150),
	last_name_en VARCHAR(150),
	major_id UUID NOT NULL,
	admission_year SMALLINT NOT NULL,
	class_group_id UUID,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_student_profiles PRIMARY KEY (user_id),
	CONSTRAINT ck_student_profiles_admission_year CHECK (admission_year >= 2500),
	CONSTRAINT ck_student_profiles_student_code CHECK (student_code ~ '^[0-9]{10,15}$'),
	CONSTRAINT fk_student_profiles_group_scope FOREIGN KEY(class_group_id, major_id, admission_year) REFERENCES class_groups (id, major_id, admission_year) ON DELETE RESTRICT,
	CONSTRAINT ck_student_profiles_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_student_profiles_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT,
	CONSTRAINT uq_student_profiles_student_code UNIQUE (student_code),
	CONSTRAINT fk_student_profiles_major_id_majors FOREIGN KEY(major_id) REFERENCES majors (id) ON DELETE RESTRICT,
	CONSTRAINT fk_student_profiles_class_group_id_class_groups FOREIGN KEY(class_group_id) REFERENCES class_groups (id) ON DELETE RESTRICT
);

CREATE INDEX ix_student_profiles_admission_year ON student_profiles (admission_year);

CREATE INDEX ix_student_profiles_class_group_id ON student_profiles (class_group_id);

CREATE INDEX ix_student_profiles_major_id ON student_profiles (major_id);

CREATE INDEX ix_student_profiles_scope ON student_profiles (major_id, admission_year, class_group_id, user_id);

CREATE TABLE teacher_profiles (
	user_id UUID NOT NULL,
	teacher_code VARCHAR(30) NOT NULL,
	department_id UUID NOT NULL,
	icit_profile_status TEXT DEFAULT 'pending' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_teacher_profiles PRIMARY KEY (user_id),
	CONSTRAINT ck_teacher_profiles_icit_profile_status CHECK (icit_profile_status IN ('pending','confirmed')),
	CONSTRAINT ck_teacher_profiles_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_teacher_profiles_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT,
	CONSTRAINT fk_teacher_profiles_department_id_departments FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE RESTRICT
);

CREATE INDEX ix_teacher_profiles_department_id ON teacher_profiles (department_id);

CREATE UNIQUE INDEX uq_teacher_profiles_code ON teacher_profiles (lower(teacher_code));
