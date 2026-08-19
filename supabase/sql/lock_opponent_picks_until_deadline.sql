-- Emergency server-side protection for prediction secrecy.
--
-- Existing app builds query pick tables directly, so this must be enforced by
-- RLS rather than relying on a client-side deadline check.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_reveal_legacy_gw_picks(p_gw integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    now() >= (
      SELECT min(f.kickoff_time) - interval '75 minutes'
      FROM public.app_fixtures AS f
      WHERE f.gw = p_gw
        AND f.kickoff_time IS NOT NULL
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.can_reveal_season_gw_picks(
  p_season_id uuid,
  p_gw integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    now() >= (
      SELECT min(f.kickoff_time) - interval '75 minutes'
      FROM public.app_season_fixtures AS f
      WHERE f.season_id = p_season_id
        AND f.gw = p_gw
        AND f.kickoff_time IS NOT NULL
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_reveal_legacy_gw_picks(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_reveal_season_gw_picks(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_reveal_legacy_gw_picks(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_reveal_season_gw_picks(uuid, integer) TO authenticated;

ALTER TABLE public.app_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_season_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hide opponent picks until legacy GW deadline" ON public.app_picks;
CREATE POLICY "Hide opponent picks until legacy GW deadline"
ON public.app_picks
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.can_reveal_legacy_gw_picks(gw)
);

DROP POLICY IF EXISTS "Hide opponent picks until season GW deadline" ON public.app_season_picks;
CREATE POLICY "Hide opponent picks until season GW deadline"
ON public.app_season_picks
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.can_reveal_season_gw_picks(season_id, gw)
);

COMMIT;
