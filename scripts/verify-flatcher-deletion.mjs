import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const FLATCHER_USER_ID = 'fb5a55b1-5039-4f41-82ae-0429ec78a544';
const GW = 18;

async function verifyDeletion() {
  console.log(`\n=== Verifying Flatcher's GW${GW} Data ===\n`);

  // Check app_picks
  const { data: appPicks, error: appPicksError } = await supabase
    .from('app_picks')
    .select('*')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW);

  console.log('app_picks:');
  if (appPicksError) {
    console.log(`  Error: ${appPicksError.message}`);
  } else {
    console.log(`  Count: ${appPicks?.length || 0}`);
    if (appPicks && appPicks.length > 0) {
      console.log('  ⚠ PICKS STILL EXIST!');
      appPicks.forEach(p => console.log(`    Fixture ${p.fixture_index}: ${p.pick}`));
    }
  }

  // Check picks (web table)
  const { data: webPicks, error: webPicksError } = await supabase
    .from('picks')
    .select('*')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW);

  console.log('\npicks (web):');
  if (webPicksError) {
    console.log(`  Error: ${webPicksError.message}`);
  } else {
    console.log(`  Count: ${webPicks?.length || 0}`);
    if (webPicks && webPicks.length > 0) {
      console.log('  ⚠ PICKS STILL EXIST!');
    }
  }

  // Check app_gw_submissions
  const { data: appSub, error: appSubError } = await supabase
    .from('app_gw_submissions')
    .select('*')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .maybeSingle();

  console.log('\napp_gw_submissions:');
  if (appSubError) {
    console.log(`  Error: ${appSubError.message}`);
  } else if (appSub) {
    console.log(`  ⚠ SUBMISSION STILL EXISTS!`);
    console.log(`  Submitted at: ${appSub.submitted_at}`);
  } else {
    console.log('  ✓ No submission found');
  }

  // Check gw_submissions (web table)
  const { data: webSub, error: webSubError } = await supabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .maybeSingle();

  console.log('\ngw_submissions (web):');
  if (webSubError) {
    console.log(`  Error: ${webSubError.message}`);
  } else if (webSub) {
    console.log(`  ⚠ SUBMISSION STILL EXISTS!`);
    console.log(`  Submitted at: ${webSub.submitted_at}`);
  } else {
    console.log('  ✓ No submission found');
  }

  // Now try to delete again with more verbose output
  if ((appPicks && appPicks.length > 0) || (appSub)) {
    console.log('\n=== Attempting Deletion Again ===\n');
    
    // Delete picks
    const { data: delPicks, error: delPicksError } = await supabase
      .from('app_picks')
      .delete()
      .eq('user_id', FLATCHER_USER_ID)
      .eq('gw', GW)
      .select();

    if (delPicksError) {
      console.error('Error deleting picks:', delPicksError);
    } else {
      console.log(`✓ Deleted ${delPicks?.length || 0} picks from app_picks`);
    }

    // Delete submission
    const { data: delSub, error: delSubError } = await supabase
      .from('app_gw_submissions')
      .delete()
      .eq('user_id', FLATCHER_USER_ID)
      .eq('gw', GW)
      .select();

    if (delSubError) {
      console.error('Error deleting submission:', delSubError);
    } else {
      console.log(`✓ Deleted submission from app_gw_submissions`);
    }

    // Also delete from web tables
    await supabase
      .from('picks')
      .delete()
      .eq('user_id', FLATCHER_USER_ID)
      .eq('gw', GW);

    await supabase
      .from('gw_submissions')
      .delete()
      .eq('user_id', FLATCHER_USER_ID)
      .eq('gw', GW);

    console.log('\n✓ Deletion complete. Verifying again...\n');
    
    // Verify deletion
    const { data: verifyPicks } = await supabase
      .from('app_picks')
      .select('*')
      .eq('user_id', FLATCHER_USER_ID)
      .eq('gw', GW);

    const { data: verifySub } = await supabase
      .from('app_gw_submissions')
      .select('*')
      .eq('user_id', FLATCHER_USER_ID)
      .eq('gw', GW)
      .maybeSingle();

    if ((!verifyPicks || verifyPicks.length === 0) && !verifySub) {
      console.log('✅ SUCCESS: All data removed');
    } else {
      console.log('⚠ WARNING: Data still exists after deletion');
      console.log(`  Picks: ${verifyPicks?.length || 0}`);
      console.log(`  Submission: ${verifySub ? 'exists' : 'removed'}`);
    }
  }
}

verifyDeletion().catch(console.error);













