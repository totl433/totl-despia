import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSavedNotSubmitted() {
  console.log('🔍 Checking users who have SAVED picks but NOT SUBMITTED (READ-ONLY)...\n');

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

  console.log(`📊 Checking for GW${currentGw}\n`);

  // Get all fixtures for current GW to know how many picks are expected
  const { data: fixtures, error: fixturesError } = await supabase
    .from('fixtures')
    .select('fixture_index')
    .eq('gw', currentGw);

  if (fixturesError) {
    console.error('❌ Error fetching fixtures:', fixturesError.message);
    return;
  }

  const expectedPickCount = fixtures.length;
  console.log(`📋 Expected picks per user: ${expectedPickCount}\n`);

  // Get all users who have picks for current GW
  const { data: picks, error: picksError } = await supabase
    .from('picks')
    .select('user_id, fixture_index')
    .eq('gw', currentGw);

  if (picksError) {
    console.error('❌ Error fetching picks:', picksError.message);
    return;
  }

  // Group picks by user
  const picksByUser = new Map();
  picks.forEach(pick => {
    if (!picksByUser.has(pick.user_id)) {
      picksByUser.set(pick.user_id, new Set());
    }
    picksByUser.get(pick.user_id).add(pick.fixture_index);
  });

  // Get all users who have submitted
  const { data: submissions, error: subsError } = await supabase
    .from('gw_submissions')
    .select('user_id')
    .eq('gw', currentGw)
    .not('submitted_at', 'is', null);

  if (subsError) {
    console.error('❌ Error fetching submissions:', subsError.message);
    return;
  }

  const submittedUserIds = new Set(submissions.map(s => s.user_id));

  // Find users with picks but no submission
  const savedNotSubmitted = [];
  for (const [userId, pickIndices] of picksByUser.entries()) {
    if (!submittedUserIds.has(userId)) {
      savedNotSubmitted.push({
        user_id: userId,
        pick_count: pickIndices.size,
        is_complete: pickIndices.size === expectedPickCount
      });
    }
  }

  // Get user names
  const userIds = savedNotSubmitted.map(u => u.user_id);
  let userNames = new Map();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);

    if (!usersError && users) {
      users.forEach(u => {
        userNames.set(u.id, u.name);
      });
    }
  }

  console.log('='.repeat(80));
  console.log(`📊 Users with SAVED picks but NOT SUBMITTED for GW${currentGw}`);
  console.log('='.repeat(80));

  if (savedNotSubmitted.length === 0) {
    console.log('✅ No users found - everyone who has picks has submitted!\n');
    return;
  }

  // Sort by pick count (descending) then by name
  savedNotSubmitted.sort((a, b) => {
    if (b.pick_count !== a.pick_count) {
      return b.pick_count - a.pick_count;
    }
    const nameA = userNames.get(a.user_id) || '';
    const nameB = userNames.get(b.user_id) || '';
    return nameA.localeCompare(nameB);
  });

  console.log(`\nFound ${savedNotSubmitted.length} user(s):\n`);

  savedNotSubmitted.forEach((user, index) => {
    const name = userNames.get(user.user_id) || 'Unknown';
    const status = user.is_complete ? '✅ Complete' : `⚠️  Incomplete (${user.pick_count}/${expectedPickCount})`;
    console.log(`${String(index + 1).padStart(3)}. ${name.padEnd(30)} - ${status} (${user.user_id.slice(0, 8)}...)`);
  });

  // Summary
  const complete = savedNotSubmitted.filter(u => u.is_complete).length;
  const incomplete = savedNotSubmitted.filter(u => !u.is_complete).length;

  console.log('\n' + '='.repeat(80));
  console.log('📈 Summary:');
  console.log(`   Total with saved picks (not submitted): ${savedNotSubmitted.length}`);
  console.log(`   Complete picks (all ${expectedPickCount}): ${complete}`);
  console.log(`   Incomplete picks: ${incomplete}`);
  console.log('='.repeat(80));
  console.log('\n');
}

checkSavedNotSubmitted().catch(console.error);

