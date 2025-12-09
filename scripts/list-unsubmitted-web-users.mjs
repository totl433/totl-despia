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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function listUnsubmittedWebUsers() {
  console.log('🔍 Finding web users who haven\'t submitted...\n');

  try {
    // Get current GW
    const { data: meta, error: metaError } = await supabase
      .from('app_meta')
      .select('current_gw')
      .eq('id', 1)
      .maybeSingle();

    if (metaError) {
      console.error('❌ Error fetching current GW:', metaError);
      return;
    }

    const currentGw = meta?.current_gw;
    if (!currentGw) {
      console.error('❌ No current GW found');
      return;
    }

    console.log(`📅 Current Gameweek: ${currentGw}\n`);

    // Get ALL users in the database
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id');

    if (allUsersError) {
      console.error('❌ Error fetching all users:', allUsersError);
      return;
    }

    // Get users with push subscriptions (app users)
    const { data: pushSubs, error: pushSubsError } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .eq('is_active', true);

    if (pushSubsError) {
      console.error('❌ Error fetching push subscriptions:', pushSubsError);
      return;
    }

    const appUserIds = new Set((pushSubs || []).map(s => s.user_id));
    const allUserIds = (allUsers || []).map(u => u.id);
    
    // Web users = all users who DON'T have push subscriptions (app users)
    const webUserIds = allUserIds.filter(id => !appUserIds.has(id));
    
    console.log(`👥 Total users in database: ${allUserIds.length}`);
    console.log(`📱 App users (with push subscriptions): ${appUserIds.size}`);
    console.log(`🌐 Web users (no push subscriptions): ${webUserIds.length}\n`);

    if (webUserIds.length === 0) {
      console.log('✅ No web users found with picks for this GW');
      return;
    }

    // Get all users who HAVE submitted for current GW
    const { data: submissions, error: subsError } = await supabase
      .from('gw_submissions')
      .select('user_id')
      .eq('gw', currentGw)
      .in('user_id', webUserIds);

    if (subsError) {
      console.error('❌ Error fetching submissions:', subsError);
      return;
    }

    const submittedUserIds = new Set((submissions || []).map(s => s.user_id));
    console.log(`✅ Found ${submittedUserIds.size} web users who HAVE submitted\n`);

    // Find users who haven't submitted
    const unsubmittedUserIds = webUserIds.filter(id => !submittedUserIds.has(id));
    console.log(`❌ Found ${unsubmittedUserIds.length} web users who HAVEN'T submitted\n`);

    if (unsubmittedUserIds.length === 0) {
      console.log('🎉 All web users have submitted!');
      return;
    }

    // Get user details
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, created_at')
      .in('id', unsubmittedUserIds)
      .order('name', { ascending: true });

    if (usersError) {
      console.error('❌ Error fetching user details:', usersError);
      return;
    }

    // Display results
    console.log('📋 Web Users Who Haven\'t Submitted:\n');
    console.log('─'.repeat(80));
    console.log(`${'Name'.padEnd(40)} ${'User ID'.padEnd(36)} ${'Created'.padEnd(20)}`);
    console.log('─'.repeat(80));

    (users || []).forEach((user) => {
      const name = (user.name || 'Unknown').padEnd(40);
      const userId = user.id.padEnd(36);
      const created = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';
      console.log(`${name} ${userId} ${created}`);
    });

    console.log('─'.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   Total web users: ${webUserIds.length}`);
    console.log(`   Users who submitted: ${submittedUserIds.size}`);
    console.log(`   Users who haven't submitted: ${unsubmittedUserIds.length}`);
    console.log(`   Submission rate: ${((submittedUserIds.size / webUserIds.length) * 100).toFixed(1)}%`);

    // Also save to file
    const fs = await import('fs');
    const outputPath = join(__dirname, '..', 'unsubmitted-web-users.txt');
    const fileContent = [
      `Web Users Who Haven't Submitted for GW${currentGw}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      `Total web users: ${webUserIds.length}`,
      `Users who submitted: ${submittedUserIds.size}`,
      `Users who haven't submitted: ${unsubmittedUserIds.length}`,
      `Submission rate: ${((submittedUserIds.size / webUserIds.length) * 100).toFixed(1)}%`,
      '',
      '─'.repeat(80),
      '',
      ...(users || []).map((user, index) => 
        `${(index + 1).toString().padStart(2, '0')}. ${user.name || 'Unknown'} (${user.id})`
      ),
      '',
      '─'.repeat(80),
    ].join('\n');
    
    fs.writeFileSync(outputPath, fileContent, 'utf-8');
    console.log(`\n💾 List saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

listUnsubmittedWebUsers();

