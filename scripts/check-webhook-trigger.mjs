import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function checkTrigger() {
  console.log('Checking for live_scores webhook trigger...\n');

  // Query to check if the trigger exists
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        trigger_name,
        event_manipulation,
        event_object_table,
        action_statement
      FROM information_schema.triggers
      WHERE trigger_name = 'trg_notify_live_scores_webhook'
        AND event_object_table = 'live_scores';
    `,
  });

  if (error) {
    // Try alternative query using direct SQL
    const { data: triggerData, error: triggerError } = await supabase
      .from('_prisma_migrations')
      .select('*')
      .limit(0); // Just to test connection

    // Use raw SQL query via Supabase REST API or check via SQL editor
    console.log('Cannot query triggers directly via Supabase client.');
    console.log('Please run this SQL in Supabase SQL Editor:\n');
    console.log(`
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_notify_live_scores_webhook'
  AND event_object_table = 'live_scores';
    `);
    return;
  }

  if (data && data.length > 0) {
    console.log('❌ TRIGGER IS ACTIVE!');
    console.log('Found trigger:', data);
    console.log('\nTo remove it, run the SQL in: supabase/sql/remove_live_scores_webhook.sql');
  } else {
    console.log('✅ TRIGGER IS NOT ACTIVE');
    console.log('The trigger has been removed or never existed.');
  }
}

checkTrigger().catch(console.error);

