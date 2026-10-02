CREATE FUNCTION securelab_seat_bounds() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'room_seats' THEN
    IF NOT EXISTS(SELECT 1 FROM exam_rooms WHERE id = NEW.exam_room_id AND NEW.row_number <= rows AND NEW.column_number <= columns) THEN
      RAISE EXCEPTION 'Seat outside room layout' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM room_seats WHERE exam_room_id = NEW.id AND (row_number > NEW.rows OR column_number > NEW.columns)) THEN
      RAISE EXCEPTION 'Layout must contain existing seats' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seats_bounds BEFORE INSERT OR UPDATE ON room_seats FOR EACH ROW EXECUTE FUNCTION securelab_seat_bounds();
CREATE TRIGGER layout_bounds BEFORE UPDATE ON exam_rooms FOR EACH ROW EXECUTE FUNCTION securelab_seat_bounds();
