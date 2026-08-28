-- Admin growth push alerts (Jof + Carl by default via Netlify handler).
-- Fires pg_net webhooks to notifyAdminGrowth when:
--   1) A user gets a display name for the first time (users INSERT or first-name UPDATE)
--   2) A new mini league is created (leagues INSERT)
--
-- Run in Supabase SQL editor after deploying notifyAdminGrowth Netlify function.
-- Requires pg_net (Database → Extensions).

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net extension not available. Enable it in Supabase Dashboard → Database → Extensions.';
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_growth_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT := 'https://playtotl.com/.netlify/functions/notifyAdminGrowth';
  payload JSONB;
  request_id BIGINT;
  new_name TEXT;
  old_name TEXT;
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  IF TG_TABLE_NAME = 'users' THEN
    new_name := trim(COALESCE(NEW.name, ''));
    IF new_name = '' THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      old_name := trim(COALESCE(OLD.name, ''));
      IF old_name <> '' THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'leagues' AND TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := webhook_url,
      body := payload,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    ) INTO request_id;
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_admin_growth_users ON public.users;
CREATE TRIGGER trg_notify_admin_growth_users
  AFTER INSERT OR UPDATE OF name ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_growth_webhook();

DROP TRIGGER IF EXISTS trg_notify_admin_growth_leagues ON public.leagues;
CREATE TRIGGER trg_notify_admin_growth_leagues
  AFTER INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_growth_webhook();
