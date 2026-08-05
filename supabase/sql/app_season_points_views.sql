-- =============================================================================
-- Pile B: season-scoped points views (mirror of app_v_gw_points / app_v_ocp_overall)
-- Run in Supabase SQL Editor after app_seasons_pile_b.sql.
-- Idempotent.
-- =============================================================================

-- Points per user per gameweek within a season
CREATE OR REPLACE VIEW app_v_season_gw_points AS
SELECT
  p.season_id,
  p.user_id,
  p.gw,
  COUNT(*) FILTER (WHERE p.pick = r.result) AS points
FROM app_season_picks p
INNER JOIN app_season_results r
  ON p.season_id = r.season_id
  AND p.gw = r.gw
  AND p.fixture_index = r.fixture_index
GROUP BY p.season_id, p.user_id, p.gw;

COMMENT ON VIEW app_v_season_gw_points IS
  'Pile B GW points: correct picks per user per gameweek within a season';

-- Overall OCP per user within a season
CREATE OR REPLACE VIEW app_v_season_ocp_overall AS
SELECT
  gp.season_id,
  gp.user_id,
  u.name,
  COALESCE(SUM(gp.points), 0) AS ocp
FROM app_v_season_gw_points gp
JOIN public.users u ON u.id = gp.user_id
GROUP BY gp.season_id, gp.user_id, u.name;

COMMENT ON VIEW app_v_season_ocp_overall IS
  'Pile B overall OCP: sum of correct picks per user within a season';

-- Grant read access (views inherit underlying RLS via security invoker on newer PG;
-- authenticated clients already read picks/results.)
GRANT SELECT ON app_v_season_gw_points TO authenticated, anon, service_role;
GRANT SELECT ON app_v_season_ocp_overall TO authenticated, anon, service_role;
