-- SQL script to add BoobyBomBom's GW18 picks
-- Run this directly in Supabase SQL Editor to bypass RLS
-- SAFETY: Only affects BoobyBomBom's GW18 picks

-- User ID for BoobyBomBom (found from database)
-- User: BoobyBomBom, ID: b14cd9cb-674c-4976-be20-17d4f8d954ee

-- GW18 Picks (mapped to fixture_index from app_fixtures):
-- 0: Man United vs Newcastle → A (Away Win)
-- 1: Nottingham vs Man City → A (Away Win)
-- 2: Arsenal vs Brighton Hove → H (Home Win)
-- 3: Brentford vs Bournemouth → D (Draw)
-- 4: Burnley vs Everton → D (Draw)
-- 5: Liverpool vs Wolverhampton → D (Draw)
-- 6: West Ham vs Fulham → D (Draw)
-- 7: Chelsea vs Aston Villa → D (Draw)
-- 8: Sunderland vs Leeds United → D (Draw)
-- 9: Crystal Palace vs Tottenham → A (Away Win)

-- Insert into app_picks
INSERT INTO app_picks (user_id, gw, fixture_index, pick)
VALUES
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 0, 'A'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 1, 'A'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 2, 'H'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 3, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 4, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 5, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 6, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 7, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 8, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 9, 'A')
ON CONFLICT (user_id, gw, fixture_index) 
DO UPDATE SET pick = EXCLUDED.pick;

-- Insert into picks (web table)
INSERT INTO picks (user_id, gw, fixture_index, pick)
VALUES
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 0, 'A'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 1, 'A'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 2, 'H'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 3, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 4, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 5, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 6, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 7, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 8, 'D'),
  ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, 9, 'A')
ON CONFLICT (user_id, gw, fixture_index) 
DO UPDATE SET pick = EXCLUDED.pick;

-- Insert submission record into app_gw_submissions
INSERT INTO app_gw_submissions (user_id, gw, submitted_at)
VALUES ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, NOW())
ON CONFLICT (user_id, gw) 
DO UPDATE SET submitted_at = EXCLUDED.submitted_at;

-- Insert submission record into gw_submissions
INSERT INTO gw_submissions (user_id, gw, submitted_at)
VALUES ('b14cd9cb-674c-4976-be20-17d4f8d954ee', 18, NOW())
ON CONFLICT (user_id, gw) 
DO UPDATE SET submitted_at = EXCLUDED.submitted_at;

-- Verify the picks and submissions were inserted
SELECT 
  'app_picks' as table_name,
  COUNT(*) as count
FROM app_picks
WHERE user_id = 'b14cd9cb-674c-4976-be20-17d4f8d954ee' 
  AND gw = 18
UNION ALL
SELECT 
  'picks' as table_name,
  COUNT(*) as count
FROM picks
WHERE user_id = 'b14cd9cb-674c-4976-be20-17d4f8d954ee' 
  AND gw = 18
UNION ALL
SELECT 
  'app_gw_submissions' as table_name,
  COUNT(*) as count
FROM app_gw_submissions
WHERE user_id = 'b14cd9cb-674c-4976-be20-17d4f8d954ee' 
  AND gw = 18
UNION ALL
SELECT 
  'gw_submissions' as table_name,
  COUNT(*) as count
FROM gw_submissions
WHERE user_id = 'b14cd9cb-674c-4976-be20-17d4f8d954ee' 
  AND gw = 18;

