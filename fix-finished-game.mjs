// Script to manually set a game to FINISHED status
// Usage: node fix-finished-game.mjs [api_match_id]

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });
dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fixFinishedGame() {
  const apiMatchId = process.argv[2] || '535058'; // Default to Santos v Palmeiras
  
  console.log(`\n🔧 Setting game ${apiMatchId} to FINISHED status...\n`);
  
  // First check current status
  const { data: current, error: fetchError } = await supabase
    .from('live_scores')
    .select('*')
    .eq('api_match_id', apiMatchId)
    .maybeSingle();
  
  if (fetchError) {
    console.error('❌ Error fetching current status:', fetchError);
    return;
  }
  
  if (!current) {
    console.error(`❌ No live score found for api_match_id ${apiMatchId}`);
    return;
  }
  
  console.log('Current status:', current.status);
  console.log('Current score:', `${current.home_score} - ${current.away_score}`);
  
  // Update to FINISHED
  const { data: updated, error: updateError } = await supabase
    .from('live_scores')
    .update({
      status: 'FINISHED',
      minute: null, // FT doesn't need minute
    })
    .eq('api_match_id', apiMatchId)
    .select()
    .single();
  
  if (updateError) {
    console.error('❌ Error updating:', updateError);
    return;
  }
  
  console.log('\n✅ Successfully updated to FINISHED!');
  console.log('New status:', updated.status);
  console.log('Score:', `${updated.home_score} - ${updated.away_score}`);
  console.log('\n🎉 The game should now show as FT in the UI!');
}

fixFinishedGame().catch(console.error);








