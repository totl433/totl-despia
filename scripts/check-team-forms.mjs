// Quick script to check team form data
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const gw = parseInt(process.argv[2], 10) || 17;

console.log(`\n🔍 Checking team forms for GW ${gw}...\n`);

// Check Newcastle and Chelsea specifically
const { data: specificTeams, error: err1 } = await supabase
  .from('app_team_forms')
  .select('team_code, form')
  .eq('gw', gw)
  .in('team_code', ['NEW', 'CHE', 'NUFC'])
  .order('team_code');

if (err1) {
  console.error('Error:', err1);
} else {
  console.log('Newcastle & Chelsea:');
  specificTeams?.forEach(t => {
    console.log(`  ${t.team_code}: ${t.form}`);
  });
}

// Get all teams for GW 17
const { data: allTeams, error: err2 } = await supabase
  .from('app_team_forms')
  .select('team_code, form')
  .eq('gw', gw)
  .order('team_code');

if (err2) {
  console.error('Error:', err2);
} else {
  console.log(`\nAll teams for GW ${gw}:`);
  allTeams?.forEach(t => {
    console.log(`  ${t.team_code}: ${t.form}`);
  });
}




