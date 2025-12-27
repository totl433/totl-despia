#!/usr/bin/env node
/**
 * Fix external_user_id for all 7 app users at once
 * 
 * This calls the fixExternalUserIds Netlify function for each app user
 */

const APP_USER_IDS = [
  '4542c037-5b38-40d0-b189-847b8f17c222', // Jof
  'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', // Carl
  // Add other app user IDs here - we'll find them
];

const BASE_URL = 'https://totl-staging.netlify.app';

async function fixAllAppUsers() {
  console.log('🔧 Fixing external_user_id for all app users\n');
  console.log('='.repeat(60));

  // First, find all app users
  console.log('📋 Finding app users...\n');
  
  // All 8 app users (from appOnlyUsers.ts)
  const knownUsers = [
    { id: '4542c037-5b38-40d0-b189-847b8f17c222', name: 'Jof' },
    { id: 'f8a1669e-2512-4edf-9c21-b9f87b3efbe2', name: 'Carl' },
    { id: '9c0bcf50-370d-412d-8826-95371a72b4fe', name: 'SP' },
    { id: '36f31625-6d6c-4aa4-815a-1493a812841b', name: 'ThomasJamesBird' },
    { id: 'c94f9804-ba11-4cd2-8892-49657aa6412c', name: 'Sim' },
    { id: '42b48136-040e-42a3-9b0a-dc9550dd1cae', name: 'Will Middleton' },
    { id: 'd2cbeca9-7dae-4be1-88fb-706911d67256', name: 'David Bird' },
    { id: '027502c5-1cd7-4922-abd5-f9bcc569bb4d', name: 'cakehurst' },
  ];

  console.log(`Found ${knownUsers.length} known app users\n`);

  // Fix each user
  for (const user of knownUsers) {
    console.log(`\n🔧 Fixing ${user.name} (${user.id.slice(0, 8)}...)...`);
    console.log('-'.repeat(60));

    try {
      const response = await fetch(`${BASE_URL}/.netlify/functions/fixExternalUserIds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          limit: 1,
        }),
      });

      const result = await response.json();

      if (response.ok && result.fixed > 0) {
        console.log(`✅ ${user.name}: Fixed! (${result.fixed} device(s))`);
      } else if (response.ok && result.fixed === 0) {
        console.log(`⚠️  ${user.name}: No fix needed or device not subscribed`);
        if (result.skipped) {
          console.log(`   Skipped: ${result.skipped} (not subscribed)`);
        }
        if (result.failed) {
          console.log(`   Failed: ${result.failed}`);
          if (result.errors && result.errors.length > 0) {
            console.log(`   Errors: ${JSON.stringify(result.errors[0])}`);
          }
        }
      } else {
        console.log(`❌ ${user.name}: Error - ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error(`❌ ${user.name}: Exception - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Done! Check the results above.');
  console.log('\n💡 Next notification should work for all fixed users!');
}

fixAllAppUsers();

