CREATE TABLE academic_settings (
	id SMALLSERIAL NOT NULL,
	current_academic_year SMALLINT NOT NULL,
	current_semester TEXT DEFAULT '1' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_academic_settings PRIMARY KEY (id),
	CONSTRAINT ck_academic_settings_current_academic_year CHECK (current_academic_year >= 2500),
	CONSTRAINT ck_academic_settings_current_semester CHECK (current_semester IN ('1','2','summer')),
	CONSTRAINT ck_academic_settings_singleton CHECK (id = 1),
	CONSTRAINT ck_academic_settings_row_version CHECK (row_version >= 1)
);

CREATE TABLE faculties (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	code VARCHAR(30) NOT NULL,
	name VARCHAR(150) NOT NULL,
	status TEXT DEFAULT 'active' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_faculties PRIMARY KEY (id),
	CONSTRAINT ck_faculties_status CHECK (status IN ('active','inactive')),
	CONSTRAINT ck_faculties_code CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{0,29}$'),
	CONSTRAINT ck_faculties_name CHECK (length(btrim(name)) > 0),
	CONSTRAINT ck_faculties_row_version CHECK (row_version >= 1)
);

CREATE UNIQUE INDEX uq_faculties_normalized_code ON faculties (lower(code));

CREATE UNIQUE INDEX uq_faculties_normalized_name ON faculties (lower(name));

CREATE TABLE departments (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	faculty_id UUID NOT NULL,
	code VARCHAR(30) NOT NULL,
	name VARCHAR(150) NOT NULL,
	status TEXT DEFAULT 'active' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_departments PRIMARY KEY (id),
	CONSTRAINT ck_departments_status CHECK (status IN ('active','inactive')),
	CONSTRAINT ck_departments_code CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{0,29}$'),
	CONSTRAINT ck_departments_name CHECK (length(btrim(name)) > 0),
	CONSTRAINT ck_departments_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_departments_faculty_id_faculties FOREIGN KEY(faculty_id) REFERENCES faculties (id) ON DELETE RESTRICT
);

CREATE INDEX ix_departments_faculty_id ON departments (faculty_id);

CREATE UNIQUE INDEX uq_departments_normalized_code ON departments (faculty_id, lower(code));

CREATE UNIQUE INDEX uq_departments_normalized_name ON departments (faculty_id, lower(name));

CREATE TABLE majors (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	department_id UUID NOT NULL,
	code VARCHAR(30) NOT NULL,
	name VARCHAR(150) NOT NULL,
	status TEXT DEFAULT 'active' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_majors PRIMARY KEY (id),
	CONSTRAINT ck_majors_status CHECK (status IN ('active','inactive')),
	CONSTRAINT ck_majors_code CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{0,29}$'),
	CONSTRAINT ck_majors_name CHECK (length(btrim(name)) > 0),
	CONSTRAINT ck_majors_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_majors_department_id_departments FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE RESTRICT
);

CREATE INDEX ix_majors_department_id ON majors (department_id);

CREATE UNIQUE INDEX uq_majors_normalized_code ON majors (department_id, lower(code));

CREATE UNIQUE INDEX uq_majors_normalized_name ON majors (department_id, lower(name));

CREATE TABLE class_group_counters (
	major_id UUID NOT NULL,
	admission_year SMALLINT NOT NULL,
	last_sequence INTEGER DEFAULT '0' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_class_group_counters PRIMARY KEY (major_id, admission_year),
	CONSTRAINT ck_class_group_counters_year CHECK (admission_year >= 2500),
	CONSTRAINT ck_class_group_counters_sequence CHECK (last_sequence >= 0),
	CONSTRAINT ck_class_group_counters_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_class_group_counters_major_id_majors FOREIGN KEY(major_id) REFERENCES majors (id) ON DELETE RESTRICT
);

CREATE TABLE class_groups (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	major_id UUID NOT NULL,
	admission_year SMALLINT NOT NULL,
	sequence INTEGER NOT NULL,
	code VARCHAR(80) NOT NULL,
	name VARCHAR(150) NOT NULL,
	status TEXT DEFAULT 'active' NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_class_groups PRIMARY KEY (id),
	CONSTRAINT ck_class_groups_admission_year CHECK (admission_year >= 2500),
	CONSTRAINT ck_class_groups_status CHECK (status IN ('active','inactive')),
	CONSTRAINT ck_class_groups_sequence CHECK (sequence > 0),
	CONSTRAINT uq_class_groups_sequence UNIQUE (major_id, admission_year, sequence),
	CONSTRAINT uq_class_groups_scope UNIQUE (id, major_id, admission_year),
	CONSTRAINT ck_class_groups_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_class_groups_major_id_majors FOREIGN KEY(major_id) REFERENCES majors (id) ON DELETE RESTRICT
);

CREATE INDEX ix_class_groups_major_id ON class_groups (major_id);

CREATE UNIQUE INDEX uq_class_groups_code ON class_groups (major_id, admission_year, lower(code));
