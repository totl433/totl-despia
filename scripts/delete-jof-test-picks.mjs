// scripts/delete-jof-test-picks.mjs
// Delete only Jof's picks and submission for test API GW (matchday 1)
// Does NOT delete or change any other data

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Try anon key first, fall back to service role if available
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
console.log('Using service role key to bypass RLS...\n');
} else {
  console.log('Using anon key (may be limited by RLS)...\n');
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Jof's user ID
const jofUserId = '4542c037-5b38-40d0-b189-847b8f17c222';

async function deleteJofTestPicks() {
  console.log('🗑️ Deleting Jof\'s test API picks and submission for matchday 1...\n');

  try {
    // Step 1: Check what exists
    console.log('🔍 Checking existing data...');
    
    const { data: picks, error: picksError } = await supabase
      .from('test_api_picks')
      .select('*')
      .eq('user_id', jofUserId)
      .eq('matchday', 1);
    
    if (picksError) throw picksError;
    console.log(`   📊 Found ${picks?.length || 0} picks in test_api_picks for matchday 1`);
    
    const { data: submission, error: submissionError } = await supabase
      .from('test_api_submissions')
      .select('*')
      .eq('user_id', jofUserId)
      .eq('matchday', 1);
    
    if (submissionError) throw submissionError;
    console.log(`   📝 Found ${submission ? 1 : 0} submission in test_api_submissions for matchday 1`);

    // Step 2: Delete picks
    if (picks && picks.length > 0) {
      console.log('\n🗑️ Deleting picks...');
      const { data: deletePicksData, error: deletePicksError, count: deletePicksCount } = await supabase
        .from('test_api_picks')
        .delete()
        .eq('user_id', jofUserId)
        .eq('matchday', 1)
        .select(); // Add select() to see what was deleted
      
      if (deletePicksError) {
        console.error('   ❌ Error deleting picks:', deletePicksError);
        console.error('   Error details:', JSON.stringify(deletePicksError, null, 2));
        throw deletePicksError;
      }
      const deletedCount = deletePicksData?.length || deletePicksCount || 0;
      if (deletedCount === 0) {
        console.warn('   ⚠️  WARNING: Delete command succeeded but 0 rows were deleted. This might be due to RLS restrictions.');
        console.warn('   💡 Solution: Delete manually via Supabase dashboard or use service role key.');
      } else {
        console.log(`   ✅ Deleted ${deletedCount} picks`);
        if (deletePicksData && deletePicksData.length > 0) {
          console.log(`   📋 Deleted picks for fixture indices: ${deletePicksData.map(p => p.fixture_index).join(', ')}`);
        }
      }
    } else {
      console.log('\n   ℹ️ No picks found to delete');
    }

    // Step 3: Delete submission
    if (submission) {
      console.log('\n🗑️ Deleting submission...');
      const { data: deleteSubData, error: deleteSubmissionError, count: deleteSubCount } = await supabase
        .from('test_api_submissions')
        .delete()
        .eq('user_id', jofUserId)
        .eq('matchday', 1)
        .select(); // Add select() to see what was deleted
      
      if (deleteSubmissionError) {
        console.error('   ❌ Error deleting submission:', deleteSubmissionError);
        console.error('   Error details:', JSON.stringify(deleteSubmissionError, null, 2));
        throw deleteSubmissionError;
      }
      const deletedSubCount = deleteSubData?.length || deleteSubCount || 0;
      if (deletedSubCount === 0) {
        console.warn('   ⚠️  WARNING: Delete command succeeded but 0 rows were deleted. This might be due to RLS restrictions.');
        console.warn('   💡 Solution: Delete manually via Supabase dashboard or use service role key.');
      } else {
        console.log(`   ✅ Deleted submission`);
        if (deleteSubData && deleteSubData.length > 0) {
          console.log(`   📋 Submission deleted (was submitted at: ${deleteSubData[0].submitted_at})`);
        }
      }
    } else {
      console.log('\n   ℹ️ No submission found to delete');
    }

    // Step 4: Verify deletion
    console.log('\n🔍 Verifying deletion...');
    
    const { data: remainingPicks, error: verifyPicksError } = await supabase
      .from('test_api_picks')
      .select('*')
      .eq('user_id', jofUserId)
      .eq('matchday', 1);
    
    if (verifyPicksError) throw verifyPicksError;
    
    const { data: remainingSubmission, error: verifySubError } = await supabase
      .from('test_api_submissions')
      .select('*')
      .eq('user_id', jofUserId)
      .eq('matchday', 1);
    
    if (verifySubError) throw verifySubError;

    if ((!remainingPicks || remainingPicks.length === 0) && !remainingSubmission) {
      console.log('\n✅ SUCCESS: Jof\'s test API picks and submission for matchday 1 have been deleted!');
      console.log('   ✅ No other data was modified');
    } else {
      console.log('\n❌ WARNING: Some data may still exist');
      if (remainingPicks && remainingPicks.length > 0) {
        console.log(`   - ${remainingPicks.length} picks still exist`);
      }
      if (remainingSubmission) {
        console.log('   - Submission still exists');
      }
    }

  } catch (error) {
    console.error('❌ Error deleting Jof\'s test picks:', error);
    process.exit(1);
  }
}

deleteJofTestPicks();

