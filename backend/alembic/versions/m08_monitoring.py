"""Monitoring domain. Frozen DDL; do not regenerate an applied revision."""
from pathlib import Path
from alembic import op

revision = 'm08_monitoring'
down_revision = 'm07_submissions'
branch_labels = None
depends_on = None


def upgrade():
    directory = Path(__file__).parent
    op.get_bind().exec_driver_sql((directory / 'm08_monitoring.sql').read_text(encoding='utf-8'))
    triggers = directory / 'm08_monitoring_triggers.sql'
    if triggers.exists():
        op.get_bind().exec_driver_sql(triggers.read_text(encoding='utf-8'))


def downgrade():
    # Deliberately require an explicit restoration plan for durable exam history.
    raise RuntimeError('Destructive downgrade is disabled; restore a reviewed backup instead.')
