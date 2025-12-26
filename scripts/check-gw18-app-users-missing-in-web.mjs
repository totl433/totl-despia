// scripts/check-gw18-app-users-missing-in-web.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGw18Users() {
  console.log('🔍 Checking GW18: Users with app submissions but missing in web...\n');

  try {
    // Step 1: Get all app users with GW18 submissions
    const { data: appSubmissions, error: appError } = await supabase
      .from('app_gw_submissions')
      .select('user_id, gw, submitted_at')
      .eq('gw', 18);

    if (appError) throw appError;

    console.log(`📱 Found ${appSubmissions.length} users with GW18 submissions in app_gw_submissions\n`);

    // Step 2: Get all web users with GW18 submissions
    const { data: webSubmissions, error: webError } = await supabase
      .from('gw_submissions')
      .select('user_id, gw, submitted_at')
      .eq('gw', 18);

    if (webError) throw webError;

    console.log(`🌐 Found ${webSubmissions.length} users with GW18 submissions in gw_submissions\n`);

    // Step 3: Find users in app but not in web
    const appUserIds = new Set(appSubmissions.map(s => s.user_id));
    const webUserIds = new Set(webSubmissions.map(s => s.user_id));
    
    const missingInWeb = appSubmissions.filter(s => !webUserIds.has(s.user_id));
    const differentTimestamp = appSubmissions.filter(s => {
      const webSub = webSubmissions.find(ws => ws.user_id === s.user_id);
      return webSub && webSub.submitted_at !== s.submitted_at;
    });

    console.log(`❌ Users missing in web: ${missingInWeb.length}`);
    console.log(`⚠️  Users with different timestamps: ${differentTimestamp.length}\n`);

    // Step 4: Get user details and pick counts
    if (missingInWeb.length > 0 || differentTimestamp.length > 0) {
      const allAffectedUserIds = [
        ...missingInWeb.map(s => s.user_id),
        ...differentTimestamp.map(s => s.user_id)
      ];
      
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name')
        .in('id', [...new Set(allAffectedUserIds)]);

      if (usersError) throw usersError;

      const userMap = new Map(users.map(u => [u.id, u]));

      // Get pick counts for affected users
      const { data: appPicks, error: appPicksError } = await supabase
        .from('app_picks')
        .select('user_id')
        .eq('gw', 18)
        .in('user_id', allAffectedUserIds);

      if (appPicksError) throw appPicksError;

      const { data: webPicks, error: webPicksError } = await supabase
        .from('picks')
        .select('user_id')
        .eq('gw', 18)
        .in('user_id', allAffectedUserIds);

      if (webPicksError) throw webPicksError;

      const appPickCounts = new Map();
      appPicks.forEach(p => {
        appPickCounts.set(p.user_id, (appPickCounts.get(p.user_id) || 0) + 1);
      });

      const webPickCounts = new Map();
      webPicks.forEach(p => {
        webPickCounts.set(p.user_id, (webPickCounts.get(p.user_id) || 0) + 1);
      });

      // Display results
      console.log('='.repeat(80));
      console.log('📋 DETAILED BREAKDOWN');
      console.log('='.repeat(80));
      console.log('');

      if (missingInWeb.length > 0) {
        console.log('❌ USERS MISSING IN WEB:');
        console.log('-'.repeat(80));
        for (const sub of missingInWeb) {
          const user = userMap.get(sub.user_id);
          const appCount = appPickCounts.get(sub.user_id) || 0;
          const webCount = webPickCounts.get(sub.user_id) || 0;
          
          console.log(`User ID: ${sub.user_id}`);
          console.log(`  Name: ${user?.name || 'Unknown'}`);
          console.log(`  App Submitted: ${sub.submitted_at}`);
          console.log(`  App Picks: ${appCount}`);
          console.log(`  Web Picks: ${webCount}`);
          console.log('');
        }
      }

      if (differentTimestamp.length > 0) {
        console.log('⚠️  USERS WITH DIFFERENT TIMESTAMPS:');
        console.log('-'.repeat(80));
        for (const sub of differentTimestamp) {
          const user = userMap.get(sub.user_id);
          const webSub = webSubmissions.find(ws => ws.user_id === sub.user_id);
          const appCount = appPickCounts.get(sub.user_id) || 0;
          const webCount = webPickCounts.get(sub.user_id) || 0;
          
          console.log(`User ID: ${sub.user_id}`);
          console.log(`  Name: ${user?.name || 'Unknown'}`);
          console.log(`  App Submitted: ${sub.submitted_at}`);
          console.log(`  Web Submitted: ${webSub?.submitted_at || 'N/A'}`);
          console.log(`  App Picks: ${appCount}`);
          console.log(`  Web Picks: ${webCount}`);
          console.log('');
        }
      }
    }

    // Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total app submissions (GW18): ${appSubmissions.length}`);
    console.log(`Total web submissions (GW18): ${webSubmissions.length}`);
    console.log(`Missing in web: ${missingInWeb.length}`);
    console.log(`Different timestamps: ${differentTimestamp.length}`);
    console.log(`Already synced: ${appSubmissions.length - missingInWeb.length - differentTimestamp.length}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error checking GW18 users:', error);
    process.exit(1);
  }
}

checkGw18Users();

