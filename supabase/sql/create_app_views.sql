-- ============================================
-- Stage 1: Create App Database Views
-- ============================================
-- These views mirror the Web database views (v_gw_points, v_ocp_overall)
-- but use App tables (app_picks, app_gw_results)

-- ============================================
-- 1. app_v_gw_points view (mirror of v_gw_points)
-- ============================================
-- Calculates points per user per gameweek
-- Points = count of correct picks (pick matches result)
CREATE OR REPLACE VIEW app_v_gw_points AS
SELECT 
  p.user_id,
  p.gw,
  COUNT(*) FILTER (WHERE p.pick = r.result) AS points
FROM app_picks p
INNER JOIN app_gw_results r 
  ON p.gw = r.gw 
  AND p.fixture_index = r.fixture_index
GROUP BY p.user_id, p.gw
ORDER BY p.gw, points DESC, p.user_id;

-- ============================================
-- 2. app_v_ocp_overall view (mirror of v_ocp_overall)
-- ============================================
-- Calculates overall OCP (Overall Correct Picks) per user
-- OCP = sum of all correct picks across all gameweeks
CREATE OR REPLACE VIEW app_v_ocp_overall AS
SELECT 
  u.id AS user_id,
  u.name,
  COALESCE(SUM(gp.points), 0) AS ocp
FROM public.users u
LEFT JOIN app_v_gw_points gp ON u.id = gp.user_id
GROUP BY u.id, u.name
ORDER BY ocp DESC, u.name;

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON VIEW app_v_gw_points IS 'App GW points: points per user per gameweek (count of correct picks)';
COMMENT ON VIEW app_v_ocp_overall IS 'App overall OCP: total correct picks per user across all gameweeks';

