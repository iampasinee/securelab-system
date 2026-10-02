CREATE FUNCTION securelab_role_profile() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE identifier uuid; actual_role text; profile_count integer; valid boolean;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN identifier := COALESCE(NEW.id, OLD.id);
  ELSE identifier := COALESCE(NEW.user_id, OLD.user_id); END IF;
  SELECT role INTO actual_role FROM users WHERE id = identifier;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT (SELECT count(*) FROM student_profiles WHERE user_id = identifier)
       + (SELECT count(*) FROM teacher_profiles WHERE user_id = identifier)
       + (SELECT count(*) FROM admin_profiles WHERE user_id = identifier) INTO profile_count;
  SELECT CASE actual_role
    WHEN 'student' THEN EXISTS(SELECT 1 FROM student_profiles WHERE user_id = identifier)
    WHEN 'teacher' THEN EXISTS(SELECT 1 FROM teacher_profiles WHERE user_id = identifier)
    WHEN 'admin' THEN EXISTS(SELECT 1 FROM admin_profiles WHERE user_id = identifier)
  END INTO valid;
  IF profile_count <> 1 OR NOT valid THEN
    RAISE EXCEPTION 'A user must have exactly one matching role profile' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER users_role_profile AFTER INSERT OR UPDATE ON users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_role_profile();
CREATE CONSTRAINT TRIGGER students_role_profile AFTER INSERT OR UPDATE OR DELETE ON student_profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_role_profile();
CREATE CONSTRAINT TRIGGER teachers_role_profile AFTER INSERT OR UPDATE OR DELETE ON teacher_profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_role_profile();
CREATE CONSTRAINT TRIGGER admins_role_profile AFTER INSERT OR UPDATE OR DELETE ON admin_profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_role_profile();

CREATE FUNCTION securelab_immutable_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role <> OLD.role THEN RAISE EXCEPTION 'Role is immutable' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_immutable_role BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION securelab_immutable_role();
