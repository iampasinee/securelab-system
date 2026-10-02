"""Courses domain. Frozen DDL; do not regenerate an applied revision."""
from pathlib import Path
from alembic import op

revision = 'm04_courses'
down_revision = 'm03_profiles'
branch_labels = None
depends_on = None


def upgrade():
    directory = Path(__file__).parent
    op.get_bind().exec_driver_sql((directory / 'm04_courses.sql').read_text(encoding='utf-8'))
    triggers = directory / 'm04_courses_triggers.sql'
    if triggers.exists():
        op.get_bind().exec_driver_sql(triggers.read_text(encoding='utf-8'))


def downgrade():
    # Deliberately require an explicit restoration plan for durable exam history.
    raise RuntimeError('Destructive downgrade is disabled; restore a reviewed backup instead.')
