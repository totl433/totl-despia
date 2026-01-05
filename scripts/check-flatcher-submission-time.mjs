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

async function checkSubmissionTime() {
  console.log(`\n=== Checking Flatcher's GW${GW} Submission Time ===\n`);

  // Check app_gw_submissions
  const { data: appSubmission, error: appError } = await supabase
    .from('app_gw_submissions')
    .select('submitted_at')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .maybeSingle();

  console.log('1. app_gw_submissions:');
  if (appError) {
    console.log(`   Error: ${appError.message}`);
  } else if (appSubmission) {
    const submittedAt = new Date(appSubmission.submitted_at);
    console.log(`   Submitted at: ${submittedAt.toISOString()}`);
    console.log(`   Local time: ${submittedAt.toLocaleString()}`);
    console.log(`   UTC time: ${submittedAt.toUTCString()}`);
  } else {
    console.log('   ⚠ No submission found in app_gw_submissions');
  }
  console.log();

  // Check gw_submissions (web table)
  const { data: webSubmission, error: webError } = await supabase
    .from('gw_submissions')
    .select('submitted_at')
    .eq('user_id', FLATCHER_USER_ID)
    .eq('gw', GW)
    .maybeSingle();

  console.log('2. gw_submissions (web):');
  if (webError) {
    console.log(`   Error: ${webError.message}`);
  } else if (webSubmission) {
    const submittedAt = new Date(webSubmission.submitted_at);
    console.log(`   Submitted at: ${submittedAt.toISOString()}`);
    console.log(`   Local time: ${submittedAt.toLocaleString()}`);
    console.log(`   UTC time: ${submittedAt.toUTCString()}`);
  } else {
    console.log('   ⚠ No submission found in gw_submissions');
  }
  console.log();

  // Compare if both exist
  if (appSubmission && webSubmission) {
    const appTime = new Date(appSubmission.submitted_at);
    const webTime = new Date(webSubmission.submitted_at);
    
    console.log('3. Comparison:');
    if (appTime.getTime() === webTime.getTime()) {
      console.log('   ✓ Timestamps match');
    } else {
      console.log(`   ⚠ Timestamps differ by ${Math.abs(appTime - webTime)}ms`);
    }
  }

  // Get GW18 deadline for context
  const { data: meta, error: metaError } = await supabase
    .from('app_meta')
    .select('current_gw')
    .eq('id', 1)
    .maybeSingle();

  const { data: fixtures, error: fixturesError } = await supabase
    .from('app_fixtures')
    .select('kickoff_time')
    .eq('gw', GW)
    .order('kickoff_time', { ascending: true })
    .limit(1);

  if (fixtures && fixtures.length > 0 && fixtures[0].kickoff_time) {
    const firstKickoff = new Date(fixtures[0].kickoff_time);
    const deadline = new Date(firstKickoff.getTime() - 75 * 60 * 1000); // 75 minutes before
    
    console.log('\n4. GW18 Deadline Context:');
    console.log(`   First kickoff: ${firstKickoff.toISOString()}`);
    console.log(`   Deadline (75min before): ${deadline.toISOString()}`);
    
    if (appSubmission) {
      const submittedAt = new Date(appSubmission.submitted_at);
      const wasOnTime = submittedAt < deadline;
      console.log(`   Submission was: ${wasOnTime ? '✓ ON TIME' : '⚠ LATE'}`);
      if (!wasOnTime) {
        const minutesLate = Math.round((submittedAt - deadline) / (60 * 1000));
        console.log(`   ${minutesLate} minutes after deadline`);
      }
    }
  }
}

checkSubmissionTime().catch(console.error);








