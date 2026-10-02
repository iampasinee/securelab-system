from sqlalchemy import Column, SmallInteger, Boolean, Integer, String, Text, ForeignKeyConstraint, Index

from app.models.helpers import table, uuid, timestamp, choice, check


security_settings = table('security_settings', Column('id', SmallInteger, primary_key=True),
                          *[Column(name, Boolean, nullable=False) for name in ('multiple_face_detection', 'looking_away_detection', 'window_switch_detection', 'url_whitelist_enforcement')],
                          Column('looking_away_threshold_seconds', Integer, nullable=False), Column('allowed_window_switches', Integer, nullable=False),
                          check('id = 1 AND looking_away_threshold_seconds > 0 AND allowed_window_switches >= 0', 'settings'))
security_allowed_domains = table('security_allowed_domains', Column('settings_id', SmallInteger, primary_key=True), Column('domain', String(253), primary_key=True),
                                ForeignKeyConstraint(['settings_id'], ['security_settings.id'], ondelete='RESTRICT'),
                                check('domain = lower(domain) AND length(domain) > 0', 'domain'), mutable=False)
violations = table('violations', uuid(primary=True), uuid('exam_id', 'exam_sessions.id'), uuid('student_id', 'student_profiles.user_id'), uuid('seat_id', 'room_seats.id', True),
                   *choice('source', 'development_simulation'), *choice('type', 'unauthorized_website/duplicate_login/unauthorized_device/tab_switch/peripheral_connected'),
                   Column('detail', Text, nullable=False), timestamp('student_seen_at', True), timestamp('reviewed_at', True), uuid('reviewed_by', 'users.id', True),
                   check('(reviewed_at IS NULL) = (reviewed_by IS NULL)', 'review'),
                   ForeignKeyConstraint(['exam_id', 'student_id'], ['exam_participants.exam_id', 'exam_participants.student_id'], name='fk_violations_participant', ondelete='RESTRICT'))
Index('ix_violations_pending', violations.c.exam_id, violations.c.created_at, postgresql_where=violations.c.reviewed_at.is_(None))
