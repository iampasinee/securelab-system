CREATE FUNCTION securelab_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only history cannot be modified' USING ERRCODE = '23514'; END $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION securelab_append_only();
CREATE TRIGGER participants_append_only BEFORE UPDATE OR DELETE ON exam_participants FOR EACH ROW EXECUTE FUNCTION securelab_append_only();
CREATE TRIGGER seat_history_append_only BEFORE UPDATE OR DELETE ON exam_seat_assignment_events FOR EACH ROW EXECUTE FUNCTION securelab_append_only();
CREATE TRIGGER time_history_append_only BEFORE UPDATE OR DELETE ON exam_time_adjustments FOR EACH ROW EXECUTE FUNCTION securelab_append_only();

CREATE FUNCTION securelab_exam_setup_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE identifier uuid;
BEGIN
  IF TG_TABLE_NAME = 'exam_sessions' THEN identifier := COALESCE(NEW.id, OLD.id);
  ELSE identifier := COALESCE(NEW.exam_id, OLD.exam_id); END IF;
  IF EXISTS(SELECT 1 FROM exam_sessions WHERE id = identifier) AND
    (NOT EXISTS(SELECT 1 FROM exam_policies WHERE exam_id = identifier) OR NOT EXISTS(SELECT 1 FROM exam_file_extensions WHERE exam_id = identifier)) THEN
    RAISE EXCEPTION 'Exam requires policy and file extensions' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER exams_setup AFTER INSERT OR UPDATE ON exam_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_exam_setup_complete();
CREATE CONSTRAINT TRIGGER exam_extensions_setup AFTER INSERT OR UPDATE OR DELETE ON exam_file_extensions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_exam_setup_complete();
CREATE CONSTRAINT TRIGGER exam_policy_setup AFTER INSERT OR UPDATE OR DELETE ON exam_policies DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_exam_setup_complete();

CREATE FUNCTION securelab_exam_seat() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM exam_sessions e JOIN room_seats s ON s.exam_room_id = e.exam_room_id JOIN computer_devices d ON d.seat_id = s.id
    WHERE e.id = NEW.exam_id AND s.id = NEW.seat_id AND d.id = NEW.device_id) THEN
    RAISE EXCEPTION 'Exam seat and device must belong to exam room' USING ERRCODE = '23514';
  END IF;
  IF EXISTS(SELECT 1 FROM exam_sessions WHERE id = NEW.exam_id AND roster_frozen_at IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM exam_participants WHERE exam_id = NEW.exam_id AND student_id = NEW.student_id) THEN
    RAISE EXCEPTION 'Student is not a frozen participant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER exam_seat_scope BEFORE INSERT OR UPDATE ON exam_seat_assignments FOR EACH ROW EXECUTE FUNCTION securelab_exam_seat();

CREATE FUNCTION securelab_device_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.computer_code, NEW.serial_number, NEW.ip_address, NEW.mac_address, NEW.seat_id)
     IS DISTINCT FROM (OLD.computer_code, OLD.serial_number, OLD.ip_address, OLD.mac_address, OLD.seat_id)
     AND EXISTS(SELECT 1 FROM exam_seat_assignment_events WHERE device_id = OLD.id) THEN
    RAISE EXCEPTION 'Historical device identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER devices_history BEFORE UPDATE ON computer_devices FOR EACH ROW EXECUTE FUNCTION securelab_device_history();
