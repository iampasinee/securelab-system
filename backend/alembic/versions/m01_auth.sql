CREATE TABLE users (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	email VARCHAR(254) NOT NULL,
	full_name VARCHAR(200) NOT NULL,
	role TEXT NOT NULL,
	account_status TEXT DEFAULT 'active' NOT NULL,
	status_reason TEXT,
	password_hash TEXT,
	activated_at TIMESTAMP WITH TIME ZONE,
	created_by UUID,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_users PRIMARY KEY (id),
	CONSTRAINT ck_users_role CHECK (role IN ('student','teacher','admin')),
	CONSTRAINT ck_users_account_status CHECK (account_status IN ('active','suspended','graduated_inactive')),
	CONSTRAINT ck_users_full_name CHECK (length(btrim(full_name)) > 0),
	CONSTRAINT ck_users_activation CHECK ((activated_at IS NULL) = (password_hash IS NULL)),
	CONSTRAINT ck_users_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_users_created_by_users FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_users_created_by ON users (created_by);

CREATE INDEX ix_users_role_status ON users (role, account_status, id);

CREATE UNIQUE INDEX uq_users_email ON users (lower(email));

CREATE TABLE admin_profiles (
	user_id UUID NOT NULL,
	admin_code VARCHAR(30) NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_admin_profiles PRIMARY KEY (user_id),
	CONSTRAINT ck_admin_profiles_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_admin_profiles_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_admin_profiles_code ON admin_profiles (lower(admin_code));

CREATE TABLE auth_sessions (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	revoked_at TIMESTAMP WITH TIME ZONE,
	peer_ip INET,
	user_agent VARCHAR(512),
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	row_version BIGINT DEFAULT '1' NOT NULL,
	CONSTRAINT pk_auth_sessions PRIMARY KEY (id),
	CONSTRAINT ck_auth_sessions_expiry CHECK (expires_at > created_at),
	CONSTRAINT ck_auth_sessions_row_version CHECK (row_version >= 1),
	CONSTRAINT fk_auth_sessions_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_auth_sessions_expires ON auth_sessions (expires_at);

CREATE INDEX ix_auth_sessions_user_id ON auth_sessions (user_id);

CREATE TABLE refresh_tokens (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	session_id UUID NOT NULL,
	token_digest BYTEA NOT NULL,
	used_at TIMESTAMP WITH TIME ZONE,
	successor_id UUID,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
	CONSTRAINT ck_refresh_tokens_digest CHECK (octet_length(token_digest) = 32),
	CONSTRAINT fk_refresh_tokens_session_id_auth_sessions FOREIGN KEY(session_id) REFERENCES auth_sessions (id) ON DELETE RESTRICT,
	CONSTRAINT uq_refresh_tokens_token_digest UNIQUE (token_digest),
	CONSTRAINT fk_refresh_tokens_successor_id_refresh_tokens FOREIGN KEY(successor_id) REFERENCES refresh_tokens (id) ON DELETE RESTRICT
);

CREATE INDEX ix_refresh_tokens_session_id ON refresh_tokens (session_id);

CREATE INDEX ix_refresh_tokens_successor_id ON refresh_tokens (successor_id);

CREATE UNIQUE INDEX uq_refresh_tokens_unused ON refresh_tokens (session_id) WHERE used_at IS NULL;

CREATE TABLE account_tokens (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	user_id UUID NOT NULL,
	purpose TEXT NOT NULL,
	token_digest BYTEA NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	used_at TIMESTAMP WITH TIME ZONE,
	revoked_at TIMESTAMP WITH TIME ZONE,
	issued_by UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_account_tokens PRIMARY KEY (id),
	CONSTRAINT ck_account_tokens_purpose CHECK (purpose IN ('activate','reset_password')),
	CONSTRAINT ck_account_tokens_digest CHECK (octet_length(token_digest) = 32),
	CONSTRAINT ck_account_tokens_expiry CHECK (expires_at > created_at),
	CONSTRAINT fk_account_tokens_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT,
	CONSTRAINT uq_account_tokens_token_digest UNIQUE (token_digest),
	CONSTRAINT fk_account_tokens_issued_by_users FOREIGN KEY(issued_by) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_account_tokens_expires ON account_tokens (expires_at);

CREATE INDEX ix_account_tokens_issued_by ON account_tokens (issued_by);

CREATE INDEX ix_account_tokens_user_id ON account_tokens (user_id);

CREATE TABLE audit_logs (
	id UUID DEFAULT gen_random_uuid() NOT NULL,
	actor_id UUID,
	actor_role_snapshot TEXT,
	action VARCHAR(100) NOT NULL,
	target_type VARCHAR(80) NOT NULL,
	target_id UUID,
	outcome TEXT NOT NULL,
	metadata JSONB DEFAULT '{}' NOT NULL,
	peer_ip INET,
	session_id UUID,
	request_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_audit_logs PRIMARY KEY (id),
	CONSTRAINT ck_audit_logs_outcome CHECK (outcome IN ('success','warning','failure')),
	CONSTRAINT ck_audit_logs_metadata CHECK (jsonb_typeof(metadata) = 'object'),
	CONSTRAINT fk_audit_logs_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT,
	CONSTRAINT fk_audit_logs_session_id_auth_sessions FOREIGN KEY(session_id) REFERENCES auth_sessions (id) ON DELETE RESTRICT
);

CREATE INDEX ix_audit_logs_action_created ON audit_logs (action, created_at);

CREATE INDEX ix_audit_logs_actor_id ON audit_logs (actor_id);

CREATE INDEX ix_audit_logs_auth_failures ON audit_logs (created_at, peer_ip) WHERE action = 'auth.login_failure';

CREATE INDEX ix_audit_logs_created ON audit_logs (created_at, id);

CREATE INDEX ix_audit_logs_session_id ON audit_logs (session_id);

CREATE INDEX ix_audit_logs_target ON audit_logs (target_type, target_id, created_at);

CREATE TABLE idempotency_keys (
	actor_id UUID NOT NULL,
	key UUID NOT NULL,
	operation VARCHAR(100) NOT NULL,
	request_digest BYTEA NOT NULL,
	response_status SMALLINT NOT NULL,
	response_body JSONB NOT NULL,
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT pk_idempotency_keys PRIMARY KEY (actor_id, key),
	CONSTRAINT ck_idempotency_keys_digest CHECK (octet_length(request_digest) = 32),
	CONSTRAINT ck_idempotency_keys_response CHECK (jsonb_typeof(response_body) = 'object'),
	CONSTRAINT fk_idempotency_keys_actor_id_users FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_idempotency_keys_expiry ON idempotency_keys (expires_at);
