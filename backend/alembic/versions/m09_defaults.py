"""Singleton defaults and auth session-family constraints."""
from alembic import op

revision = 'm09_defaults'
down_revision = 'm08_monitoring'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("INSERT INTO academic_settings(id,current_academic_year,current_semester) VALUES(1,2569,'1') ON CONFLICT DO NOTHING")
    op.execute('''INSERT INTO security_settings(id,multiple_face_detection,looking_away_detection,window_switch_detection,url_whitelist_enforcement,looking_away_threshold_seconds,allowed_window_switches)
                  VALUES(1,true,true,true,true,4,1) ON CONFLICT DO NOTHING''')
    op.execute('''CREATE FUNCTION securelab_refresh_family() RETURNS trigger LANGUAGE plpgsql AS $$
                 BEGIN
                   IF NEW.successor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM refresh_tokens WHERE id = NEW.successor_id AND session_id = NEW.session_id) THEN
                     RAISE EXCEPTION 'Refresh successor must share session family' USING ERRCODE = '23514';
                   END IF;
                   RETURN NEW;
                 END $$''')
    op.execute('CREATE TRIGGER refresh_family BEFORE INSERT OR UPDATE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION securelab_refresh_family()')


def downgrade():
    raise RuntimeError('Destructive downgrade is disabled; restore a reviewed backup instead.')
