-- Check fixture order matching between web (fixtures) and app (app_fixtures) tables
-- This helps identify if fixtures are in different orders, especially the last two

-- Replace with the GW you want to check
\set gw 19

-- Compare fixture order for the specified GW
SELECT 
  'WEB' as source,
  fixture_index,
  home_code,
  away_code,
  home_team,
  away_team,
  kickoff_time
FROM fixtures
WHERE gw = :gw
ORDER BY fixture_index ASC;

SELECT 
  'APP' as source,
  fixture_index,
  home_code,
  away_code,
  home_team,
  away_team,
  kickoff_time
FROM app_fixtures
WHERE gw = :gw
ORDER BY fixture_index ASC;

-- Check for mismatches: fixtures that exist in one table but not the other (by team codes)
SELECT 
  'WEB ONLY' as status,
  f.fixture_index as web_index,
  f.home_code || ' vs ' || f.away_code as teams,
  NULL::integer as app_index
FROM fixtures f
WHERE f.gw = :gw
  AND NOT EXISTS (
    SELECT 1 
    FROM app_fixtures af
    WHERE af.gw = :gw
      AND (
        (af.home_code = f.home_code AND af.away_code = f.away_code)
        OR (af.home_code = f.away_code AND af.away_code = f.home_code)
      )
  )
UNION ALL
SELECT 
  'APP ONLY' as status,
  NULL::integer as web_index,
  af.home_code || ' vs ' || af.away_code as teams,
  af.fixture_index as app_index
FROM app_fixtures af
WHERE af.gw = :gw
  AND NOT EXISTS (
    SELECT 1 
    FROM fixtures f
    WHERE f.gw = :gw
      AND (
        (f.home_code = af.home_code AND f.away_code = af.away_code)
        OR (f.home_code = af.away_code AND f.away_code = af.home_code)
      )
  )
ORDER BY status, web_index NULLS LAST, app_index NULLS LAST;

-- Check if fixture_index positions match for the same teams
SELECT 
  f.fixture_index as web_index,
  af.fixture_index as app_index,
  f.home_code || ' vs ' || f.away_code as teams,
  CASE 
    WHEN f.fixture_index = af.fixture_index THEN 'MATCH'
    ELSE 'MISMATCH'
  END as index_match
FROM fixtures f
INNER JOIN app_fixtures af ON (
  af.gw = f.gw
  AND (
    (af.home_code = f.home_code AND af.away_code = f.away_code)
    OR (af.home_code = f.away_code AND af.away_code = f.home_code)
  )
)
WHERE f.gw = :gw
ORDER BY f.fixture_index ASC;







