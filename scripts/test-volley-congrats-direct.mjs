#!/usr/bin/env node
/**
 * Test script to trigger Volley congratulations directly (no Netlify function needed)
 * Usage: node scripts/test-volley-congrats-direct.mjs [gameweek]
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Try multiple env var names
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);
const VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';

const congratulations = [
  (name) => `🎉 We have a winner! Congrats to ${name} — top of the table this round.`,
  (name) => `🏆 Round complete. Take a bow, ${name}.`,
  (name) => `👏 And the winner is… ${name}! Nicely done.`,
  (name) => `🥇 That one belongs to ${name}. Strong week.`,
];

const drawCongratulations = [
  (winners) => `It's a draw! Congrats to ${winners}.`,
  (winners) => `A draw at the top — well played ${winners}.`,
  (winners) => `Shared honours this round. Congrats to ${winners}.`,
  (winners) => `This round ends in a draw. Well done ${winners}.`,
  (winners) => `Too close to separate — it's a draw. Congrats ${winners}.`,
];

const targetGw = process.argv[2] ? parseInt(process.argv[2], 10) : null;

async function testVolleyCongratulations() {
  try {
    let gameweek = targetGw;

    // If no gameweek specified, find latest completed one
    if (!gameweek) {
      console.log('🔍 Finding latest completed gameweek...');
      const { data: results, error } = await admin
        .from('app_gw_results')
        .select('gw')
        .order('gw', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!results || results.length === 0) {
        console.error('❌ No completed gameweeks found');
        process.exit(1);
      }

      gameweek = results[0].gw;
      console.log(`✅ Found latest completed gameweek: ${gameweek}`);
    }

    console.log(`\n🚀 Sending Volley congratulations for Gameweek ${gameweek}...\n`);

    // Get all active leagues
    const { data: leagues, error: leaguesError } = await admin
      .from('leagues')
      .select('id, name');

    if (leaguesError) throw leaguesError;

    const results = [];
    let successCount = 0;
    let skipCount = 0;
    
    for (const league of leagues || []) {
      // Get league members
      const { data: members, error: membersError } = await admin
        .from('league_members')
        .select('user_id')
        .eq('league_id', league.id);

      if (membersError) continue;
      if (!members || members.length < 2) {
        skipCount++;
        continue; // Skip single-member leagues
      }

      // Get user names for members
      const memberIds = members.map(m => m.user_id);
      const { data: users, error: usersError } = await admin
        .from('users')
        .select('id, name')
        .in('id', memberIds);

      if (usersError || !users) continue;

      const nameById = new Map(users.map(u => [u.id, u.name]));

      // Get picks for this gameweek
      const [appPicksResult, picksResult] = await Promise.all([
        admin.from('app_picks').select('user_id, fixture_index, pick').eq('gw', gameweek).in('user_id', memberIds),
        admin.from('gw_picks').select('user_id, fixture_index, pick').eq('gw', gameweek).in('user_id', memberIds),
      ]);

      const picks = [...(appPicksResult.data || []), ...(picksResult.data || [])];
      if (picks.length === 0) continue;

      // Get results for this gameweek
      const { data: resultsData, error: resultsError } = await admin
        .from('app_gw_results')
        .select('fixture_index, result')
        .eq('gw', gameweek);

      if (resultsError || !resultsData || resultsData.length === 0) continue;

      // Build result map
      const resultMap = new Map();
      resultsData.forEach(r => {
        if (r.result) {
          resultMap.set(r.fixture_index.toString(), r.result);
        }
      });

      // Calculate scores
      const scores = new Map();
      memberIds.forEach(id => {
        scores.set(id, { score: 0, unicorns: 0 });
      });

      picks.forEach(pick => {
        const result = resultMap.get(pick.fixture_index.toString());
        if (result && pick.pick === result) {
          const current = scores.get(pick.user_id) || { score: 0, unicorns: 0 };
          current.score++;
          
          const correctForFixture = picks.filter(
            p => p.fixture_index === pick.fixture_index && p.pick === result
          );
          if (correctForFixture.length === 1 && memberIds.length >= 3) {
            current.unicorns++;
          }
          
          scores.set(pick.user_id, current);
        }
      });

      // Find winner
      const scoreArray = Array.from(scores.entries())
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);

      if (scoreArray.length === 0 || scoreArray[0].score === 0) {
        skipCount++;
        continue;
      }

      const topScore = scoreArray[0].score;
      const topUnicorns = scoreArray[0].unicorns;
      const winners = scoreArray.filter(
        w => w.score === topScore && w.unicorns === topUnicorns
      );

      // Check if already sent
      const { data: existingMessage } = await admin
        .from('league_messages')
        .select('id')
        .eq('league_id', league.id)
        .eq('user_id', VOLLEY_USER_ID)
        .or('content.ilike.%winner%,content.ilike.%round complete%,content.ilike.%winner is%,content.ilike.%belongs to%,content.ilike.%draw%,content.ilike.%shared honours%')
        .limit(1);

      if (existingMessage && existingMessage.length > 0) {
        skipCount++;
        continue;
      }

      // Format winners list for draw messages
      const formatWinnersList = (winnerIds) => {
        const winnerNames = winnerIds.map(id => nameById.get(id) || 'Someone');
        if (winnerNames.length === 1) {
          return winnerNames[0];
        } else if (winnerNames.length === 2) {
          return `${winnerNames[0]} and ${winnerNames[1]}`;
        } else {
          const allButLast = winnerNames.slice(0, -1).join(', ');
          const last = winnerNames[winnerNames.length - 1];
          return `${allButLast}, and ${last}`;
        }
      };

      // Send message
      if (winners.length === 1) {
        const winnerName = nameById.get(winners[0].userId) || 'Someone';
        const randomCongrats = congratulations[Math.floor(Math.random() * congratulations.length)];
        const message = randomCongrats(winnerName);

        const { error: insertError } = await admin
          .from('league_messages')
          .insert({
            league_id: league.id,
            user_id: VOLLEY_USER_ID,
            content: message,
          });

        if (insertError) {
          console.error(`  ❌ ${league.name}: ${insertError.message}`);
        } else {
          console.log(`  ✅ ${league.name}: "${message}"`);
          successCount++;
        }
      } else if (winners.length > 1) {
        // Handle draws
        const winnersList = formatWinnersList(winners.map(w => w.userId));
        const randomDrawCongrats = drawCongratulations[Math.floor(Math.random() * drawCongratulations.length)];
        const message = randomDrawCongrats(winnersList);

        const { error: insertError } = await admin
          .from('league_messages')
          .insert({
            league_id: league.id,
            user_id: VOLLEY_USER_ID,
            content: message,
          });

        if (insertError) {
          console.error(`  ❌ ${league.name}: ${insertError.message}`);
        } else {
          console.log(`  ✅ ${league.name}: "${message}"`);
          successCount++;
        }
      } else {
        skipCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Sent: ${successCount} leagues`);
    console.log(`   ⏭️  Skipped: ${skipCount} leagues (no winner/tie/already sent)`);
    console.log(`   📝 Total leagues: ${leagues?.length || 0}`);
    console.log(`\n💬 Check your mini-league chats to see Volley's messages!`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testVolleyCongratulations();

