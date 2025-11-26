import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTestApiGw() {
  console.log('🔍 Checking Test API Gameweek data...\n');

  try {
    // Check test_api_meta
    const { data: meta, error: metaError } = await supabase
      .from('test_api_meta')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    
    if (metaError) {
      console.error('❌ Error loading test_api_meta:', metaError);
    } else if (meta) {
      console.log('📊 Test API Meta:');
      console.log(`   Current Test GW: ${meta.current_test_gw}`);
    } else {
      console.log('⚠️  No test_api_meta found');
    }

    // Check test_api_fixtures
    const { data: fixtures, error: fixturesError } = await supabase
      .from('test_api_fixtures')
      .select('*')
      .order('fixture_index', { ascending: true });
    
    if (fixturesError) {
      console.error('❌ Error loading test_api_fixtures:', fixturesError);
    } else if (fixtures && fixtures.length > 0) {
      console.log(`\n🏟️  Test API Fixtures (${fixtures.length}):\n`);
      fixtures.forEach((f, idx) => {
        console.log(`   ${idx + 1}. ${f.home_team} vs ${f.away_team}`);
        console.log(`      Test GW: ${f.test_gw}, Fixture Index: ${f.fixture_index}`);
        console.log(`      API Match ID: ${f.api_match_id}`);
        if (f.kickoff_time) {
          const kickoff = new Date(f.kickoff_time);
          console.log(`      Kickoff: ${kickoff.toLocaleString()}`);
        }
        console.log('');
      });
    } else {
      console.log('\n⚠️  No test_api_fixtures found');
    }

    // Check test_api_picks
    const { data: picks, error: picksError } = await supabase
      .from('test_api_picks')
      .select('*');
    
    if (picksError) {
      console.error('❌ Error loading test_api_picks:', picksError);
    } else if (picks && picks.length > 0) {
      console.log(`\n🎯 Test API Picks (${picks.length}):`);
      console.log(`   Users have made ${picks.length} picks`);
    } else {
      console.log('\n⚠️  No test_api_picks found');
    }

    // Check test_api_submissions
    const { data: submissions, error: submissionsError } = await supabase
      .from('test_api_submissions')
      .select('*');
    
    if (submissionsError) {
      console.error('❌ Error loading test_api_submissions:', submissionsError);
    } else if (submissions && submissions.length > 0) {
      console.log(`\n📝 Test API Submissions (${submissions.length}):`);
      submissions.forEach((s) => {
        console.log(`   User ${s.user_id} submitted for matchday ${s.matchday} at ${s.submitted_at}`);
      });
    } else {
      console.log('\n⚠️  No test_api_submissions found');
    }

  } catch (error) {
    console.error('❌ Error checking Test API GW:', error);
  }
}

checkTestApiGw();

