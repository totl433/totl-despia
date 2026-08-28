-- Allow mini-league members to see each other's picks before the deadline
-- only when every member of a shared league has submitted for that GW.
-- Global / other-league picks stay hidden until the deadline.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_reveal_legacy_picks_in_completed_mini_league(
  p_viewer uuid,
  p_owner uuid,
  p_gw integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p_viewer IS NOT NULL
    AND p_owner IS NOT NULL
    AND p_gw IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.league_members AS viewer_member
      JOIN public.league_members AS owner_member
        ON owner_member.league_id = viewer_member.league_id
      WHERE viewer_member.user_id = p_viewer
        AND owner_member.user_id = p_owner
        AND (
          SELECT count(*)
          FROM public.league_members AS league_size
          WHERE league_size.league_id = viewer_member.league_id
        ) >= 2
        AND NOT EXISTS (
          SELECT 1
          FROM public.league_members AS waiting
          WHERE waiting.league_id = viewer_member.league_id
            AND NOT EXISTS (
              SELECT 1
              FROM public.app_gw_submissions AS submission
              WHERE submission.user_id = waiting.user_id
                AND submission.gw = p_gw
            )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_reveal_season_picks_in_completed_mini_league(
  p_viewer uuid,
  p_owner uuid,
  p_season_id uuid,
  p_gw integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p_viewer IS NOT NULL
    AND p_owner IS NOT NULL
    AND p_season_id IS NOT NULL
    AND p_gw IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.league_members AS viewer_member
      JOIN public.league_members AS owner_member
        ON owner_member.league_id = viewer_member.league_id
      WHERE viewer_member.user_id = p_viewer
        AND owner_member.user_id = p_owner
        AND (
          SELECT count(*)
          FROM public.league_members AS league_size
          WHERE league_size.league_id = viewer_member.league_id
        ) >= 2
        AND NOT EXISTS (
          SELECT 1
          FROM public.league_members AS waiting
          WHERE waiting.league_id = viewer_member.league_id
            AND NOT EXISTS (
              SELECT 1
              FROM public.app_season_submissions AS submission
              WHERE submission.user_id = waiting.user_id
                AND submission.gw = p_gw
                AND submission.season_id = p_season_id
            )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_reveal_legacy_picks_in_completed_mini_league(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_reveal_season_picks_in_completed_mini_league(uuid, uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_reveal_legacy_picks_in_completed_mini_league(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_reveal_season_picks_in_completed_mini_league(uuid, uuid, uuid, integer) TO authenticated;

DROP POLICY IF EXISTS "Hide opponent picks until legacy GW deadline" ON public.app_picks;
CREATE POLICY "Hide opponent picks until legacy GW deadline"
ON public.app_picks
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.can_reveal_legacy_gw_picks(gw)
  OR public.can_reveal_legacy_picks_in_completed_mini_league(auth.uid(), user_id, gw)
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
  OR public.can_reveal_season_picks_in_completed_mini_league(auth.uid(), user_id, season_id, gw)
);

COMMIT;
