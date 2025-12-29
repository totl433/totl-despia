# Web to App Migration Plan

## Overview
Migrate all Web users to App/Despia while maintaining Web game functionality. App will use replica tables and mirror Web picks for scoring via API.

## Current State
- **Web Database**: ~70 users on playtotl.com (separate git repo, same Supabase)
- **App Database**: This repo (totl-web), same Supabase
- **Shared Tables**: `leagues`, `league_members`, `users`, `league_message_reads`
- **Test Users (App-only)**: Jof, Carl, SP, ThomasJamesBird
  - Use Test API Admin fixtures (`test_api_fixtures`)
  - Use Swipe Predictions Center (`test_api_picks`)
  - Play only on App

## Goal
- App has own database (replica tables)
- App works live for all Web users (via mirroring) + all API Test users
- From GW14: App operates as "finished" for testing
- Web game continues unchanged in background

---

## System Architecture ✅ CONFIRMED

### Data Flow

**App Users (4 test users, eventually all users):**
1. Admin creates fixtures via API Admin → `test_api_fixtures` (staging) → copy to `app_fixtures`
   - *Long-term: Could write directly to `app_fixtures`*
2. Users make picks via Swipe Predictions → **write directly to `app_picks`** ✅
   - *No mirroring needed - App users write to App tables directly*
3. API scores games → `app_gw_results`

**Web Users (~70 users):**
1. Admin creates fixtures manually → `fixtures` (Web)
2. Users make picks via Web → `picks` (Web)
3. **Mirror to App tables**: `fixtures` → `app_fixtures` (with team code mapping), `picks` → `app_picks`
4. **Once mirrored, treated as App users**: API scores ALL picks in `app_picks` (both App users and mirrored Web users)
5. API writes results → `app_gw_results` (NOT mirrored from Web `gw_results`)

**App Reads:**
- Always reads from App tables: `app_fixtures`, `app_picks`, `app_gw_results`, `app_gw_submissions`
- Uses App views: `app_v_gw_points`, `app_v_ocp_overall`
- Both App users and Web users appear in App Mini Leagues

**Key Points:**
- ✅ App tables have all historical data (GWs 1-13) from Web
- ✅ App can switch to App tables and see no difference
- ✅ **App users write directly to `app_picks`** (not `test_api_picks`) - cleaner architecture
- ✅ Web users' picks (`picks`) need to be mirrored to `app_picks` (with fixture mapping)
- ✅ Both user types coexist in App Mini Leagues
- ✅ **Long-term**: When everyone is an App user, `test_api_*` tables can be deprecated

---

## Stages

### Stage 1: Database Setup ✅ COMPLETE
**Status**: Complete  
**Goal**: Create App database replica tables

**Tasks**:
- [x] Create `app_fixtures` table (mirror of `fixtures`)
- [x] Create `app_picks` table (mirror of `picks`)
- [x] Create `app_gw_results` table (scored via API)
- [x] Create `app_gw_submissions` table (mirror of `gw_submissions`)
- [x] Create `app_meta` table (current GW for App)
- [x] Create `app_v_gw_points` view (mirror of `v_gw_points`)
- [x] Create `app_v_ocp_overall` view (mirror of `v_ocp_overall`)
- [x] Set up RLS policies for App tables
- [x] Create indexes for performance
- [x] **Run SQL files in Supabase** (`create_app_tables.sql` ✅ + `create_app_views.sql` ✅)

**SQL Files Created**:
- `supabase/sql/create_app_tables.sql` - All App tables, indexes, RLS policies
- `supabase/sql/create_app_views.sql` - App views (v_gw_points, v_ocp_overall)

**Notes**:
- Do NOT modify any Web database tables
- App tables are separate/replica tables

---

### Stage 2: Fixture Mapping System
**Status**: Not Started  
**Goal**: Map Web fixtures to App fixtures for mirroring

**Tasks**:
- [x] Implement team code normalization (NFO ↔ NOT mapping) ✅
- [ ] Create fixture matching function:
  - Primary: `home_code` + `away_code` (with normalization)
  - Fallback: `kickoff_time` (closest match)
- [ ] Test mapping with GW13 vs T2 data
- [ ] Handle edge cases (missing codes, time differences)

**Key Files**:
- `src/lib/teamCodeMapping.ts` (already created ✅)

---

### Stage 3: Mirroring System ✅ COMPLETE
**Status**: Initial Historical Data Complete, Real-Time Mirroring Implemented  
**Goal**: Copy Web picks → App picks each GW

**Tasks**:
- [x] **Initial mirroring: Copy all historical data (GWs 1-13)**
  - ✅ Mirrored 130 fixtures (GWs 1-13)
  - ✅ Mirrored picks for GWs 1-13 (completed via multiple scripts)
  - ✅ Mirrored 298 submissions (GWs 1-13)
  - ✅ Mirrored 130 results (GWs 1-13)
  - ✅ Updated app_meta.current_gw to 13
  - ✅ Mirrored test_api_fixtures to app_fixtures (with api_match_id)
- [x] **Update Predictions page to write directly to `app_picks`** ✅ (merged NewPredictionsCentre into Predictions.tsx)
- [x] **App users write directly to `app_picks`** (not `test_api_picks`) ✅
- [x] **Real-time mirroring: Database triggers implemented** ✅
  - ✅ Created PostgreSQL triggers for automatic mirroring
  - ✅ `picks` → `app_picks` (real-time on insert/update)
  - ✅ `gw_submissions` → `app_gw_submissions` (real-time on insert/update)
  - ✅ `fixtures` → `app_fixtures` (real-time on insert/update)
  - ✅ `gw_results` → `app_gw_results` (real-time on insert/update)
  - ✅ Triggers run automatically, no manual intervention needed
  - ✅ Handles conflicts gracefully with ON CONFLICT
- [x] **Manually added nazrene's GW13 picks to Web tables** (2024-11-30) ✅

**Scripts Created**:
- `scripts/mirror-all-web-data-to-app.mjs` - Initial historical data mirroring ✅
- `supabase/sql/create_mirror_triggers.sql` - Real-time mirroring triggers ✅

**How It Works**:
- When a Web user submits picks → automatically copied to `app_picks` via trigger
- When a Web user confirms submission → automatically copied to `app_gw_submissions` via trigger
- When fixtures are created/updated in Web → automatically copied to `app_fixtures` via trigger
- When results are published in Web → automatically copied to `app_gw_results` via trigger
- **No manual scripts needed** - everything happens automatically in real-time

---

### Stage 4: App Integration ✅ COMPLETE
**Status**: Complete  
**Goal**: Update App to use App database tables

**Tasks**:
- [x] Update Home page to read from `app_fixtures` + `app_picks` ✅
- [x] Update Tables page to use App tables ✅
- [x] Update Global page to use App views ✅
- [x] Update League page to use App data ✅
- [x] Update Predictions page to write directly to `app_picks` (replace `test_api_picks` writes) ✅ (merged NewPredictionsCentre into Predictions.tsx)
- [x] Ensure App users (4) and mirrored Web users coexist ✅
- [x] Remove test GW logic - all users see current GW (GW13) ✅
- [x] Add support for reading `app_gw_results` for non-API fixtures ✅
- [x] Update score calculation to work with both API and non-API fixtures ✅
- [ ] Verify Mini Leagues show all users correctly (testing needed)
- [ ] Test live scores work for all users (testing needed)

**Key Files to Update**:
- `src/pages/Home.tsx`
- `src/pages/Tables.tsx`
- `src/pages/Global.tsx`
- `src/pages/League.tsx`
- `src/pages/Predictions.tsx` (merged from NewPredictionsCentre)

---

### Stage 5: API Scoring Integration
**Status**: Partially Complete  
**Goal**: Score App picks using API (like Test API)

**Tasks**:
- [x] Update `pollLiveScores` to poll all test_gw values (not just T1) ✅
- [x] Home Page reads from `app_gw_results` for non-API fixtures ✅
- [x] Score calculation works with both API and non-API fixtures ✅
- [ ] Update `pollLiveScores` to write to `app_gw_results` (currently writes to `live_scores` only)
- [ ] Ensure live scores work for all App fixtures (API fixtures work, non-API use results)
- [ ] Test scoring for both App users and mirrored Web users
- [ ] Verify Mini Leagues show correct scores

---

### Stage 6: Testing & Validation
**Status**: Not Started  
**Goal**: Test entire system before GW14 launch

**Tasks**:
- [ ] Test mirroring with GW13 data
- [ ] Verify all 4 App users can play
- [ ] Verify mirrored Web users appear in App
- [ ] Test live scores for all fixtures
- [ ] Test scoring works correctly
- [ ] Verify Mini Leagues functionality
- [ ] Performance testing
- [ ] Prepare for GW14 launch

---

## Key Decisions

### Database Structure
- **Shared**: `leagues`, `league_members`, `users`, `league_message_reads`
- **App Replica**: `app_fixtures`, `app_picks`, `app_gw_results`, `app_gw_submissions`, `app_meta`
- **App Views**: `app_v_gw_points`, `app_v_ocp_overall`
- **API Fixtures (staging)**: `test_api_fixtures` - staging area for API fixtures, copied to `app_fixtures`
  - *Long-term: Could be deprecated when writing directly to `app_fixtures`*

### Fixture Mapping
- **Primary**: Team codes (`home_code` + `away_code`) with normalization
- **Normalization**: NFO ↔ NOT mapping
- **Fallback**: `kickoff_time` (closest match)

### User Types
- **App Users (4)**: Jof, Carl, SP, ThomasJamesBird
  - Use Test API Admin fixtures (`test_api_fixtures`)
  - Use Swipe Predictions Center (`test_api_picks`)
  - Picks mirrored to `app_picks`
  - Play only on App
- **Web Users (~70)**: Continue on Web, picks mirrored to App
  - Use Web fixtures (`fixtures`)
  - Use Web predictions (`picks`)
  - Picks mirrored to `app_picks` (with fixture mapping)

---

## Timeline
- **GW14**: App operates as "finished" for testing
- **Future**: Eventually migrate all users to App

---

## Notes
- Do NOT modify any Web database tables
- Web game must continue unchanged
- All changes are additive (new App tables only)
- App test users' data (`test_api_*`) also needs to be mirrored to App tables

---

## Progress Log

### 2024-11-30
- Created migration plan document
- Created team code mapping utility (`src/lib/teamCodeMapping.ts`)
- Verified GW13 vs T2 fixture matching (9/10 match, 1 needs normalization)
- ✅ Stage 1: Database Setup - COMPLETE
  - Executed `create_app_tables.sql` in Supabase ✅
  - Executed `create_app_views.sql` in Supabase ✅
  - All App tables and views created successfully
- ✅ Stage 3: Initial Historical Data Mirroring - COMPLETE
  - Mirrored all Web data (GWs 1-13) to App tables ✅
  - 130 fixtures, picks for GWs 1-13, 298 submissions, 130 results
  - App tables now have all historical data
  - Mirrored test_api_fixtures to app_fixtures (with api_match_id)
- ✅ Stage 4: App Integration - COMPLETE
  - Updated all pages (Home, Tables, Global, League, Predictions) to use app_* tables ✅
  - Removed test GW logic - all users see current GW (GW13) ✅
  - Added support for reading app_gw_results for non-API fixtures ✅
  - Score calculation works with both API and non-API fixtures ✅
  - App now fully uses App database tables
- ✅ Stage 3: Real-Time Mirroring - COMPLETE
  - Implemented database triggers for automatic real-time mirroring ✅
  - Web submissions now automatically mirror to App tables instantly ✅
  - No manual scripts needed - triggers handle everything ✅
  - Created `supabase/sql/create_mirror_triggers.sql` ✅
- Stage 5: API Scoring Integration - Partially Complete
  - Home Page reads from app_gw_results for non-API fixtures ✅
  - Need to update pollLiveScores to write to app_gw_results
