from sqlalchemy import Column, String, Text, Boolean, BigInteger, Integer, SmallInteger, UniqueConstraint, ForeignKeyConstraint, Index, func, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint

from app.models.helpers import table, uuid, timestamp, choice, check


exam_sessions = table('exam_sessions', uuid(primary=True), uuid('section_id', 'sections.id'), uuid('exam_room_id', 'exam_rooms.id'),
                      Column('setup_revision', BigInteger, nullable=False, server_default='1'),
                      Column('name', String(200), nullable=False), *choice('exam_type', 'midterm/final/lab/quiz/other'), *choice('mode', 'online/offline'),
                      timestamp('starts_at'), timestamp('scheduled_end_at'), timestamp('ends_at'), Column('max_file_size_bytes', BigInteger, nullable=False),
                      Column('required_file_count', Integer, nullable=False), Column('filename_pattern', String(255), nullable=False),
                      Column('automatic_filename_template', String(255)), Column('instructions', Text, nullable=False, server_default=''),
                      timestamp('roster_frozen_at', True), uuid('created_by', 'users.id'),
                      Column('course_code_snapshot', String(20)), Column('course_name_snapshot', String(200)), Column('section_number_snapshot', Integer),
                      Column('academic_year_snapshot', SmallInteger), Column('semester_snapshot', Text), Column('room_code_snapshot', String(80)), Column('floor_number_snapshot', SmallInteger),
                      check('ends_at > starts_at AND scheduled_end_at > starts_at', 'time_range'),
                      check("(starts_at AT TIME ZONE 'Asia/Bangkok')::date = (ends_at AT TIME ZONE 'Asia/Bangkok')::date", 'same_day'),
                      check('max_file_size_bytes BETWEEN 1 AND 524288000 AND required_file_count >= 1', 'file_requirements'),
                      check('setup_revision >= 1', 'setup_revision'),
                      ExcludeConstraint(('exam_room_id', '='), (func.tstzrange(text('starts_at'), text('ends_at'), text("'[)'")), '&&'),
                                        name='ex_exam_sessions_room_time', using='gist'))
Index('ix_exam_sessions_schedule', exam_sessions.c.starts_at, exam_sessions.c.id)

POLICY_GROUPS = {
    'common': ('require_registered_device', 'require_agent', 'require_face_before_exam', 'require_periodic_face_check', 'prevent_duplicate_session', 'block_usb_storage', 'log_violations'),
    'file': ('require_exam_workspace', 'require_device_signature', 'lock_after_final_submit', 'block_external_storage_source'),
    'online': ('block_unknown_applications', 'restrict_browser', 'block_communication_apps', 'block_remote_desktop'),
    'offline': ('block_internet', 'local_server_only', 'isolate_clients', 'block_ssh', 'block_smb', 'block_ftp', 'block_scp', 'block_remote_desktop', 'block_external_network'),
}
exam_policies = table('exam_policies', uuid('exam_id', 'exam_sessions.id', primary=True),
                      *[Column(f'{group}_{name}', Boolean, nullable=False) for group, names in POLICY_GROUPS.items() for name in names],
                      *choice('resource_mode', 'allowlist/blocklist'), Column('local_server_host', String(255), nullable=False))
exam_file_extensions = table('exam_file_extensions', uuid('exam_id', 'exam_sessions.id', primary=True), Column('extension', String(20), primary_key=True),
                             check(r"extension ~ '^\.[a-z0-9]{1,19}$'", 'extension'), mutable=False)
exam_allowed_domains = table('exam_allowed_domains', uuid('exam_id', 'exam_sessions.id', primary=True), Column('domain', String(253), primary_key=True),
                             check('domain = lower(domain) AND length(domain) > 0', 'domain'), mutable=False)
exam_resources = table('exam_resources', uuid(primary=True), uuid('exam_id', 'exam_sessions.id'), *choice('effect', 'allow/block'),
                       *choice('resource_type', 'website/web_app/application'), Column('name', String(200), nullable=False), Column('value', String(512), nullable=False),
                       Column('category', String(100)), Column('sort_order', Integer, nullable=False), check('sort_order >= 0', 'order'))
Index('uq_exam_resources_value', exam_resources.c.exam_id, exam_resources.c.effect, exam_resources.c.resource_type, func.lower(exam_resources.c.value), unique=True)
exam_rules = table('exam_rules', uuid(primary=True), uuid('exam_id', 'exam_sessions.id'), Column('text', Text, nullable=False),
                   Column('is_custom', Boolean, nullable=False, server_default='false'), Column('sort_order', Integer, nullable=False),
                   check('length(btrim(text)) > 0 AND sort_order >= 0', 'text_order'), UniqueConstraint('exam_id', 'sort_order', name='uq_exam_rules_order'))
exam_participants = table('exam_participants', uuid('exam_id', 'exam_sessions.id', primary=True), uuid('student_id', 'student_profiles.user_id', primary=True),
                          Column('student_code_snapshot', String(15), nullable=False), Column('name_snapshot', String(200), nullable=False), uuid('major_id', 'majors.id'),
                          Column('admission_year_snapshot', SmallInteger, nullable=False), uuid('class_group_id', 'class_groups.id', True),
                          Column('faculty_name_snapshot', String(150), nullable=False), Column('department_name_snapshot', String(150), nullable=False),
                          Column('major_code_snapshot', String(30), nullable=False), Column('major_name_snapshot', String(150), nullable=False),
                          Column('class_group_code_snapshot', String(80)), *choice('membership_source', 'cohort/include'),
                          ForeignKeyConstraint(['class_group_id', 'major_id', 'admission_year_snapshot'], ['class_groups.id', 'class_groups.major_id', 'class_groups.admission_year'], name='fk_exam_participants_group_scope', ondelete='RESTRICT'), mutable=False)
Index('ix_exam_participants_student_id', exam_participants.c.student_id)
exam_seat_assignments = table('exam_seat_assignments', uuid('exam_id', 'exam_sessions.id', primary=True), uuid('student_id', 'student_profiles.user_id', primary=True),
                              uuid('seat_id', 'room_seats.id'), uuid('device_id', 'computer_devices.id'), uuid('assigned_by', 'users.id'),
                              UniqueConstraint('exam_id', 'seat_id', name='uq_exam_seat_assignments_seat'), UniqueConstraint('exam_id', 'device_id', name='uq_exam_seat_assignments_device'))
Index('ix_exam_seat_assignments_student_id', exam_seat_assignments.c.student_id)
exam_seat_assignment_events = table('exam_seat_assignment_events', uuid(primary=True), uuid('exam_id', 'exam_sessions.id'), uuid('student_id', 'student_profiles.user_id'),
                                   uuid('seat_id', 'room_seats.id'), uuid('device_id', 'computer_devices.id'), *choice('action', 'assign/unassign'), uuid('actor_id', 'users.id'),
                                   Column('seat_code_snapshot', String(16), nullable=False), Column('device_code_snapshot', String(80), nullable=False),
                                   Column('ip_snapshot', String(45), nullable=False), Column('mac_snapshot', String(17), nullable=False), mutable=False)
exam_time_adjustments = table('exam_time_adjustments', uuid(primary=True), uuid('exam_id', 'exam_sessions.id'), uuid('actor_id', 'users.id'),
                             Column('delta_minutes', Integer, nullable=False), timestamp('previous_end_at'), timestamp('next_end_at'), Column('reason', Text, nullable=False),
                             check("delta_minutes <> 0 AND next_end_at = previous_end_at + delta_minutes * interval '1 minute'", 'delta'), mutable=False)
