CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE exam_sessions (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	section_id UUID NOT NULL,
	exam_room_id UUID NOT NULL,
	name VARCHAR(200) NOT NULL,
	exam_type TEXT NOT NULL,
	mode TEXT NOT NULL,
	starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
	scheduled_end_at TIMESTAMP WITH TIME ZONE NOT NULL,
	ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
	max_file_size_bytes BIGINT NOT NULL,
	required_file_count INTEGER NOT NULL,
	filename_pattern VARCHAR(255) NOT NULL,
	automatic_filename_template VARCHAR(255),
	instructions TEXT DEFAULT '' NOT NULL,
	roster_frozen_at TIMESTAMP WITH TIME ZONE,
	created_by UUID NOT NULL,
	course_code_snapshot VARCHAR(20),
	course_name_snapshot VARCHAR(200),
	section_number_snapshot INTEGER,
	academic_year_snapshot SMALLINT,
	semester_snapshot TEXT,
	room_code_snapshot VARCHAR(80),
	floor_number_snapshot SMALLINT,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_exam_sessions PRIMARY KEY (id),
	CONSTRAINT ck_exam_sessions_exam_type CHECK (exam_type IN ('midterm','final','lab','quiz','other')),
	CONSTRAINT ck_exam_sessions_mode CHECK (mode IN ('online','offline')),
	CONSTRAINT ck_exam_sessions_time_range CHECK (ends_at > starts_at AND scheduled_end_at > starts_at),
	CONSTRAINT ck_exam_sessions_same_day CHECK ((starts_at AT TIME ZONE 'Asia/Bangkok')::date = (ends_at AT TIME ZONE 'Asia/Bangkok')::date),
	CONSTRAINT ck_exam_sessions_file_requirements CHECK (max_file_size_bytes BETWEEN 1 AND 524288000 AND required_file_count >= 1),
	CONSTRAINT ex_exam_sessions_room_time EXCLUDE USING gist (exam_room_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&),
	CONSTRAINT ck_exam_sessions_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_exam_sessions_section_id_sections FOREIGN KEY(section_id) REFERENCES sections (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_sessions_exam_room_id_exam_rooms FOREIGN KEY(exam_room_id) REFERENCES exam_rooms (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_sessions_created_by_users FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_exam_sessions_created_by ON exam_sessions (created_by);

CREATE INDEX ix_exam_sessions_exam_room_id ON exam_sessions (exam_room_id);

CREATE INDEX ix_exam_sessions_schedule ON exam_sessions (starts_at, id);

CREATE INDEX ix_exam_sessions_section_id ON exam_sessions (section_id);

CREATE TABLE exam_policies (
	exam_id UUID NOT NULL,
	common_require_registered_device BOOLEAN NOT NULL,
	common_require_agent BOOLEAN NOT NULL,
	common_require_face_before_exam BOOLEAN NOT NULL,
	common_require_periodic_face_check BOOLEAN NOT NULL,
	common_prevent_duplicate_session BOOLEAN NOT NULL,
	common_block_usb_storage BOOLEAN NOT NULL,
	common_log_violations BOOLEAN NOT NULL,
	file_require_exam_workspace BOOLEAN NOT NULL,
	file_require_device_signature BOOLEAN NOT NULL,
	file_lock_after_final_submit BOOLEAN NOT NULL,
	file_block_external_storage_source BOOLEAN NOT NULL,
	online_block_unknown_applications BOOLEAN NOT NULL,
	online_restrict_browser BOOLEAN NOT NULL,
	online_block_communication_apps BOOLEAN NOT NULL,
	online_block_remote_desktop BOOLEAN NOT NULL,
	offline_block_internet BOOLEAN NOT NULL,
	offline_local_server_only BOOLEAN NOT NULL,
	offline_isolate_clients BOOLEAN NOT NULL,
	offline_block_ssh BOOLEAN NOT NULL,
	offline_block_smb BOOLEAN NOT NULL,
	offline_block_ftp BOOLEAN NOT NULL,
	offline_block_scp BOOLEAN NOT NULL,
	offline_block_remote_desktop BOOLEAN NOT NULL,
	offline_block_external_network BOOLEAN NOT NULL,
	resource_mode TEXT NOT NULL,
	local_server_host VARCHAR(255) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_exam_policies PRIMARY KEY (exam_id),
	CONSTRAINT ck_exam_policies_resource_mode CHECK (resource_mode IN ('allowlist','blocklist')),
	CONSTRAINT ck_exam_policies_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_exam_policies_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT
);

CREATE TABLE exam_file_extensions (
	exam_id UUID NOT NULL,
	extension VARCHAR(20) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_exam_file_extensions PRIMARY KEY (exam_id, extension),
	CONSTRAINT ck_exam_file_extensions_extension CHECK (extension ~ '^\.[a-z0-9]{1,19}$'),
	CONSTRAINT fk_exam_file_extensions_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT
);

CREATE TABLE exam_allowed_domains (
	exam_id UUID NOT NULL,
	domain VARCHAR(253) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_exam_allowed_domains PRIMARY KEY (exam_id, domain),
	CONSTRAINT ck_exam_allowed_domains_domain CHECK (domain = lower(domain) AND length(domain) > 0),
	CONSTRAINT fk_exam_allowed_domains_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT
);

CREATE TABLE exam_resources (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	exam_id UUID NOT NULL,
	effect TEXT NOT NULL,
	resource_type TEXT NOT NULL,
	name VARCHAR(200) NOT NULL,
	value VARCHAR(512) NOT NULL,
	category VARCHAR(100),
	sort_order INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_exam_resources PRIMARY KEY (id),
	CONSTRAINT ck_exam_resources_effect CHECK (effect IN ('allow','block')),
	CONSTRAINT ck_exam_resources_resource_type CHECK (resource_type IN ('website','web_app','application')),
	CONSTRAINT ck_exam_resources_order CHECK (sort_order >= 0),
	CONSTRAINT ck_exam_resources_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_exam_resources_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT
);

CREATE INDEX ix_exam_resources_exam_id ON exam_resources (exam_id);

CREATE UNIQUE INDEX uq_exam_resources_value ON exam_resources (exam_id, effect, resource_type, lower(value));

CREATE TABLE exam_rules (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	exam_id UUID NOT NULL,
	text TEXT NOT NULL,
	is_custom BOOLEAN DEFAULT 'false' NOT NULL,
	sort_order INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_exam_rules PRIMARY KEY (id),
	CONSTRAINT ck_exam_rules_text_order CHECK (length(btrim(text)) > 0 AND sort_order >= 0),
	CONSTRAINT uq_exam_rules_order UNIQUE (exam_id, sort_order),
	CONSTRAINT ck_exam_rules_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_exam_rules_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT
);

CREATE INDEX ix_exam_rules_exam_id ON exam_rules (exam_id);

CREATE TABLE exam_participants (
	exam_id UUID NOT NULL,
	student_id UUID NOT NULL,
	student_code_snapshot VARCHAR(15) NOT NULL,
	name_snapshot VARCHAR(200) NOT NULL,
	major_id UUID NOT NULL,
	admission_year_snapshot SMALLINT NOT NULL,
	class_group_id UUID,
	faculty_name_snapshot VARCHAR(150) NOT NULL,
	department_name_snapshot VARCHAR(150) NOT NULL,
	major_code_snapshot VARCHAR(30) NOT NULL,
	major_name_snapshot VARCHAR(150) NOT NULL,
	class_group_code_snapshot VARCHAR(80),
	membership_source TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_exam_participants PRIMARY KEY (exam_id, student_id),
	CONSTRAINT ck_exam_participants_membership_source CHECK (membership_source IN ('cohort','include')),
	CONSTRAINT fk_exam_participants_group_scope FOREIGN KEY(class_group_id, major_id, admission_year_snapshot) REFERENCES class_groups (id, major_id, admission_year) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_participants_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_participants_student_id_student_profiles FOREIGN KEY(student_id) REFERENCES student_profiles (user_id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_participants_major_id_majors FOREIGN KEY(major_id) REFERENCES majors (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_participants_class_group_id_class_groups FOREIGN KEY(class_group_id) REFERENCES class_groups (id) ON DELETE RESTRICT
);

CREATE INDEX ix_exam_participants_admission_year_snapshot ON exam_participants (admission_year_snapshot);

CREATE INDEX ix_exam_participants_class_group_id ON exam_participants (class_group_id);

CREATE INDEX ix_exam_participants_major_id ON exam_participants (major_id);

CREATE TABLE exam_seat_assignments (
	exam_id UUID NOT NULL,
	student_id UUID NOT NULL,
	seat_id UUID NOT NULL,
	device_id UUID NOT NULL,
	assigned_by UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_exam_seat_assignments PRIMARY KEY (exam_id, student_id),
	CONSTRAINT uq_exam_seat_assignments_seat UNIQUE (exam_id, seat_id),
	CONSTRAINT uq_exam_seat_assignments_device UNIQUE (exam_id, device_id),
	CONSTRAINT ck_exam_seat_assignments_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_exam_seat_assignments_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_seat_assignments_student_id_student_profiles FOREIGN KEY(student_id) REFERENCES student_profiles (user_id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_seat_assignments_seat_id_room_seats FOREIGN KEY(seat_id) REFERENCES room_seats (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_seat_assignments_device_id_computer_devices FOREIGN KEY(device_id) REFERENCES computer_devices (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_seat_assignments_assigned_by_users FOREIGN KEY(assigned_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_exam_seat_assignments_assigned_by ON exam_seat_assignments (assigned_by);

CREATE INDEX ix_exam_seat_assignments_device_id ON exam_seat_assignments (device_id);

CREATE INDEX ix_exam_seat_assignments_seat_id ON exam_seat_assignments (seat_id);

CREATE TABLE exam_seat_assignment_events (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	exam_id UUID NOT NULL,
	student_id UUID NOT NULL,
	seat_id UUID NOT NULL,
	device_id UUID NOT NULL,
	action TEXT NOT NULL,
	actor_id UUID NOT NULL,
	seat_code_snapshot VARCHAR(16) NOT NULL,
	device_code_snapshot VARCHAR(80) NOT NULL,
	ip_snapshot VARCHAR(45) NOT NULL,
	mac_snapshot VARCHAR(17) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_exam_seat_assignment_events PRIMARY KEY (id),
	CONSTRAINT ck_exam_seat_assignment_events_action CHECK (action IN ('assign','unassign')),
	CONSTRAINT fk_exam_seat_assignment_events_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_seat_assignment_events_student_id_student_profiles FOREIGN KEY(student_id) REFERENCES student_profiles (user_id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_seat_assignment_events_seat_id_room_seats FOREIGN KEY(seat_id) REFERENCES room_seats (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_seat_assignment_events_device_id_computer_devices FOREIGN KEY(device_id) REFERENCES computer_devices (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_seat_assignment_events_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_exam_seat_assignment_events_actor_id ON exam_seat_assignment_events (actor_id);

CREATE INDEX ix_exam_seat_assignment_events_device_id ON exam_seat_assignment_events (device_id);

CREATE INDEX ix_exam_seat_assignment_events_exam_id ON exam_seat_assignment_events (exam_id);

CREATE INDEX ix_exam_seat_assignment_events_seat_id ON exam_seat_assignment_events (seat_id);

CREATE INDEX ix_exam_seat_assignment_events_student_id ON exam_seat_assignment_events (student_id);

CREATE TABLE exam_time_adjustments (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	exam_id UUID NOT NULL,
	actor_id UUID NOT NULL,
	delta_minutes INTEGER NOT NULL,
	previous_end_at TIMESTAMP WITH TIME ZONE NOT NULL,
	next_end_at TIMESTAMP WITH TIME ZONE NOT NULL,
	reason TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_exam_time_adjustments PRIMARY KEY (id),
	CONSTRAINT ck_exam_time_adjustments_delta CHECK (delta_minutes <> 0 AND next_end_at = previous_end_at + delta_minutes * interval '1 minute'),
	CONSTRAINT fk_exam_time_adjustments_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT,
	CONSTRAINT fk_exam_time_adjustments_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_exam_time_adjustments_actor_id ON exam_time_adjustments (actor_id);

CREATE INDEX ix_exam_time_adjustments_exam_id ON exam_time_adjustments (exam_id);
