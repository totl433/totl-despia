import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkUnsubmittedUsers() {
  console.log('🔍 Checking which users haven\'t submitted predictions (READ-ONLY)...\n');

  // Get current gameweek
  const { data: meta, error: metaError } = await supabase
    .from('meta')
    .select('current_gw')
    .eq('id', 1)
    .single();

  if (metaError) {
    console.error('❌ Error fetching current gameweek:', metaError.message);
    return;
  }

  const currentGw = meta?.current_gw;
  if (!currentGw) {
    console.error('❌ No current gameweek found');
    return;
  }

  console.log(`📊 Checking submissions for GW${currentGw}\n`);

  // Get all users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name')
    .order('name');

  if (usersError) {
    console.error('❌ Error fetching users:', usersError.message);
    return;
  }

  // Get all submissions for current GW
  const { data: submissions, error: subsError } = await supabase
    .from('gw_submissions')
    .select('user_id, submitted_at')
    .eq('gw', currentGw)
    .not('submitted_at', 'is', null);

  if (subsError) {
    console.error('❌ Error fetching submissions:', subsError.message);
    return;
  }

  const submittedUserIds = new Set(submissions.map(s => s.user_id));
  const unsubmitted = users.filter(u => !submittedUserIds.has(u.id));

  console.log('='.repeat(60));
  console.log(`📊 Submission Status for GW${currentGw}`);
  console.log('='.repeat(60));
  console.log(`Total Users: ${users.length}`);
  console.log(`Users Submitted: ${submittedUserIds.size}`);
  console.log(`Users Not Submitted: ${unsubmitted.length}`);
  console.log(`Submission Rate: ${((submittedUserIds.size / users.length) * 100).toFixed(1)}%\n`);

  if (unsubmitted.length > 0) {
    console.log('❌ Users who HAVEN\'T submitted:');
    console.log('='.repeat(60));
    unsubmitted.forEach((user, index) => {
      console.log(`${String(index + 1).padStart(3)}. ${user.name || 'Unknown'} (${user.id.slice(0, 8)}...)`);
    });
    console.log('='.repeat(60));
  } else {
    console.log('✅ All users have submitted!\n');
  }

  if (submittedUserIds.size > 0) {
    console.log(`\n✅ Users who HAVE submitted (${submittedUserIds.size}):`);
    const submitted = users.filter(u => submittedUserIds.has(u.id));
    submitted.forEach((user, index) => {
      const submission = submissions.find(s => s.user_id === user.id);
      const submittedAt = submission ? new Date(submission.submitted_at).toLocaleString() : 'Unknown';
      console.log(`${String(index + 1).padStart(3)}. ${user.name || 'Unknown'} - Submitted: ${submittedAt}`);
    });
  }

  console.log('\n');
}

checkUnsubmittedUsers().catch(console.error);

