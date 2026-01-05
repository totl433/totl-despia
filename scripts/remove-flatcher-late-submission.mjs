import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
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

async function removeLateSubmission() {
  console.log(`\n=== Removing Flatcher's Late GW${GW} Submission ===\n`);

  // Get GW18 deadline
  const { data: fixtures } = await supabase
    .from('app_fixtures')
    .select('kickoff_time')
    .eq('gw', GW)
    .order('kickoff_time', { ascending: true })
    .limit(1);

  if (!fixtures || fixtures.length === 0 || !fixtures[0].kickoff_time) {
    console.error('Could not find GW18 fixtures');
    return;
  }

  const firstKickoff = new Date(fixtures[0].kickoff_time);
  const deadline = new Date(firstKickoff.getTime() - 75 * 60 * 1000);

  console.log(`GW18 Deadline: ${deadline.toISOString()}`);

  // Get Flatcher's submission
  const { data: submission } = await supabase
    .from('app_gw_submissions')
    .select('submitted_at')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .maybeSingle();

  if (!submission) {
    console.log('No submission found');
    return;
  }

  const submittedAt = new Date(submission.submitted_at);
  console.log(`Submission time: ${submittedAt.toISOString()}`);

  if (submittedAt <= deadline) {
    console.log('✓ Submission was on time, no action needed');
    return;
  }

  console.log(`⚠ Submission was ${Math.round((submittedAt - deadline) / (60 * 1000))} minutes late`);
  console.log('\nRemoving late submission and picks...');

  // Delete submission
  const { error: subError } = await supabase
    .from('app_gw_submissions')
    .delete()
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW);

  if (subError) {
    console.error('Error deleting submission:', subError);
  } else {
    console.log('✓ Deleted submission from app_gw_submissions');
  }

  // Also delete from web table if it exists
  const { error: webSubError } = await supabase
    .from('gw_submissions')
    .delete()
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW);

  if (webSubError) {
    console.log('Note: Could not delete from gw_submissions (might not exist):', webSubError.message);
  } else {
    console.log('✓ Deleted submission from gw_submissions');
  }

  // Delete picks
  const { error: picksError } = await supabase
    .from('app_picks')
    .delete()
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW);

  if (picksError) {
    console.error('Error deleting picks:', picksError);
  } else {
    console.log('✓ Deleted picks from app_picks');
  }

  // Also delete from web picks if they exist
  const { error: webPicksError } = await supabase
    .from('picks')
    .delete()
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW);

  if (webPicksError) {
    console.log('Note: Could not delete from picks (might not exist):', webPicksError.message);
  } else {
    console.log('✓ Deleted picks from picks table');
  }

  console.log('\n✅ Flatcher\'s late GW18 submission and picks have been removed');
  console.log('   His score will no longer appear in leaderboards for GW18');
}

removeLateSubmission().catch(console.error);








