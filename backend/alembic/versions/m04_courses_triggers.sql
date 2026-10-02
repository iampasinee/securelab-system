CREATE FUNCTION securelab_section_primary() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE identifier uuid;
BEGIN
  IF TG_TABLE_NAME = 'sections' THEN identifier := COALESCE(NEW.id, OLD.id);
  ELSE identifier := COALESCE(NEW.section_id, OLD.section_id); END IF;
  IF EXISTS(SELECT 1 FROM sections WHERE id = identifier)
    AND (SELECT count(*) FROM section_teachers WHERE section_id = identifier AND assignment_role = 'primary') <> 1 THEN
    RAISE EXCEPTION 'Section requires exactly one primary teacher' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER sections_primary AFTER INSERT OR UPDATE ON sections DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_section_primary();
CREATE CONSTRAINT TRIGGER section_teachers_primary AFTER INSERT OR UPDATE OR DELETE ON section_teachers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_section_primary();

CREATE FUNCTION securelab_cohort_group_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM section_cohort_groups cg JOIN section_cohorts c ON c.id = cg.cohort_id JOIN class_groups g ON g.id = cg.class_group_id
    WHERE c.major_id <> g.major_id OR c.admission_year <> g.admission_year) THEN
    RAISE EXCEPTION 'Cohort and group scopes must match' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cohort_groups_scope AFTER INSERT OR UPDATE ON section_cohort_groups DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_cohort_group_scope();
CREATE CONSTRAINT TRIGGER cohorts_scope AFTER UPDATE ON section_cohorts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_cohort_group_scope();
CREATE CONSTRAINT TRIGGER class_groups_scope AFTER UPDATE ON class_groups DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION securelab_cohort_group_scope();
CREATE INDEX ix_section_cohort_groups_group ON section_cohort_groups(class_group_id);
