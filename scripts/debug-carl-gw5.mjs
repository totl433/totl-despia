import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';
const GW = 5;

async function debugCarlGW5() {
  console.log(`🔍 Debugging Carl's GW${GW} picks...\n`);

  // Get all fixtures for GW5
  const { data: fixtures, error: fixturesError } = await supabase
    .from('fixtures')
    .select('*')
    .eq('gw', GW)
    .order('fixture_index', { ascending: true });

  if (fixturesError) {
    console.error('❌ Error fetching fixtures:', fixturesError.message);
    return;
  }

  console.log(`📋 Found ${fixtures.length} fixtures for GW${GW}\n`);

  // Get ALL of Carl's picks for GW5 (no filtering)
  const { data: allPicks, error: picksError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', CARL_USER_ID)
    .eq('gw', GW);

  if (picksError) {
    console.error('❌ Error fetching picks:', picksError.message);
    return;
  }

  console.log(`📊 Found ${allPicks.length} picks for Carl in GW${GW}\n`);
  console.log('All picks:');
  allPicks.forEach(p => {
    console.log(`   Fixture ${p.fixture_index}: ${p.pick || 'NULL'}`);
  });

  // Check submission
  const { data: submission, error: subError } = await supabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', CARL_USER_ID)
    .eq('gw', GW)
    .single();

  if (subError && subError.code !== 'PGRST116') {
    console.error('❌ Error fetching submission:', subError.message);
  } else if (submission) {
    console.log(`\n✅ Carl submitted GW${GW} at: ${submission.submitted_at}`);
  } else {
    console.log(`\n⚠️  No submission found for GW${GW}`);
  }

  // Match picks to fixtures
  console.log('\n📋 Matching picks to fixtures:');
  console.log('='.repeat(80));
  
  fixtures.forEach(fixture => {
    const pick = allPicks.find(p => p.fixture_index === fixture.fixture_index);
    const homeTeam = fixture.home_team || 'TBD';
    const awayTeam = fixture.away_team || 'TBD';
    
    if (pick) {
      console.log(`Fixture ${fixture.fixture_index}: ${homeTeam} vs ${awayTeam} - Pick: ${pick.pick}`);
    } else {
      console.log(`Fixture ${fixture.fixture_index}: ${homeTeam} vs ${awayTeam} - ⚠️  NO PICK FOUND`);
    }
  });

  console.log('='.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Fixtures: ${fixtures.length}`);
  console.log(`   Picks found: ${allPicks.length}`);
  console.log(`   Missing picks: ${fixtures.length - allPicks.length}`);
}

debugCarlGW5().catch(console.error);

