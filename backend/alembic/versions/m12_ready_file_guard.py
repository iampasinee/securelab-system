"""Serialize file mutation with FINAL and protect acknowledged byte identity."""
from alembic import op

revision = 'm12_ready_file_guard'
down_revision = 'm11_fk_indexes'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('''
CREATE OR REPLACE FUNCTION securelab_final_file() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE identifier uuid; workspace_state text;
BEGIN
  identifier := COALESCE(NEW.version_id, OLD.version_id);
  SELECT state INTO workspace_state FROM submission_versions WHERE id = identifier FOR UPDATE;
  IF workspace_state <> 'open' THEN
    RAISE EXCEPTION 'Closed workspace files are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id, NEW.version_id, NEW.upload_sequence, NEW.original_name, NEW.extension, NEW.expected_size_bytes) IS DISTINCT FROM
    (OLD.id, OLD.version_id, OLD.upload_sequence, OLD.original_name, OLD.extension, OLD.expected_size_bytes) THEN
    RAISE EXCEPTION 'Upload identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.state = 'ready' AND (
    NEW.state NOT IN ('ready', 'removed') OR
    (NEW.size_bytes, NEW.sha256, NEW.storage_key, NEW.received_at, NEW.receive_started_at) IS DISTINCT FROM
    (OLD.size_bytes, OLD.sha256, OLD.storage_key, OLD.received_at, OLD.receive_started_at)) THEN
    RAISE EXCEPTION 'Acknowledged bytes cannot be replaced' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'File metadata must be retained' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
''')


def downgrade():
    raise RuntimeError('Immutable file guards require an explicitly reviewed forward migration')
