#!/usr/bin/env node

/**
 * Test script to verify Supabase real-time is enabled for live_scores table
 * Run this to check if real-time replication is set up correctly
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRealtime() {
  console.log('🧪 Testing Supabase Real-time for live_scores table...\n');

  // Check if we can query the table
  const { data: testData, error: queryError } = await supabase
    .from('live_scores')
    .select('*')
    .limit(1);

  if (queryError) {
    console.error('❌ Error querying live_scores table:', queryError);
    return;
  }

  console.log('✅ Can query live_scores table');

  // Set up a real-time subscription
  console.log('\n📡 Setting up real-time subscription...');
  
  const channel = supabase
    .channel('test-realtime-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_scores',
      },
      (payload) => {
        console.log('\n🔔 REAL-TIME UPDATE RECEIVED!');
        console.log('Event type:', payload.eventType);
        console.log('New data:', payload.new);
        console.log('Old data:', payload.old);
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to real-time updates!');
        console.log('\n📝 Now try updating a score in the live_scores table...');
        console.log('   You should see a real-time update appear above.');
        console.log('\n⏳ Waiting for updates (press Ctrl+C to exit)...\n');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error - real-time might not be enabled for live_scores table');
        console.error('   Go to Supabase Dashboard → Database → Replication');
        console.error('   Find "live_scores" and enable replication');
      } else if (status === 'TIMED_OUT') {
        console.error('⏱️  Subscription timed out');
      }
    });

  // Keep the script running
  process.on('SIGINT', () => {
    console.log('\n\n👋 Cleaning up subscription...');
    supabase.removeChannel(channel);
    process.exit(0);
  });
}

testRealtime();


