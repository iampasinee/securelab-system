from sqlalchemy import Column, Integer, String, Text, BigInteger, LargeBinary, UniqueConstraint, ForeignKeyConstraint, Index, func

from app.models.helpers import table, uuid, timestamp, choice, check


submissions = table('submissions', uuid(primary=True), uuid('exam_id', 'exam_sessions.id'), uuid('student_id', 'student_profiles.user_id'),
                    uuid('latest_final_version_id', nullable=True), UniqueConstraint('exam_id', 'student_id', name='uq_submissions_owner'),
                    ForeignKeyConstraint(['exam_id', 'student_id'], ['exam_participants.exam_id', 'exam_participants.student_id'], name='fk_submissions_participant', ondelete='RESTRICT'))
submission_reopen_grants = table('submission_reopen_grants', uuid(primary=True), uuid('exam_id', 'exam_sessions.id'), uuid('student_id', 'student_profiles.user_id'),
                                uuid('granted_by', 'users.id'), *choice('source_scope', 'student/room'), uuid('batch_id'), Column('reason', Text, nullable=False), timestamp('expires_at'),
                                timestamp('consumed_at', True), timestamp('revoked_at', True), check('expires_at > created_at', 'expiry'),
                                ForeignKeyConstraint(['exam_id', 'student_id'], ['exam_participants.exam_id', 'exam_participants.student_id'], name='fk_submission_reopen_grants_participant', ondelete='RESTRICT'))
Index('ix_submission_reopen_grants_scope', submission_reopen_grants.c.exam_id, submission_reopen_grants.c.student_id, submission_reopen_grants.c.expires_at)
submission_versions = table('submission_versions', uuid(primary=True), uuid('submission_id', 'submissions.id'), Column('version_number', Integer, nullable=False),
                            *choice('state', 'open/final/expired', 'open'), uuid('reopen_grant_id', 'submission_reopen_grants.id', True), timestamp('started_at'), timestamp('rules_accepted_at'),
                            Column('accepted_exam_revision', BigInteger, nullable=False), timestamp('finalized_at', True), Column('finalization_source', Text),
                            timestamp('deadline_snapshot', True), Column('required_count_snapshot', Integer), Column('timeliness', Text),
                            check('version_number > 0 AND accepted_exam_revision > 0', 'version'),
                            check("finalization_source IS NULL OR finalization_source IN ('manual','timeout')", 'source'),
                            check("timeliness IS NULL OR timeliness IN ('on_time','late')", 'timeliness'),
                            check("(state = 'final') = (finalized_at IS NOT NULL AND finalization_source IS NOT NULL AND deadline_snapshot IS NOT NULL AND required_count_snapshot IS NOT NULL AND timeliness IS NOT NULL)", 'final_fields'),
                            UniqueConstraint('submission_id', 'version_number', name='uq_submission_versions_number'), UniqueConstraint('submission_id', 'id', name='uq_submission_versions_owner'),
                            UniqueConstraint('reopen_grant_id', name='uq_submission_versions_grant'))
Index('uq_submission_versions_open', submission_versions.c.submission_id, unique=True, postgresql_where=submission_versions.c.state == 'open')
Index('uq_submission_versions_initial', submission_versions.c.submission_id, unique=True, postgresql_where=submission_versions.c.reopen_grant_id.is_(None))
submissions.append_constraint(ForeignKeyConstraint(['id', 'latest_final_version_id'], ['submission_versions.submission_id', 'submission_versions.id'],
                                                  name='fk_submissions_latest_owner', use_alter=True, ondelete='RESTRICT'))
Index('ix_submissions_latest_final_version_id', submissions.c.latest_final_version_id)
submission_files = table('submission_files', uuid(primary=True), uuid('version_id', 'submission_versions.id'), Column('upload_sequence', Integer, nullable=False),
                         Column('original_name', String(255), nullable=False), Column('submission_name', String(120), nullable=False), Column('extension', String(20), nullable=False),
                         Column('client_mime', String(255)), Column('expected_size_bytes', BigInteger, nullable=False), *choice('state', 'reserved/receiving/ready/failed/removed', 'reserved'),
                         timestamp('receive_started_at', True), timestamp('received_at', True), Column('size_bytes', BigInteger), Column('sha256', LargeBinary), Column('storage_key', Text, unique=True),
                         Column('failure_code', String(80)), UniqueConstraint('version_id', 'upload_sequence', name='uq_submission_files_sequence'),
                         check('upload_sequence > 0 AND expected_size_bytes > 0', 'intent'),
                         check("state <> 'ready' OR (size_bytes > 0 AND sha256 IS NOT NULL AND octet_length(sha256) = 32 AND storage_key IS NOT NULL AND received_at IS NOT NULL)", 'ready'),
                         check(r"extension ~ '^\.[a-z0-9]{1,19}$'", 'extension'))
Index('uq_submission_files_name', submission_files.c.version_id, func.lower(submission_files.c.submission_name), unique=True, postgresql_where=submission_files.c.state != 'removed')
file_integrity_checks = table('file_integrity_checks', uuid(primary=True), uuid('file_id', 'submission_files.id'), *choice('result', 'passed/mismatch/missing'),
                             Column('observed_sha256', LargeBinary), Column('observed_size_bytes', BigInteger), uuid('checked_by', 'users.id', True),
                             check('observed_sha256 IS NULL OR octet_length(observed_sha256) = 32', 'digest'), mutable=False)
