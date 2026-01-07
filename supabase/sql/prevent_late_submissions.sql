-- ============================================
-- Prevent Late Submissions Trigger
-- ============================================
-- This trigger prevents users from submitting predictions after the deadline
-- Deadline is 75 minutes before the first kickoff of the gameweek

-- Function to check if submission is past deadline
CREATE OR REPLACE FUNCTION check_submission_deadline()
RETURNS TRIGGER AS $$
DECLARE
  earliest_kickoff TIMESTAMPTZ;
  deadline_time TIMESTAMPTZ;
  submission_time TIMESTAMPTZ;
BEGIN
  -- Get the earliest kickoff time for this gameweek
  SELECT MIN(kickoff_time) INTO earliest_kickoff
  FROM app_fixtures
  WHERE gw = NEW.gw;
  
  -- If no fixtures found, allow submission (shouldn't happen, but be safe)
  IF earliest_kickoff IS NULL THEN
    RAISE WARNING 'No fixtures found for GW %, allowing submission', NEW.gw;
    RETURN NEW;
  END IF;
  
  -- Calculate deadline (75 minutes before first kickoff)
  deadline_time := earliest_kickoff - INTERVAL '75 minutes';
  
  -- Use the provided submitted_at or current time
  submission_time := COALESCE(NEW.submitted_at, NOW());
  
  -- Check if submission is past deadline
  IF submission_time > deadline_time THEN
    RAISE EXCEPTION 'Submission rejected: Deadline has passed. Deadline was % (75 minutes before first kickoff at %)', 
      deadline_time, earliest_kickoff;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on app_gw_submissions
DROP TRIGGER IF EXISTS trigger_check_submission_deadline ON app_gw_submissions;
CREATE TRIGGER trigger_check_submission_deadline
  BEFORE INSERT OR UPDATE ON app_gw_submissions
  FOR EACH ROW
  EXECUTE FUNCTION check_submission_deadline();

-- Also create trigger for web table (gw_submissions)
CREATE OR REPLACE FUNCTION check_submission_deadline_web()
RETURNS TRIGGER AS $$
DECLARE
  earliest_kickoff TIMESTAMPTZ;
  deadline_time TIMESTAMPTZ;
  submission_time TIMESTAMPTZ;
BEGIN
  -- Get the earliest kickoff time for this gameweek
  -- Check both app_fixtures and fixtures tables
  SELECT MIN(kickoff_time) INTO earliest_kickoff
  FROM (
    SELECT kickoff_time FROM app_fixtures WHERE gw = NEW.gw
    UNION
    SELECT kickoff_time FROM fixtures WHERE gw = NEW.gw
  ) AS all_fixtures;
  
  -- If no fixtures found, allow submission (shouldn't happen, but be safe)
  IF earliest_kickoff IS NULL THEN
    RAISE WARNING 'No fixtures found for GW %, allowing submission', NEW.gw;
    RETURN NEW;
  END IF;
  
  -- Calculate deadline (75 minutes before first kickoff)
  deadline_time := earliest_kickoff - INTERVAL '75 minutes';
  
  -- Use the provided submitted_at or current time
  submission_time := COALESCE(NEW.submitted_at, NOW());
  
  -- Check if submission is past deadline
  IF submission_time > deadline_time THEN
    RAISE EXCEPTION 'Submission rejected: Deadline has passed. Deadline was % (75 minutes before first kickoff at %)', 
      deadline_time, earliest_kickoff;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on gw_submissions
DROP TRIGGER IF EXISTS trigger_check_submission_deadline_web ON gw_submissions;
CREATE TRIGGER trigger_check_submission_deadline_web
  BEFORE INSERT OR UPDATE ON gw_submissions
  FOR EACH ROW
  EXECUTE FUNCTION check_submission_deadline_web();

-- Comments
COMMENT ON FUNCTION check_submission_deadline() IS 'Prevents late submissions by checking deadline (75min before first kickoff)';
COMMENT ON FUNCTION check_submission_deadline_web() IS 'Prevents late submissions in web table by checking deadline (75min before first kickoff)';













