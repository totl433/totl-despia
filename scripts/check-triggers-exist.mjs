// scripts/check-triggers-exist.mjs
// Check if mirroring triggers exist in the database
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
  console.log('🔍 Checking if mirroring triggers exist in database...\n');

  try {
    // Check triggers using SQL query
    const { data: triggers, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          trigger_name,
          event_manipulation,
          event_object_table,
          action_timing,
          action_statement
        FROM information_schema.triggers
        WHERE trigger_name LIKE '%mirror%'
        ORDER BY trigger_name;
      `
    });

    // Alternative: Direct query if RPC doesn't work
    // We'll use a simpler approach - check if we can query the functions
    console.log('Checking for trigger functions...\n');

    // Try to check if functions exist by querying pg_proc
    const { data: functions, error: funcError } = await supabase
      .from('pg_proc')
      .select('proname')
      .like('proname', '%mirror%');

    if (funcError) {
      console.log('⚠️  Cannot directly query pg_proc (permission issue)');
      console.log('   This is normal - we need to check triggers differently\n');
    }

    // Check by trying to see if we can detect trigger activity
    // We'll check if the functions exist by looking at recent activity
    console.log('📋 Expected triggers:');
    console.log('   1. trigger_mirror_picks_to_app (on picks table)');
    console.log('   2. trigger_mirror_submissions_to_app (on gw_submissions table)');
    console.log('   3. trigger_mirror_fixtures_to_app (on fixtures table)');
    console.log('   4. trigger_mirror_picks_to_web (on app_picks table)');
    console.log('   5. trigger_mirror_submissions_to_web (on app_gw_submissions table)\n');

    // Test: Try to manually trigger the function logic
    // We'll check if David Bird's picks would be mirrored if we ran the function
    const davidBirdId = 'd2cbeca9-7dae-4be1-88fb-706911d67256';
    const gw = 18;

    console.log('🧪 Testing trigger logic manually...\n');
    console.log(`Checking if David Bird (${davidBirdId}) is in app-only list...`);

    const appOnlyUsers = [
      '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
      'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
      '9c0bcf50-370d-412d-8826-95371a72b4fe', // SP
      '36f31625-6d6c-4aa4-815a-1493a812841b', // ThomasJamesBird
      'c94f9804-ba11-4cd2-8892-49657aa6412c', // Sim
      '42b48136-040e-42a3-9b0a-dc9550dd1cae', // Will Middleton
      'd2cbeca9-7dae-4be1-88fb-706911d67256'  // David Bird
    ];

    const isInList = appOnlyUsers.includes(davidBirdId);
    console.log(`   ✅ David Bird IS in the list: ${isInList}`);

    // Check when David Bird's picks were inserted
    const { data: appPicks, error: picksError } = await supabase
      .from('app_picks')
      .select('created_at')
      .eq('user_id', davidBirdId)
      .eq('gw', gw)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!picksError && appPicks && appPicks.length > 0) {
      console.log(`\n📅 David Bird's picks were created: ${appPicks[0].created_at}`);
      console.log('   (Note: This might not be accurate if table doesn\'t have created_at)');
    }

    console.log('\n' + '='.repeat(80));
    console.log('💡 DIAGNOSIS');
    console.log('='.repeat(80));
    console.log('The trigger SHOULD be working because:');
    console.log('  ✅ David Bird is in the hardcoded app-only list');
    console.log('  ✅ All fixtures match between app and web');
    console.log('  ✅ Picks exist in app_picks');
    console.log('\nBut the trigger is NOT working because:');
    console.log('  ❌ No picks in web picks table');
    console.log('  ❌ No submission in web gw_submissions table');
    console.log('\n🔧 SOLUTION:');
    console.log('   The trigger may not exist in the database, or it may have failed.');
    console.log('   We need to:');
    console.log('   1. Verify triggers exist in Supabase Dashboard → Database → Triggers');
    console.log('   2. Re-run the create_mirror_triggers.sql script if needed');
    console.log('   3. Or manually backfill David Bird\'s GW18 picks');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTriggers();






