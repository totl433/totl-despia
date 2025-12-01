import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function mirrorGw14WebToApp() {
  console.log('🔄 Mirroring Web GW14 to App GW14...\n');

  const gw = 14;

  try {
    // Step 1: Mirror fixtures from Web to App
    console.log('📅 Step 1: Mirroring fixtures...');
    const { data: webFixtures, error: fxError } = await supabase
      .from('fixtures')
      .select('*')
      .eq('gw', gw)
      .order('fixture_index', { ascending: true });

    if (fxError) throw fxError;

    if (!webFixtures || webFixtures.length === 0) {
      console.log('   ⚠️  No Web fixtures found for GW14');
    } else {
      // Map Web fixtures to App fixtures format
      const appFixtures = webFixtures.map(f => ({
        gw: f.gw,
        fixture_index: f.fixture_index,
        home_team: f.home_team,
        away_team: f.away_team,
        home_code: f.home_code,
        away_code: f.away_code,
        home_name: f.home_name,
        away_name: f.away_name,
        kickoff_time: f.kickoff_time,
        api_match_id: f.api_match_id || null, // Web fixtures might not have api_match_id
      }));

      const { error: insertFxError } = await supabase
        .from('app_fixtures')
        .upsert(appFixtures, { onConflict: 'gw,fixture_index' });

      if (insertFxError) throw insertFxError;
      console.log(`   ✅ Mirrored ${appFixtures.length} fixtures to app_fixtures`);
    }

    // Step 2: Mirror picks from Web to App
    console.log('\n👥 Step 2: Mirroring picks...');
    const { data: webPicks, error: picksError } = await supabase
      .from('picks')
      .select('user_id, gw, fixture_index, pick')
      .eq('gw', gw)
      .not('fixture_index', 'is', null);

    if (picksError) throw picksError;

    if (!webPicks || webPicks.length === 0) {
      console.log('   ⚠️  No Web picks found for GW14');
    } else {
      // Check for specific user sotbjof
      const sotbjofPicks = webPicks.filter(p => {
        // We'll need to check the user_id - let's get the user first
        return true; // Will filter after getting user
      });

      const { data: sotbjofUser } = await supabase
        .from('users')
        .select('id, name')
        .eq('name', 'sotbjof')
        .maybeSingle();

      if (sotbjofUser) {
        const sotbjofPicksFiltered = webPicks.filter(p => p.user_id === sotbjofUser.id);
        console.log(`   📊 Found ${sotbjofPicksFiltered.length} picks for user "sotbjof" (${sotbjofUser.id})`);
      }

      const { error: insertPicksError } = await supabase
        .from('app_picks')
        .upsert(webPicks, { onConflict: 'user_id,gw,fixture_index' });

      if (insertPicksError) throw insertPicksError;
      console.log(`   ✅ Mirrored ${webPicks.length} picks to app_picks`);
    }

    // Step 3: Mirror submissions from Web to App
    console.log('\n📝 Step 3: Mirroring submissions...');
    const { data: webSubmissions, error: subError } = await supabase
      .from('gw_submissions')
      .select('user_id, gw, submitted_at')
      .eq('gw', gw);

    if (subError) throw subError;

    if (!webSubmissions || webSubmissions.length === 0) {
      console.log('   ⚠️  No Web submissions found for GW14');
    } else {
      // Check for specific user sotbjof
      const { data: sotbjofUser } = await supabase
        .from('users')
        .select('id, name')
        .eq('name', 'sotbjof')
        .maybeSingle();

      if (sotbjofUser) {
        const sotbjofSubmission = webSubmissions.find(s => s.user_id === sotbjofUser.id);
        if (sotbjofSubmission) {
          console.log(`   📊 Found submission for user "sotbjof" at ${sotbjofSubmission.submitted_at}`);
        } else {
          console.log(`   ⚠️  No submission found for user "sotbjof"`);
        }
      }

      const { error: insertSubError } = await supabase
        .from('app_gw_submissions')
        .upsert(webSubmissions, { onConflict: 'user_id,gw' });

      if (insertSubError) throw insertSubError;
      console.log(`   ✅ Mirrored ${webSubmissions.length} submissions to app_gw_submissions`);
    }

    // Step 4: Mirror results from Web to App (if they exist)
    console.log('\n🏆 Step 4: Mirroring results...');
    const { data: webResults, error: resultsError } = await supabase
      .from('gw_results')
      .select('gw, fixture_index, result')
      .eq('gw', gw);

    if (resultsError) throw resultsError;

    if (!webResults || webResults.length === 0) {
      console.log('   ⚠️  No Web results found for GW14 (results may not be published yet)');
    } else {
      const { error: insertResultsError } = await supabase
        .from('app_gw_results')
        .upsert(webResults, { onConflict: 'gw,fixture_index' });

      if (insertResultsError) throw insertResultsError;
      console.log(`   ✅ Mirrored ${webResults.length} results to app_gw_results`);
    }

    console.log('\n🎉 Mirroring complete! Web GW14 data has been copied to App tables.');
    console.log('   Users who submitted on Web should now show as submitted on App.');
    console.log('   Picks from Web users should appear on the Home Page with blue outlines.');

  } catch (error) {
    console.error('❌ Error mirroring data:', error.message || error);
    process.exit(1);
  }
}

mirrorGw14WebToApp();

