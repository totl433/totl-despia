// scripts/check-jof-test-picks.mjs
// Check if Jof's test API picks exist

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Jof's user ID
const jofUserId = '4542c037-5b38-40d0-b189-847b8f17c222';

async function checkJofTestPicks() {
  console.log('🔍 Checking Jof\'s test API picks and submission for matchday 1...\n');

  try {
    // Check picks
    const { data: picks, error: picksError } = await supabase
      .from('test_api_picks')
      .select('*')
      .eq('user_id', jofUserId)
      .eq('matchday', 1)
      .order('fixture_index', { ascending: true });
    
    if (picksError) {
      console.error('❌ Error checking picks:', picksError);
      return;
    }
    
    console.log(`📊 Picks found: ${picks?.length || 0}`);
    if (picks && picks.length > 0) {
      console.log('   Picks:');
      picks.forEach(p => {
        console.log(`   - Fixture ${p.fixture_index}: ${p.pick}`);
      });
    } else {
      console.log('   ✅ No picks found - deletion successful!');
    }
    
    // Check submission
    const { data: submission, error: submissionError } = await supabase
      .from('test_api_submissions')
      .select('*')
      .eq('user_id', jofUserId)
      .eq('matchday', 1);
    
    if (submissionError) {
      console.error('❌ Error checking submission:', submissionError);
      return;
    }
    
    console.log(`\n📝 Submission found: ${submission && submission.length > 0 ? 1 : 0}`);
    if (submission && submission.length > 0) {
      console.log(`   Submitted at: ${submission[0].submitted_at}`);
    } else {
      console.log('   ✅ No submission found - deletion successful!');
    }
    
    // Summary
    if ((!picks || picks.length === 0) && (!submission || submission.length === 0)) {
      console.log('\n✅ SUCCESS: Jof\'s test API picks and submission have been deleted!');
    } else {
      console.log('\n⚠️  WARNING: Some data still exists');
    }

  } catch (error) {
    console.error('❌ Error checking Jof\'s test picks:', error);
  }
}

checkJofTestPicks();

