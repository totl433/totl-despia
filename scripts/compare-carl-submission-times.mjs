import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function compareCarlSubmissionTimes() {
  console.log('Finding Carl and comparing submission times...\n');

  // Find Carl's user ID
  const { data: carlUsers, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', 'carl');

  if (userError) {
    console.error('Error finding Carl:', userError);
    return;
  }

  if (!carlUsers || carlUsers.length === 0) {
    console.log('❌ No user named Carl found');
    return;
  }

  // Get current GW from meta
  const { data: metaData } = await supabase
    .from('meta')
    .select('current_gw')
    .eq('id', 1)
    .maybeSingle();

  const currentGw = metaData?.current_gw ?? 1;

  for (const carl of carlUsers) {
    console.log(`\n📋 ${carl.name} (ID: ${carl.id})`);
    console.log('─'.repeat(60));

    // Get Test API submission
    const { data: testSubmission } = await supabase
      .from('test_api_submissions')
      .select('submitted_at, matchday')
      .eq('user_id', carl.id)
      .eq('matchday', 1)
      .maybeSingle();

    // Get main game submissions for current GW and a few previous GWs
    const { data: mainSubmissions } = await supabase
      .from('gw_submissions')
      .select('gw, submitted_at')
      .eq('user_id', carl.id)
      .in('gw', [currentGw, currentGw - 1, currentGw - 2, currentGw - 3, currentGw - 4])
      .order('gw', { ascending: false });

    console.log('\n🎮 Test API Submission:');
    if (testSubmission?.submitted_at) {
      const testDate = new Date(testSubmission.submitted_at);
      console.log(`  ✅ Submitted: ${testDate.toLocaleString()}`);
      console.log(`     Matchday: ${testSubmission.matchday}`);
      console.log(`     Timestamp: ${testSubmission.submitted_at}`);
    } else {
      console.log(`  ❌ No Test API submission found`);
    }

    console.log('\n🏆 Main Game Submissions:');
    if (mainSubmissions && mainSubmissions.length > 0) {
      mainSubmissions.forEach(sub => {
        const subDate = new Date(sub.submitted_at);
        console.log(`  GW ${sub.gw}: ${subDate.toLocaleString()}`);
        console.log(`     Timestamp: ${sub.submitted_at}`);
      });
    } else {
      console.log(`  ❌ No main game submissions found for recent GWs`);
    }

    // Compare times if both exist
    if (testSubmission?.submitted_at && mainSubmissions && mainSubmissions.length > 0) {
      const testTime = new Date(testSubmission.submitted_at).getTime();
      const currentGwSub = mainSubmissions.find(s => s.gw === currentGw);
      
      if (currentGwSub) {
        const mainTime = new Date(currentGwSub.submitted_at).getTime();
        const timeDiff = Math.abs(testTime - mainTime);
        const timeDiffMinutes = Math.floor(timeDiff / (1000 * 60));
        const timeDiffSeconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        
        console.log('\n⏱️  Comparison:');
        if (timeDiff < 60000) { // Less than 1 minute
          console.log(`  ✅ Submitted within ${timeDiffSeconds} seconds of each other (same session)`);
        } else if (timeDiff < 300000) { // Less than 5 minutes
          console.log(`  ⚠️  Submitted ${timeDiffMinutes} minutes apart`);
        } else {
          console.log(`  ℹ️  Submitted ${timeDiffMinutes} minutes apart (different sessions)`);
        }
      }
    }
  }
}

compareCarlSubmissionTimes().catch(console.error);

