CREATE TABLE submissions (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	exam_id UUID NOT NULL,
	student_id UUID NOT NULL,
	latest_final_version_id UUID,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_submissions PRIMARY KEY (id),
	CONSTRAINT uq_submissions_owner UNIQUE (exam_id, student_id),
	CONSTRAINT fk_submissions_participant FOREIGN KEY(exam_id, student_id) REFERENCES exam_participants (exam_id, student_id) ON DELETE RESTRICT,
	CONSTRAINT ck_submissions_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_submissions_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT,
	CONSTRAINT fk_submissions_student_id_student_profiles FOREIGN KEY(student_id) REFERENCES student_profiles (user_id) ON DELETE RESTRICT
);

CREATE INDEX ix_submissions_exam_id ON submissions (exam_id);

CREATE INDEX ix_submissions_student_id ON submissions (student_id);

CREATE TABLE submission_reopen_grants (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	exam_id UUID NOT NULL,
	student_id UUID NOT NULL,
	granted_by UUID NOT NULL,
	source_scope TEXT NOT NULL,
	batch_id UUID NOT NULL,
	reason TEXT NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	consumed_at TIMESTAMP WITH TIME ZONE,
	revoked_at TIMESTAMP WITH TIME ZONE,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_submission_reopen_grants PRIMARY KEY (id),
	CONSTRAINT ck_submission_reopen_grants_source_scope CHECK (source_scope IN ('student','room')),
	CONSTRAINT ck_submission_reopen_grants_expiry CHECK (expires_at > created_at),
	CONSTRAINT fk_submission_reopen_grants_participant FOREIGN KEY(exam_id, student_id) REFERENCES exam_participants (exam_id, student_id) ON DELETE RESTRICT,
	CONSTRAINT ck_submission_reopen_grants_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_submission_reopen_grants_exam_id_exam_sessions FOREIGN KEY(exam_id) REFERENCES exam_sessions (id) ON DELETE RESTRICT,
	CONSTRAINT fk_submission_reopen_grants_student_id_student_profiles FOREIGN KEY(student_id) REFERENCES student_profiles (user_id) ON DELETE RESTRICT,
	CONSTRAINT fk_submission_reopen_grants_granted_by_users FOREIGN KEY(granted_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_submission_reopen_grants_exam_id ON submission_reopen_grants (exam_id);

CREATE INDEX ix_submission_reopen_grants_granted_by ON submission_reopen_grants (granted_by);

CREATE INDEX ix_submission_reopen_grants_scope ON submission_reopen_grants (exam_id, student_id, expires_at);

CREATE INDEX ix_submission_reopen_grants_student_id ON submission_reopen_grants (student_id);

CREATE TABLE submission_versions (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	submission_id UUID NOT NULL,
	version_number INTEGER NOT NULL,
	state TEXT DEFAULT 'open' NOT NULL,
	reopen_grant_id UUID,
	started_at TIMESTAMP WITH TIME ZONE NOT NULL,
	rules_accepted_at TIMESTAMP WITH TIME ZONE NOT NULL,
	accepted_exam_revision BIGINT NOT NULL,
	finalized_at TIMESTAMP WITH TIME ZONE,
	finalization_source TEXT,
	deadline_snapshot TIMESTAMP WITH TIME ZONE,
	required_count_snapshot INTEGER,
	timeliness TEXT,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_submission_versions PRIMARY KEY (id),
	CONSTRAINT ck_submission_versions_state CHECK (state IN ('open','final','expired')),
	CONSTRAINT ck_submission_versions_version CHECK (version_number > 0 AND accepted_exam_revision > 0),
	CONSTRAINT ck_submission_versions_source CHECK (finalization_source IS NULL OR finalization_source IN ('manual','timeout')),
	CONSTRAINT ck_submission_versions_timeliness CHECK (timeliness IS NULL OR timeliness IN ('on_time','late')),
	CONSTRAINT ck_submission_versions_final_fields CHECK ((state = 'final') = (finalized_at IS NOT NULL AND finalization_source IS NOT NULL AND deadline_snapshot IS NOT NULL AND required_count_snapshot IS NOT NULL AND timeliness IS NOT NULL)),
	CONSTRAINT uq_submission_versions_number UNIQUE (submission_id, version_number),
	CONSTRAINT uq_submission_versions_owner UNIQUE (submission_id, id),
	CONSTRAINT uq_submission_versions_grant UNIQUE (reopen_grant_id),
	CONSTRAINT ck_submission_versions_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_submission_versions_submission_id_submissions FOREIGN KEY(submission_id) REFERENCES submissions (id) ON DELETE RESTRICT,
	CONSTRAINT fk_submission_versions_reopen_grant_id_submission_reopen_grants FOREIGN KEY(reopen_grant_id) REFERENCES submission_reopen_grants (id) ON DELETE RESTRICT
);

CREATE INDEX ix_submission_versions_reopen_grant_id ON submission_versions (reopen_grant_id);

CREATE INDEX ix_submission_versions_submission_id ON submission_versions (submission_id);

CREATE UNIQUE INDEX uq_submission_versions_initial ON submission_versions (submission_id) WHERE reopen_grant_id IS NULL;

CREATE UNIQUE INDEX uq_submission_versions_open ON submission_versions (submission_id) WHERE state = 'open';

CREATE TABLE submission_files (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	version_id UUID NOT NULL,
	upload_sequence INTEGER NOT NULL,
	original_name VARCHAR(255) NOT NULL,
	submission_name VARCHAR(120) NOT NULL,
	extension VARCHAR(20) NOT NULL,
	client_mime VARCHAR(255),
	expected_size_bytes BIGINT NOT NULL,
	state TEXT DEFAULT 'reserved' NOT NULL,
	receive_started_at TIMESTAMP WITH TIME ZONE,
	received_at TIMESTAMP WITH TIME ZONE,
	size_bytes BIGINT,
	sha256 BYTEA,
	storage_key TEXT,
	failure_code VARCHAR(80),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_submission_files PRIMARY KEY (id),
	CONSTRAINT ck_submission_files_state CHECK (state IN ('reserved','receiving','ready','failed','removed')),
	CONSTRAINT uq_submission_files_sequence UNIQUE (version_id, upload_sequence),
	CONSTRAINT ck_submission_files_intent CHECK (upload_sequence > 0 AND expected_size_bytes > 0),
	CONSTRAINT ck_submission_files_ready CHECK (state <> 'ready' OR (size_bytes > 0 AND sha256 IS NOT NULL AND octet_length(sha256) = 32 AND storage_key IS NOT NULL AND received_at IS NOT NULL)),
	CONSTRAINT ck_submission_files_extension CHECK (extension ~ '^\.[a-z0-9]{1,19}$'),
	CONSTRAINT ck_submission_files_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_submission_files_version_id_submission_versions FOREIGN KEY(version_id) REFERENCES submission_versions (id) ON DELETE RESTRICT,
	CONSTRAINT uq_submission_files_storage_key UNIQUE (storage_key)
);

CREATE INDEX ix_submission_files_version_id ON submission_files (version_id);

CREATE UNIQUE INDEX uq_submission_files_name ON submission_files (version_id, lower(submission_name)) WHERE state != 'removed';

CREATE TABLE file_integrity_checks (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	file_id UUID NOT NULL,
	result TEXT NOT NULL,
	observed_sha256 BYTEA,
	observed_size_bytes BIGINT,
	checked_by UUID,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_file_integrity_checks PRIMARY KEY (id),
	CONSTRAINT ck_file_integrity_checks_result CHECK (result IN ('passed','mismatch','missing')),
	CONSTRAINT ck_file_integrity_checks_digest CHECK (observed_sha256 IS NULL OR octet_length(observed_sha256) = 32),
	CONSTRAINT fk_file_integrity_checks_file_id_submission_files FOREIGN KEY(file_id) REFERENCES submission_files (id) ON DELETE RESTRICT,
	CONSTRAINT fk_file_integrity_checks_checked_by_users FOREIGN KEY(checked_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_file_integrity_checks_checked_by ON file_integrity_checks (checked_by);

CREATE INDEX ix_file_integrity_checks_file_id ON file_integrity_checks (file_id);

ALTER TABLE submissions ADD CONSTRAINT fk_submissions_latest_owner FOREIGN KEY(id, latest_final_version_id) REFERENCES submission_versions (submission_id, id) ON DELETE RESTRICT;
