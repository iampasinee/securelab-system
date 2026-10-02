"""Index remaining foreign keys used by authorization and historical lookups."""
from alembic import op

revision = 'm11_fk_indexes'
down_revision = 'm10_exam_revision'
branch_labels = None
depends_on = None


def upgrade():
    for table, column in (
        ('section_teachers', 'teacher_id'),
        ('section_student_overrides', 'student_id'),
        ('exam_participants', 'student_id'),
        ('exam_seat_assignments', 'student_id'),
        ('submissions', 'latest_final_version_id'),
    ):
        op.create_index(f'ix_{table}_{column}', table, [column])


def downgrade():
    raise RuntimeError('Review an explicit forward migration instead of removing historical schema')
