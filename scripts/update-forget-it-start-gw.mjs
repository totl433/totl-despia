#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateForgetItStartGw() {
  console.log('Updating "forget it" league start_gw to 8...');
  
  const { data, error } = await supabase
    .from('leagues')
    .update({ start_gw: 8 })
    .eq('name', 'forget it')
    .select('id, name, start_gw');
  
  if (error) {
    console.error('Error updating league:', error);
    process.exit(1);
  }
  
  if (data && data.length > 0) {
    console.log('✅ Updated "forget it" league:', data[0]);
  } else {
    console.log('⚠️  No league found with name "forget it"');
  }
}

updateForgetItStartGw();
