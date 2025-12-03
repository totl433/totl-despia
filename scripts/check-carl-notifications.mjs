import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CARL_USER_ID = 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2';

async function checkCarlNotifications() {
  console.log('🔍 Checking Carl\'s notification setup...\n');
  console.log(`User ID: ${CARL_USER_ID}\n`);

  try {
    // 1. Check if Carl user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, created_at')
      .eq('id', CARL_USER_ID)
      .single();

    if (userError || !user) {
      console.log('❌ Carl user not found!');
      return;
    }

    console.log(`✅ User found: ${user.name}`);
    console.log(`   Created: ${user.created_at}\n`);

    // 2. Check push subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', CARL_USER_ID);

    if (subsError) {
      console.error('❌ Error fetching subscriptions:', subsError);
      return;
    }

    console.log(`📱 Push Subscriptions: ${subscriptions?.length || 0}`);
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log('   ⚠️  NO PUSH SUBSCRIPTIONS FOUND!');
      console.log('   This is why Carl isn\'t receiving notifications.');
      console.log('   Solution: Carl needs to re-register his device via the app.');
    } else {
      subscriptions.forEach((sub, idx) => {
        console.log(`\n   Device ${idx + 1}:`);
        console.log(`   - Player ID: ${sub.player_id?.slice(0, 20)}...`);
        console.log(`   - Platform: ${sub.platform || 'unknown'}`);
        console.log(`   - Active: ${sub.is_active ? '✅' : '❌'}`);
        console.log(`   - Subscribed: ${sub.subscribed ? '✅' : '❌'}`);
        console.log(`   - Created: ${sub.created_at}`);
        console.log(`   - Last checked: ${sub.last_checked_at || 'never'}`);
        console.log(`   - Invalid: ${sub.invalid ? '⚠️  YES' : '✅ No'}`);
      });
    }

    // 3. Check when Carl was last active (if we have that data)
    if (subscriptions && subscriptions.length > 0) {
      const lastActive = subscriptions
        .map(s => s.last_active_at)
        .filter(Boolean)
        .sort()
        .pop();
      
      if (lastActive) {
        console.log(`\n📅 Last active: ${lastActive}`);
      }
    }

    // 4. Check if Carl has any submissions (to verify he's using the app)
    const { data: submissions, error: subsError2 } = await supabase
      .from('app_gw_submissions')
      .select('gw, submitted_at')
      .eq('user_id', CARL_USER_ID)
      .order('gw', { ascending: false })
      .limit(5);

    if (!subsError2 && submissions && submissions.length > 0) {
      console.log(`\n📝 Recent submissions: ${submissions.length} found`);
      submissions.forEach(s => {
        console.log(`   - GW${s.gw}: ${s.submitted_at}`);
      });
    }

    console.log('\n💡 Recommendations:');
    if (!subscriptions || subscriptions.length === 0) {
      console.log('   1. Carl needs to open the app and ensure he\'s signed in');
      console.log('   2. The app should automatically register his device via registerPlayer function');
      console.log('   3. If that doesn\'t work, use adminRegisterDevice function to manually register');
    } else {
      const hasActiveSub = subscriptions.some(s => s.is_active && s.subscribed);
      if (!hasActiveSub) {
        console.log('   1. Carl\'s devices are registered but not subscribed in OneSignal');
        console.log('   2. Check OneSignal dashboard to see device status');
        console.log('   3. Carl may need to enable notifications in iOS Settings');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCarlNotifications().catch(console.error);

