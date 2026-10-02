from sqlalchemy import Column, String, Text, LargeBinary, CheckConstraint, Index, SmallInteger, func
from sqlalchemy.dialects.postgresql import INET, JSONB

from app.models.helpers import table, uuid, timestamp, choice, check


users = table('users', uuid(primary=True), Column('email', String(254), nullable=False), Column('full_name', String(200), nullable=False),
              *choice('role', 'student/teacher/admin'), *choice('account_status', 'active/suspended/graduated_inactive', 'active'),
              Column('status_reason', Text), Column('password_hash', Text), timestamp('activated_at', True), uuid('created_by', 'users.id', True),
              check("length(btrim(full_name)) > 0", 'full_name'), check('(activated_at IS NULL) = (password_hash IS NULL)', 'activation'))
Index('uq_users_email', func.lower(users.c.email), unique=True)
Index('ix_users_role_status', users.c.role, users.c.account_status, users.c.id)

admin_profiles = table('admin_profiles', uuid('user_id', 'users.id', primary=True), Column('admin_code', String(30), nullable=False))
Index('uq_admin_profiles_code', func.lower(admin_profiles.c.admin_code), unique=True)

auth_sessions = table('auth_sessions', uuid(primary=True), uuid('user_id', 'users.id'), timestamp('expires_at'), timestamp('revoked_at', True),
                      Column('peer_ip', INET), Column('user_agent', String(512)), check('expires_at > created_at', 'expiry'))
Index('ix_auth_sessions_expires', auth_sessions.c.expires_at)

refresh_tokens = table('refresh_tokens', uuid(primary=True), uuid('session_id', 'auth_sessions.id'), Column('token_digest', LargeBinary, nullable=False, unique=True),
                       timestamp('used_at', True), uuid('successor_id', 'refresh_tokens.id', True), check('octet_length(token_digest) = 32', 'digest'), mutable=False)
Index('uq_refresh_tokens_unused', refresh_tokens.c.session_id, unique=True, postgresql_where=refresh_tokens.c.used_at.is_(None))

account_tokens = table('account_tokens', uuid(primary=True), uuid('user_id', 'users.id'), *choice('purpose', 'activate/reset_password'),
                       Column('token_digest', LargeBinary, nullable=False, unique=True), timestamp('expires_at'), timestamp('used_at', True),
                       timestamp('revoked_at', True), uuid('issued_by', 'users.id'), check('octet_length(token_digest) = 32', 'digest'),
                       check('expires_at > created_at', 'expiry'), mutable=False)
Index('ix_account_tokens_expires', account_tokens.c.expires_at)

audit_logs = table('audit_logs', uuid(primary=True), uuid('actor_id', 'users.id', True), Column('actor_role_snapshot', Text),
                  Column('action', String(100), nullable=False), Column('target_type', String(80), nullable=False), uuid('target_id', nullable=True),
                  *choice('outcome', 'success/warning/failure'), Column('metadata', JSONB, nullable=False, server_default='{}'),
                  Column('peer_ip', INET), uuid('session_id', 'auth_sessions.id', True), uuid('request_id'),
                  check("jsonb_typeof(metadata) = 'object'", 'metadata'), mutable=False)
Index('ix_audit_logs_created', audit_logs.c.created_at, audit_logs.c.id)
Index('ix_audit_logs_action_created', audit_logs.c.action, audit_logs.c.created_at)
Index('ix_audit_logs_target', audit_logs.c.target_type, audit_logs.c.target_id, audit_logs.c.created_at)
Index('ix_audit_logs_auth_failures', audit_logs.c.created_at, audit_logs.c.peer_ip, postgresql_where=audit_logs.c.action == 'auth.login_failure')

idempotency_keys = table('idempotency_keys', uuid('actor_id', 'users.id', primary=True), uuid('key', primary=True), Column('operation', String(100), nullable=False),
                        Column('request_digest', LargeBinary, nullable=False), Column('response_status', SmallInteger, nullable=False),
                        Column('response_body', JSONB, nullable=False), timestamp('expires_at'), check('octet_length(request_digest) = 32', 'digest'),
                        check("jsonb_typeof(response_body) = 'object'", 'response'), mutable=False)
Index('ix_idempotency_keys_expiry', idempotency_keys.c.expires_at)
