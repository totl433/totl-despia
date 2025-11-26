import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkActivitySinceBackup() {
  try {
    // Backup time: 21 Nov 2025 03:35:56 UTC
    const backupTime = new Date('2025-11-21T03:35:56Z');
    console.log(`\n🔍 Checking for activity since backup: ${backupTime.toISOString()}\n`);

    // Check submissions (these have submitted_at timestamps)
    const { data: submissions, error: subsError } = await supabase
      .from('gw_submissions')
      .select('user_id, gw, submitted_at')
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false });

    if (subsError) {
      console.error('Error fetching submissions:', subsError);
      return;
    }

    const recentSubmissions = submissions?.filter(s => {
      const submittedAt = new Date(s.submitted_at);
      return submittedAt > backupTime;
    }) || [];

    console.log(`📊 Submissions since backup: ${recentSubmissions.length}`);
    
    if (recentSubmissions.length > 0) {
      console.log('\n⚠️  Recent submissions found:');
      recentSubmissions.forEach((sub, i) => {
        const date = new Date(sub.submitted_at);
        console.log(`   ${i + 1}. User ${sub.user_id.slice(0, 8)}... - GW${sub.gw} - ${date.toISOString()}`);
      });

      // Get unique user IDs
      const uniqueUsers = new Set(recentSubmissions.map(s => s.user_id));
      console.log(`\n   Total unique users who submitted: ${uniqueUsers.size}`);
    } else {
      console.log('✅ No submissions found since backup time');
    }

    // Check picks - we can't check exact time, but we can check for recent gameweeks
    // Get current gameweek
    const { data: meta } = await supabase
      .from('meta')
      .select('current_gw')
      .eq('id', 1)
      .single();

    const currentGw = meta?.current_gw;
    if (currentGw) {
      console.log(`\n📊 Checking picks for current GW${currentGw}...`);
      
      // Get all picks for current GW
      const { data: picks } = await supabase
        .from('picks')
        .select('user_id, gw, fixture_index')
        .eq('gw', currentGw);

      if (picks && picks.length > 0) {
        const uniqueUsersWithPicks = new Set(picks.map(p => p.user_id));
        console.log(`   Found ${picks.length} picks from ${uniqueUsersWithPicks.size} users for GW${currentGw}`);
        console.log(`   (Note: Picks don't have timestamps, so we can't tell exactly when they were made)`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (recentSubmissions.length > 0) {
      console.log('⚠️  WARNING: Restoring from backup will LOSE these recent submissions!');
      console.log(`   ${recentSubmissions.length} submissions from ${new Set(recentSubmissions.map(s => s.user_id)).size} users`);
    } else {
      console.log('✅ Safe to restore - no submissions found since backup time');
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkActivitySinceBackup().catch(console.error);

