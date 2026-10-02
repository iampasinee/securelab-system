CREATE TABLE security_settings (
	id SMALLSERIAL NOT NULL,
	multiple_face_detection BOOLEAN NOT NULL,
	looking_away_detection BOOLEAN NOT NULL,
	window_switch_detection BOOLEAN NOT NULL,
	url_whitelist_enforcement BOOLEAN NOT NULL,
	looking_away_threshold_seconds INTEGER NOT NULL,
	allowed_window_switches INTEGER NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_security_settings PRIMARY KEY (id),
	CONSTRAINT ck_security_settings_settings CHECK (id = 1 AND looking_away_threshold_seconds > 0 AND allowed_window_switches >= 0),
	CONSTRAINT ck_security_settings_row_version CHECK (row_version >= 1)
);

CREATE TABLE security_allowed_domains (
	settings_id SMALLINT NOT NULL,
	domain VARCHAR(253) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_security_allowed_domains PRIMARY KEY (settings_id, domain),
	CONSTRAINT fk_security_allowed_domains_settings_id_security_settings FOREIGN KEY(settings_id) REFERENCES security_settings (id) ON DELETE RESTRICT,
	CONSTRAINT ck_security_allowed_domains_domain CHECK (domain = lower(domain) AND length(domain) > 0)
);

CREATE TABLE violations (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	exam_id UUID NOT NULL,
	student_id UUID NOT NULL,
	seat_id UUID,
	source TEXT NOT NULL,
	type TEXT NOT NULL,
	detail TEXT NOT NULL,
	student_seen_at TIMESTAMP WITH TIME ZONE,
	reviewed_at TIMESTAMP WITH TIME ZONE,
	reviewed_by UUID,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_violations PRIMARY KEY (id),
	CONSTRAINT ck_violations_source CHECK (source IN ('development_simulation')),
	CONSTRAINT ck_violations_type CHECK (type IN ('unauthorized_website','duplicate_login','unauthorized_device','tab_switch','peripheral_connected')),
	CONSTRAINT ck_violations_review CHECK ((reviewed_at IS NULL) = (reviewed_by IS NULL)),
	CONSTRAINT fk_violations_participant FOREIGN KEY(exam_id, student_id) REFERENCES exam_participants (exam_id, student_id) ON DELETE RESTRICT,
	CONSTRAINT ck_violations_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_violations_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT,
	CONSTRAINT fk_violations_student_id_student_profiles FOREIGN KEY(student_id) REFERENCES student_profiles (user_id) ON DELETE RESTRICT,
	CONSTRAINT fk_violations_seat_id_room_seats FOREIGN KEY(seat_id) REFERENCES room_seats (id) ON DELETE RESTRICT,
	CONSTRAINT fk_violations_reviewed_by_users FOREIGN KEY(reviewed_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_violations_exam_id ON violations (exam_id);

CREATE INDEX ix_violations_pending ON violations (exam_id, created_at) WHERE reviewed_at IS NULL;

CREATE INDEX ix_violations_reviewed_by ON violations (reviewed_by);

CREATE INDEX ix_violations_seat_id ON violations (seat_id);

CREATE INDEX ix_violations_student_id ON violations (student_id);
