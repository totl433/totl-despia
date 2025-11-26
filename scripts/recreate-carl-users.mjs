import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// The Carl user IDs we need to recreate
const CARL_USERS = [
  { id: 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', name: 'Carl' }, // Main Carl
  { id: '8f52b4eb-dc80-4a74-a30f-cc1b8e27e7db', name: 'carls' },
  { id: '39ab58d2-6db1-400a-8094-fd2499a74376', name: 'carlss' },
  { id: '184d8634-549b-4be6-9513-92fc1c9c90e3', name: 'carl.' },
];

async function recreateCarlUsers() {
  console.log('🔄 Recreating Carl users...\n');

  for (const user of CARL_USERS) {
    try {
      // Check if user already exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (existing) {
        console.log(`✅ ${user.name} (${user.id}) - Already exists`);
        continue;
      }

      // Recreate user in users table
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          name: user.name,
          email: null, // We don't have email from the deletion
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error(`❌ Error creating ${user.name}:`, insertError.message);
      } else {
        console.log(`✅ Created ${user.name} (${user.id})`);
      }
    } catch (error) {
      console.error(`❌ Error with ${user.name}:`, error.message);
    }
  }

  console.log('\n⚠️  NOTE: User picks, submissions, and league memberships were deleted');
  console.log('   and cannot be automatically restored without a full database restore.');
  console.log('   The users are recreated, but they will need to:');
  console.log('   - Rejoin leagues');
  console.log('   - Make new picks');
  console.log('   - Resubmit predictions\n');
}

recreateCarlUsers().catch(console.error);

