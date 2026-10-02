CREATE FUNCTION securelab_final_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state = 'final' THEN RAISE EXCEPTION 'FINAL version is immutable' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Version history cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF (NEW.id, NEW.submission_id, NEW.version_number, NEW.reopen_grant_id) IS DISTINCT FROM
     (OLD.id, OLD.submission_id, OLD.version_number, OLD.reopen_grant_id) THEN
    RAISE EXCEPTION 'Version identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER versions_final_lock BEFORE UPDATE OR DELETE ON submission_versions FOR EACH ROW EXECUTE FUNCTION securelab_final_version();

CREATE FUNCTION securelab_final_file() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE identifier uuid;
BEGIN
  identifier := COALESCE(NEW.version_id, OLD.version_id);
  IF EXISTS(SELECT 1 FROM submission_versions WHERE id = identifier AND state <> 'open') THEN
    RAISE EXCEPTION 'Closed workspace files are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id, NEW.version_id, NEW.upload_sequence, NEW.original_name, NEW.extension) IS DISTINCT FROM
    (OLD.id, OLD.version_id, OLD.upload_sequence, OLD.original_name, OLD.extension) THEN
    RAISE EXCEPTION 'Upload identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'File metadata must be retained' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER files_final_lock BEFORE INSERT OR UPDATE OR DELETE ON submission_files FOR EACH ROW EXECUTE FUNCTION securelab_final_file();
CREATE TRIGGER integrity_append_only BEFORE UPDATE OR DELETE ON file_integrity_checks FOR EACH ROW EXECUTE FUNCTION securelab_append_only();

CREATE FUNCTION securelab_latest_final() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.latest_final_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM submission_versions WHERE id = NEW.latest_final_version_id AND submission_id = NEW.id AND state = 'final') THEN
    RAISE EXCEPTION 'Latest pointer must reference an owned FINAL version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER submissions_latest_final BEFORE INSERT OR UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION securelab_latest_final();

CREATE FUNCTION securelab_version_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reopen_grant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM submission_reopen_grants g JOIN submissions s ON s.exam_id = g.exam_id AND s.student_id = g.student_id
    WHERE g.id = NEW.reopen_grant_id AND s.id = NEW.submission_id) THEN
    RAISE EXCEPTION 'Reopen grant must belong to submission participant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER version_grant_scope BEFORE INSERT ON submission_versions FOR EACH ROW EXECUTE FUNCTION securelab_version_grant();
