// scripts/add-babybombom-gw18-picks.mjs
// SAFE OPERATION: Only adds babybombom's GW18 picks
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// SAFETY: Only these constants are used - change nothing else
const GW = 18;
const USERNAME = 'BoobyBomBom';

// Predictions from user (in the order provided)
const predictions = [
  { home: 'Man United', away: 'Newcastle', pick: 'A' },
  { home: 'Nottingham Forest', away: 'Man City', pick: 'A' },
  { home: 'Arsenal', away: 'Brighton', pick: 'H' },
  { home: 'Brentford', away: 'Bournemouth', pick: 'D' },
  { home: 'Liverpool', away: 'Wolves', pick: 'D' },
  { home: 'West Ham', away: 'Fulham', pick: 'D' },
  { home: 'Chelsea', away: 'Aston Villa', pick: 'D' },
  { home: 'Sunderland', away: 'Leeds', pick: 'D' },
  { home: 'Crystal Palace', away: 'Spurs', pick: 'A' },
  { home: 'Burnley', away: 'Everton', pick: 'D' },
];

function normalizeTeamName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/manchester united|man united|man utd/gi, 'manchester united')
    .replace(/manchester city|man city/gi, 'manchester city')
    .replace(/tottenham|spurs/gi, 'tottenham')
    .replace(/brighton.*hove|brighton/gi, 'brighton')
    .replace(/bournemouth|afc bournemouth/gi, 'bournemouth')
    .replace(/wolves|wolverhampton.*wanderers|wolverhampton/gi, 'wolverhampton')
    .replace(/west ham.*united|west ham/gi, 'west ham')
    .replace(/leeds.*united|leeds/gi, 'leeds')
    .replace(/crystal palace/gi, 'crystal palace')
    .replace(/nottingham.*forest|nottingham/gi, 'nottingham')
    .replace(/newcastle.*united|newcastle/gi, 'newcastle')
    .replace(/aston villa/gi, 'aston villa')
    .replace(/chelsea/gi, 'chelsea')
    .replace(/arsenal/gi, 'arsenal')
    .replace(/liverpool/gi, 'liverpool')
    .replace(/brentford/gi, 'brentford')
    .replace(/burnley/gi, 'burnley')
    .replace(/everton/gi, 'everton')
    .replace(/fulham/gi, 'fulham')
    .replace(/sunderland/gi, 'sunderland')
    .trim();
}

async function addBabybombomPicks() {
  console.log(`🔒 SAFE OPERATION: Adding GW${GW} picks for ${USERNAME} ONLY\n`);
  console.log('⚠️  This will ONLY touch this user\'s GW18 picks, nothing else\n');

  try {
    // SAFETY: Read-only operation - finds user
    console.log('📋 Step 1: Finding user...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', `%${USERNAME}%`);
    
    if (usersError) throw usersError;
    
    if (!users || users.length === 0) {
      console.error(`❌ User "${USERNAME}" not found. Trying exact match...`);
      const { data: exactUser } = await supabase
        .from('users')
        .select('id, name')
        .eq('name', USERNAME)
        .maybeSingle();
      
      if (!exactUser) {
        console.error('❌ User not found. Please check the username.');
        process.exit(1);
      }
      var userId = exactUser.id;
      console.log(`✅ Found user: ${exactUser.name} (${userId})`);
    } else if (users.length > 1) {
      console.log('⚠️  Multiple users found:');
      users.forEach(u => console.log(`   - ${u.name} (${u.id})`));
      console.log('❌ Please specify the exact user ID');
      process.exit(1);
    } else {
      var userId = users[0].id;
      console.log(`✅ Found user: ${users[0].name} (${userId})`);
    }

    // SAFETY: Read-only operation - loads fixtures
    console.log('\n📋 Step 2: Loading GW18 fixtures...');
    const { data: appFixtures, error: appFixturesError } = await supabase
      .from('app_fixtures')
      .select('*')
      .eq('gw', GW)  // SAFETY: Only GW 18
      .order('fixture_index');
    
    const { data: webFixtures, error: webFixturesError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', GW)  // SAFETY: Only GW 18
      .order('fixture_index');
    
    if (appFixturesError) throw appFixturesError;
    if (webFixturesError) throw webFixturesError;
    
    console.log(`✅ Loaded ${appFixtures.length} app fixtures and ${webFixtures.length} web fixtures`);
    
    if (appFixtures.length === 0 && webFixtures.length === 0) {
      console.error('❌ No GW18 fixtures found');
      process.exit(1);
    }

    const fixtures = appFixtures.length > 0 ? appFixtures : webFixtures;

    // SAFETY: Just computation - matches predictions
    console.log('\n📋 Step 3: Matching predictions to fixtures...');
    const picksToInsertApp = [];
    const picksToInsertWeb = [];

    for (const pred of predictions) {
      const matchingFixture = fixtures.find(f => {
        const fHome = normalizeTeamName(f.home_team || f.home_name || f.home_code || '');
        const fAway = normalizeTeamName(f.away_team || f.away_name || f.away_code || '');
        const pHome = normalizeTeamName(pred.home);
        const pAway = normalizeTeamName(pred.away);
        
        // Try both home/away and away/home (in case order is swapped)
        return (fHome === pHome && fAway === pAway) || (fHome === pAway && fAway === pHome);
      });

      if (!matchingFixture) {
        console.log(`⚠️  Warning: Could not match "${pred.home} vs ${pred.away}"`);
        continue;
      }

      // SAFETY: Only this user_id, only GW 18, only matched fixture_index
      picksToInsertApp.push({
        user_id: userId,  // SAFETY: Only this user
        gw: GW,           // SAFETY: Only GW 18
        fixture_index: matchingFixture.fixture_index,
        pick: pred.pick
      });

      const webFixture = webFixtures.find(f => f.fixture_index === matchingFixture.fixture_index);
      if (webFixture) {
        picksToInsertWeb.push({
          user_id: userId,  // SAFETY: Only this user
          gw: GW,           // SAFETY: Only GW 18
          fixture_index: webFixture.fixture_index,
          pick: pred.pick
        });
      }

      const homeName = matchingFixture.home_team || matchingFixture.home_name || 'Unknown';
      const awayName = matchingFixture.away_team || matchingFixture.away_name || 'Unknown';
      console.log(`   ${matchingFixture.fixture_index}: ${homeName} vs ${awayName} → ${pred.pick}`);
    }

    console.log(`\n✅ Matched ${picksToInsertApp.length} predictions`);

    // SAFETY: upsert with onConflict only affects rows matching (user_id, gw, fixture_index)
    // This means it will ONLY update/insert picks for this specific user, GW18, and these fixture indices
    // It CANNOT affect any other user, any other GW, or any other fixture indices
    
    // Try picks table first (may have more permissive RLS)
    console.log('\n📋 Step 4: Inserting picks into picks (web table)...');
    if (picksToInsertWeb.length > 0) {
      const { error: webPicksError } = await supabase
        .from('picks')
        .upsert(picksToInsertWeb, { onConflict: 'user_id,gw,fixture_index' });
      // SAFETY: onConflict ensures only matching (user_id, gw, fixture_index) rows are affected
      
      if (webPicksError) {
        console.error('❌ Error inserting into picks:', webPicksError);
        throw webPicksError;
      }
      console.log(`✅ Inserted ${picksToInsertWeb.length} picks into picks`);
    }

    // Try app_picks table (may fail due to RLS, but triggers should handle it)
    console.log('\n📋 Step 5: Inserting picks into app_picks...');
    if (picksToInsertApp.length > 0) {
      const { error: appPicksError } = await supabase
        .from('app_picks')
        .upsert(picksToInsertApp, { onConflict: 'user_id,gw,fixture_index' });
      // SAFETY: onConflict ensures only matching (user_id, gw, fixture_index) rows are affected
      
      if (appPicksError) {
        console.log(`⚠️  Could not insert into app_picks (RLS may block this): ${appPicksError.message}`);
        console.log('   Triggers should mirror from picks to app_picks automatically.');
        // Don't throw - this might be expected if RLS blocks it
      } else {
        console.log(`✅ Inserted ${picksToInsertApp.length} picks into app_picks`);
      }
    }

    // SAFETY: Read-only verification
    console.log('\n📋 Step 6: Verifying insertion...');
    const { data: verifyApp, error: verifyAppError } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', userId)  // SAFETY: Only this user
      .eq('gw', GW);          // SAFETY: Only GW 18
    
    const { data: verifyWeb, error: verifyWebError } = await supabase
      .from('picks')
      .select('*')
      .eq('user_id', userId)  // SAFETY: Only this user
      .eq('gw', GW);          // SAFETY: Only GW 18
    
    if (verifyAppError) throw verifyAppError;
    if (verifyWebError) throw verifyWebError;
    
    console.log(`✅ Verification: ${verifyApp.length} picks in app_picks, ${verifyWeb.length} picks in picks`);
    console.log(`\n✅ COMPLETE! Only ${USERNAME}'s GW18 picks were modified.\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addBabybombomPicks();

