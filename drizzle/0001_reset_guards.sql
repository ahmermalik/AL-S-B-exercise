CREATE TRIGGER IF NOT EXISTS close_activity_scope_guard
BEFORE INSERT ON close_agent_activity
WHEN CASE WHEN json_valid(NEW.data) THEN (
  (NEW.case_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM close_cases WHERE id = NEW.case_id))
  OR (NEW.run_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM close_runs WHERE id = NEW.run_id))
  OR (json_extract(NEW.data, '$.importId') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM close_imports WHERE id = json_extract(NEW.data, '$.importId')
  ))
  OR (NEW.case_id IS NULL AND NEW.run_id IS NULL AND json_extract(NEW.data, '$.importId') IS NULL)
  OR (NEW.case_id IS NOT NULL AND NEW.run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM close_cases c JOIN close_runs r ON c.import_id = r.import_id
    WHERE c.id = NEW.case_id AND r.id = NEW.run_id
  ))
  OR (NEW.case_id IS NOT NULL AND json_extract(NEW.data, '$.importId') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM close_cases WHERE id = NEW.case_id AND import_id = json_extract(NEW.data, '$.importId')
  ))
  OR (NEW.run_id IS NOT NULL AND json_extract(NEW.data, '$.importId') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM close_runs WHERE id = NEW.run_id AND import_id = json_extract(NEW.data, '$.importId')
  ))
  OR (json_extract(NEW.data, '$.resetGeneration') IS NOT NULL AND json_extract(NEW.data, '$.resetGeneration') IS NOT (
    SELECT value FROM close_settings WHERE key = 'reset_generation'
  ))
) ELSE 1 END
BEGIN
  SELECT RAISE(IGNORE);
END;
