from psycopg import sql
from sqlalchemy import create_engine, text

from app.core.database import get_database_url


APP_ROLE = 'securelab_app'
APPEND_ONLY = ('audit_logs', 'exam_participants', 'exam_seat_assignment_events', 'exam_time_adjustments', 'file_integrity_checks')


def provision(password):
    if len(password) < 12:
        raise ValueError('APP_DB_PASSWORD must contain at least 12 characters')
    engine = create_engine(get_database_url(migration=True))
    with engine.begin() as db:
        exists = db.scalar(text('SELECT 1 FROM pg_roles WHERE rolname = :role'), {'role': APP_ROLE})
        if not exists:
            with db.connection.driver_connection.cursor() as cursor:
                cursor.execute(sql.SQL('CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD {}').format(sql.Identifier(APP_ROLE), sql.Literal(password)))
        db.execute(text('REVOKE CREATE ON SCHEMA public FROM PUBLIC'))
        db.execute(text('GRANT USAGE ON SCHEMA public TO securelab_app'))
    engine.dispose()


def grant_application_permissions():
    engine = create_engine(get_database_url(migration=True))
    with engine.begin() as db:
        db.execute(text('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO securelab_app'))
        db.execute(text('REVOKE INSERT, UPDATE, DELETE ON alembic_version FROM securelab_app'))
        for table_name in APPEND_ONLY:
            db.execute(text(f'REVOKE UPDATE, DELETE ON {table_name} FROM securelab_app'))
    engine.dispose()
