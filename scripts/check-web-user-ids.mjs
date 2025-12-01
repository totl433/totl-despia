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

async function checkWebUserIds() {
  console.log('🔍 Checking Web user IDs for GW14...\n');

  const gw = 14;

  try {
    // Get all users who have picks in Web table for GW14
    const { data: webPicks, error } = await supabase
      .from('picks')
      .select('user_id')
      .eq('gw', gw)
      .limit(10000);

    if (error) throw error;

    const webUserIds = [...new Set((webPicks || []).map(p => p.user_id))];
    
    console.log(`📊 Found ${webUserIds.length} unique Web users with picks for GW14\n`);

    // Check for gregory specifically
    const { data: gregoryUser } = await supabase
      .from('users')
      .select('id, name')
      .or('name.ilike.%gregrory%,name.ilike.%gregory%')
      .maybeSingle();

    if (gregoryUser) {
      const isWebUser = webUserIds.includes(gregoryUser.id);
      console.log(`👤 User: ${gregoryUser.name} (${gregoryUser.id})`);
      console.log(`   Is Web User: ${isWebUser ? '✅ YES' : '❌ NO'}`);
      
      if (isWebUser) {
        console.log(`   ✅ Should show blue outline on mini league cards`);
      } else {
        console.log(`   ⚠️  Will NOT show blue outline (not in Web picks table)`);
      }
    }

    // Show first 10 Web users
    console.log(`\n📋 First 10 Web users (sample):`);
    const { data: sampleUsers } = await supabase
      .from('users')
      .select('id, name')
      .in('id', webUserIds.slice(0, 10));

    if (sampleUsers) {
      sampleUsers.forEach(u => {
        console.log(`   - ${u.name} (${u.id})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

checkWebUserIds();

