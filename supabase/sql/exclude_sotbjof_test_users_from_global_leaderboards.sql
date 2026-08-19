-- Keep test accounts out of global leaderboards without affecting mini leagues,
-- picks, submissions, profiles, or the HomeWins account.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_global_leaderboard_excluded(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT
    p_user_id = ANY (
      ARRAY[
        '6c4e2a47-def4-48af-8fea-ea06767772b3',
        '9b0a64ae-68e5-4250-a2b4-04135eeac01f',
        'd37b6624-8a61-4748-90e5-56808f3b765e',
        '35464f1c-986b-4d1d-92bb-7e6bbc21205c',
        'bc3120b2-9b12-4be9-b576-dfd3ec5bfa11',
        'f9428ad5-4185-48e5-b47c-6a8c79107a17',
        '799fd573-debb-4ea4-8fcb-5048cb00e42d',
        '0c8cb8e7-2790-43c4-b72c-4719e2296e72',
        '97ee8429-7af6-4d37-a3fa-acb9bc40e5b6'
      ]::uuid[]
    )
    OR EXISTS (
      SELECT 1
      FROM auth.users AS auth_user
      LEFT JOIN public.users AS profile ON profile.id = auth_user.id
      WHERE auth_user.id = p_user_id
        AND lower(COALESCE(auth_user.email, '')) LIKE 'sotbjof%'
        AND lower(trim(COALESCE(profile.name, ''))) <> 'homewins'
    );
$$;

REVOKE ALL ON FUNCTION public.is_global_leaderboard_excluded(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_global_leaderboard_excluded(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_global_leaderboard_excluded(uuid) TO service_role;

CREATE OR REPLACE VIEW public.app_v_gw_points AS
SELECT
  picks.user_id,
  picks.gw,
  count(*) FILTER (WHERE picks.pick = results.result) AS points
FROM public.app_picks AS picks
JOIN public.app_gw_results AS results
  ON picks.gw = results.gw
 AND picks.fixture_index = results.fixture_index
WHERE NOT public.is_global_leaderboard_excluded(picks.user_id)
GROUP BY picks.user_id, picks.gw
ORDER BY
  picks.gw,
  (count(*) FILTER (WHERE picks.pick = results.result)) DESC,
  picks.user_id;

CREATE OR REPLACE VIEW public.app_v_ocp_overall AS
SELECT
  profile.id AS user_id,
  profile.name,
  COALESCE(sum(gw_points.points), 0::numeric) AS ocp
FROM public.users AS profile
LEFT JOIN public.app_v_gw_points AS gw_points ON profile.id = gw_points.user_id
WHERE NOT public.is_global_leaderboard_excluded(profile.id)
GROUP BY profile.id, profile.name
ORDER BY COALESCE(sum(gw_points.points), 0::numeric) DESC, profile.name;

CREATE OR REPLACE VIEW public.app_v_season_gw_points AS
SELECT
  picks.season_id,
  picks.user_id,
  picks.gw,
  count(*) FILTER (WHERE picks.pick = results.result) AS points
FROM public.app_season_picks AS picks
JOIN public.app_season_results AS results
  ON picks.season_id = results.season_id
 AND picks.gw = results.gw
 AND picks.fixture_index = results.fixture_index
WHERE NOT public.is_global_leaderboard_excluded(picks.user_id)
GROUP BY picks.season_id, picks.user_id, picks.gw;

CREATE OR REPLACE VIEW public.app_v_season_ocp_overall AS
SELECT
  gw_points.season_id,
  gw_points.user_id,
  profile.name,
  COALESCE(sum(gw_points.points), 0::numeric) AS ocp
FROM public.app_v_season_gw_points AS gw_points
JOIN public.users AS profile ON profile.id = gw_points.user_id
WHERE NOT public.is_global_leaderboard_excluded(gw_points.user_id)
GROUP BY gw_points.season_id, gw_points.user_id, profile.name;

COMMIT;
