"""Separate accepted setup revision from roster/time/concurrency row versions."""
import sqlalchemy as sa
from alembic import op

revision = 'm10_exam_revision'
down_revision = 'm09_defaults'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('exam_sessions', sa.Column('setup_revision', sa.BigInteger(), nullable=False, server_default='1'))
    op.create_check_constraint('ck_exam_sessions_setup_revision', 'exam_sessions', 'setup_revision >= 1')


def downgrade():
    raise RuntimeError('Destructive downgrade is disabled; restore a reviewed backup instead.')
