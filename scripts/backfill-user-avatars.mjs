#!/usr/bin/env node
/**
 * Backfill script to generate default avatars for all legacy users
 * Run with: node scripts/backfill-user-avatars.mjs
 * 
 * This script:
 * 1. Finds all users without avatar_url
 * 2. Generates default avatars with initials and random colors
 * 3. Uploads to Supabase Storage
 * 4. Updates users.avatar_url
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env.local');
let envVars = {};
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (e) {
  console.log('No .env.local file found, using process.env');
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Set them in .env.local or as environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Color palette (same as in userAvatars.ts)
const AVATAR_COLORS = [
  '#1C8376', '#2563EB', '#7C3AED', '#DC2626', '#EA580C', '#CA8A04',
  '#059669', '#0891B2', '#DB2777', '#BE185D', '#9333EA', '#4F46E5',
  '#0EA5E9', '#14B8A6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1', '#14B8A6',
  '#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getUserAvatarColor(userId) {
  const hash = hashString(userId);
  const index = hash % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

// Note: Canvas API is not available in Node.js by default
// This script would need to use a library like 'canvas' or 'node-canvas'
// For now, this is a placeholder that shows the structure
// The actual image generation should be done client-side or via a serverless function

async function generateAvatarImage(initials, color, size = 200) {
  // In Node.js, you'd use 'canvas' package:
  // const { createCanvas } = require('canvas');
  // const canvas = createCanvas(size, size);
  // const ctx = canvas.getContext('2d');
  // ... draw circle and text ...
  // return canvas.toBuffer('image/png');
  
  // For now, return a placeholder
  throw new Error('Canvas generation not implemented in Node.js - use client-side script or serverless function');
}

async function backfillAvatars() {
  console.log('Starting avatar backfill...');

  // Find all users without avatars
  const { data: usersWithoutAvatars, error: fetchError } = await supabase
    .from('users')
    .select('id, name')
    .is('avatar_url', null);

  if (fetchError) {
    console.error('Error fetching users:', fetchError);
    return;
  }

  if (!usersWithoutAvatars || usersWithoutAvatars.length === 0) {
    console.log('No users need avatar backfill!');
    return;
  }

  console.log(`Found ${usersWithoutAvatars.length} users without avatars`);

  // Also check auth.users that might not be in public.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (!authError && authUsers?.users) {
    const authUserIds = new Set(authUsers.users.map(u => u.id));
    const publicUserIds = new Set(usersWithoutAvatars.map(u => u.id));
    
    // Find auth.users not in public.users
    for (const authUser of authUsers.users) {
      if (!publicUserIds.has(authUser.id)) {
        const displayName = authUser.user_metadata?.display_name || authUser.email || 'User';
        usersWithoutAvatars.push({
          id: authUser.id,
          name: displayName,
        });
      }
    }
  }

  console.log(`Total users to process: ${usersWithoutAvatars.length}`);

  // Process in batches to avoid overwhelming the system
  const batchSize = 10;
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < usersWithoutAvatars.length; i += batchSize) {
    const batch = usersWithoutAvatars.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} users)...`);

    for (const user of batch) {
      try {
        const initials = getInitials(user.name);
        const color = getUserAvatarColor(user.id);
        
        // Generate avatar (this would need canvas library in Node.js)
        // For now, we'll skip and log that this needs to be done client-side
        console.log(`  [SKIP] User ${user.id} (${user.name}): Would generate avatar with initials "${initials}" and color ${color}`);
        
        // TODO: Actually generate and upload avatar
        // const avatarBlob = await generateAvatarImage(initials, color, 200);
        // const fileName = `${user.id}.png`;
        // const { error: uploadError } = await supabase.storage
        //   .from('user-avatars')
        //   .upload(fileName, avatarBlob, { contentType: 'image/png', upsert: true });
        // if (uploadError) throw uploadError;
        // const { data } = supabase.storage.from('user-avatars').getPublicUrl(fileName);
        // await supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', user.id);
        
        processed++;
      } catch (error) {
        console.error(`  [ERROR] Failed to process user ${user.id}:`, error.message);
        errors++;
      }
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\nBackfill complete!`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Errors: ${errors}`);
  console.log(`\nNote: This script is a placeholder. Actual avatar generation`);
  console.log(`needs to be done client-side or via a serverless function that`);
  console.log(`can use Canvas API. Run the backfill from the browser console`);
  console.log(`or create a serverless function to handle this.`);
}

backfillAvatars().catch(console.error);


