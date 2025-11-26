import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function submitEBPicks() {
  console.log('🔍 Submitting EB\'s picks for GW12...\n');

  // Get current gameweek
  const { data: meta, error: metaError } = await supabase
    .from('meta')
    .select('current_gw')
    .eq('id', 1)
    .single();

  if (metaError) {
    console.error('❌ Error fetching current gameweek:', metaError.message);
    return;
  }

  const currentGw = meta?.current_gw;
  console.log(`📊 Current gameweek: GW${currentGw}\n`);

  // Find EB's user ID
  const { data: ebUser, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'EB')
    .single();

  if (userError || !ebUser) {
    console.error('❌ Error finding EB user:', userError?.message || 'User not found');
    return;
  }

  console.log(`✅ Found user: ${ebUser.name} (${ebUser.id})\n`);

  // Check if EB already has a submission
  const { data: existingSubmission, error: subCheckError } = await supabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', ebUser.id)
    .eq('gw', currentGw)
    .maybeSingle();

  if (subCheckError) {
    console.error('❌ Error checking existing submission:', subCheckError.message);
    return;
  }

  if (existingSubmission) {
    console.log('⚠️  EB already has a submission record:');
    console.log(`   Submitted at: ${existingSubmission.submitted_at || 'NULL'}`);
    console.log(`   League ID: ${existingSubmission.league_id || 'NULL'}\n`);
    
    if (existingSubmission.submitted_at) {
      console.log('✅ EB already has submitted_at set - nothing to do!\n');
      return;
    } else {
      console.log('📝 Updating submission with submitted_at timestamp...\n');
    }
  }

  // Verify EB has picks
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('fixture_index')
    .eq('user_id', ebUser.id)
    .eq('gw', currentGw);

  if (picksError) {
    console.error('❌ Error fetching picks:', picksError.message);
    return;
  }

  console.log(`📋 EB has ${picks.length} picks saved\n`);

  // Create or update submission record
  const now = new Date().toISOString();
  const submissionData = {
    user_id: ebUser.id,
    gw: currentGw,
    submitted_at: now,
    // Don't set league_id - keep it as is (NULL or existing value)
  };

  const { data: submission, error: submitError } = await supabase
    .from('gw_submissions')
    .upsert(submissionData, {
      onConflict: 'user_id,gw',
    })
    .select()
    .single();

  if (submitError) {
    console.error('❌ Error creating/updating submission:', submitError.message);
    return;
  }

  console.log('✅ Successfully submitted EB\'s picks!');
  console.log(`   Submission ID: ${submission.id}`);
  console.log(`   Submitted at: ${submission.submitted_at}`);
  console.log(`   League ID: ${submission.league_id || 'NULL (unchanged)'}\n`);

  // Verify the submission
  const { data: verifySub, error: verifyError } = await supabase
    .from('gw_submissions')
    .select('*')
    .eq('user_id', ebUser.id)
    .eq('gw', currentGw)
    .single();

  if (verifyError) {
    console.error('⚠️  Warning: Could not verify submission:', verifyError.message);
  } else {
    console.log('✅ Verification: Submission record confirmed');
    console.log(`   User: ${ebUser.name}`);
    console.log(`   GW: ${verifySub.gw}`);
    console.log(`   Submitted at: ${verifySub.submitted_at}`);
    console.log(`   Picks count: ${picks.length}\n`);
  }
}

submitEBPicks().catch(console.error);

