import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const VOLLEY_USER_ID = '00000000-0000-0000-0000-000000000001';

const congratulations = [
  (name: string) => `🎉 We have a winner! Congrats to ${name} — top of the table this round.`,
  (name: string) => `🏆 Round complete. Take a bow, ${name}.`,
  (name: string) => `👏 And the winner is… ${name}! Nicely done.`,
  (name: string) => `🥇 That one belongs to ${name}. Strong week.`,
];

const drawCongratulations = [
  (winners: string) => `It's a draw! Congrats to ${winners}.`,
  (winners: string) => `A draw at the top — well played ${winners}.`,
  (winners: string) => `Shared honours this round. Congrats to ${winners}.`,
  (winners: string) => `This round ends in a draw. Well done ${winners}.`,
  (winners: string) => `Too close to separate — it's a draw. Congrats ${winners}.`,
];

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { gameweek } = JSON.parse(event.body || '{}');
    
    if (!gameweek || typeof gameweek !== 'number') {
      return json(400, { error: 'gameweek number required' });
    }

    // Get all active leagues
    const { data: leagues, error: leaguesError } = await admin
      .from('leagues')
      .select('id, name');

    if (leaguesError) throw leaguesError;

    const results = [];
    
    for (const league of leagues || []) {
      // Get league members
      const { data: members, error: membersError } = await admin
        .from('league_members')
        .select('user_id')
        .eq('league_id', league.id);

      if (membersError) {
        results.push({ leagueId: league.id, skipped: true, reason: `membersError: ${membersError.message}` });
        continue;
      }
      if (!members || members.length < 2) {
        results.push({ leagueId: league.id, skipped: true, reason: 'single-member league' });
        continue; // Skip single-member leagues
      }

      // Get user names for members
      const memberIds = members.map(m => m.user_id);
      const { data: users, error: usersError } = await admin
        .from('users')
        .select('id, name')
        .in('id', memberIds);

      if (usersError || !users) {
        results.push({ leagueId: league.id, skipped: true, reason: `usersError: ${usersError?.message || 'no users'}` });
        continue;
      }

      const nameById = new Map(users.map(u => [u.id, u.name]));

      // Get picks for this gameweek (check both app_picks and gw_picks tables)
      const [appPicksResult, picksResult] = await Promise.all([
        admin.from('app_picks').select('user_id, fixture_index, pick').eq('gw', gameweek).in('user_id', memberIds),
        admin.from('gw_picks').select('user_id, fixture_index, pick').eq('gw', gameweek).in('user_id', memberIds),
      ]);

      const picks = [...(appPicksResult.data || []), ...(picksResult.data || [])];
      if (picks.length === 0) {
        results.push({ leagueId: league.id, skipped: true, reason: 'no picks for this gameweek' });
        continue;
      }

      // Get results for this gameweek
      const { data: resultsData, error: resultsError } = await admin
        .from('app_gw_results')
        .select('fixture_index, result')
        .eq('gw', gameweek);

      if (resultsError || !resultsData || resultsData.length === 0) {
        results.push({ leagueId: league.id, skipped: true, reason: `resultsError: ${resultsError?.message || 'no results'}` });
        continue;
      }

      // Build result map
      const resultMap = new Map<string, 'H' | 'D' | 'A'>();
      resultsData.forEach(r => {
        if (r.result) {
          resultMap.set(r.fixture_index.toString(), r.result as 'H' | 'D' | 'A');
        }
      });

      // Calculate scores for each member
      const scores = new Map<string, { score: number; unicorns: number }>();
      memberIds.forEach(id => {
        scores.set(id, { score: 0, unicorns: 0 });
      });

      // Count correct predictions and unicorns
      picks.forEach(pick => {
        const result = resultMap.get(pick.fixture_index.toString());
        if (result && pick.pick === result) {
          const current = scores.get(pick.user_id) || { score: 0, unicorns: 0 };
          current.score++;
          
          // Check for unicorn (only correct prediction for this fixture)
          const correctForFixture = picks.filter(
            p => p.fixture_index === pick.fixture_index && p.pick === result
          );
          if (correctForFixture.length === 1 && memberIds.length >= 3) {
            current.unicorns++;
          }
          
          scores.set(pick.user_id, current);
        }
      });

      // Find winner(s)
      const scoreArray = Array.from(scores.entries())
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);

      if (scoreArray.length === 0 || scoreArray[0].score === 0) {
        results.push({ leagueId: league.id, skipped: true, reason: 'no winner' });
        continue;
      }

      const topScore = scoreArray[0].score;
      const topUnicorns = scoreArray[0].unicorns;
      const winners = scoreArray.filter(
        w => w.score === topScore && w.unicorns === topUnicorns
      );

      // Check if we already sent a congratulations for this GW in this league
      // More specific check: look for messages containing gameweek-specific congratulations patterns
      // Exclude welcome messages by checking for specific congratulations patterns
      // and created around the time results would be available (within last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: existingMessage } = await admin
        .from('league_messages')
        .select('id, content, created_at')
        .eq('league_id', league.id)
        .eq('user_id', VOLLEY_USER_ID)
        .gte('created_at', sevenDaysAgo.toISOString())
        .or('content.ilike.%congrats to%,content.ilike.%take a bow%,content.ilike.%winner is…%,content.ilike.%belongs to%,content.ilike.%draw!%,content.ilike.%shared honours%,content.ilike.%well played%,content.ilike.%round complete%')
        .limit(1);

      if (existingMessage && existingMessage.length > 0) {
        // Double-check: make sure it's not the welcome message
        const content = existingMessage[0].content.toLowerCase();
        const isWelcomeMessage = content.includes("i'm volley") || content.includes("i'll let you know") || content.includes("i'll share results") || content.includes("i'll handle the scoring") || content.includes("i'll keep track");
        
        if (!isWelcomeMessage) {
          results.push({ leagueId: league.id, skipped: true, reason: 'already sent', existingMessage: existingMessage[0].content });
          continue;
        }
      }

      // Format winners list for draw messages
      const formatWinnersList = (winnerIds: string[]): string => {
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

      // Create congratulatory message
      if (winners.length === 1) {
        const winnerName = nameById.get(winners[0].userId) || 'Someone';
        const randomCongrats = congratulations[Math.floor(Math.random() * congratulations.length)];
        const message = randomCongrats(winnerName);

        // Insert message as Volley
        const { error: insertError } = await admin
          .from('league_messages')
          .insert({
            league_id: league.id,
            user_id: VOLLEY_USER_ID,
            content: message,
          });

        if (insertError) {
          results.push({ leagueId: league.id, error: insertError.message });
        } else {
          results.push({ leagueId: league.id, success: true, message });
        }
      } else if (winners.length > 1) {
        // Handle draws
        const winnersList = formatWinnersList(winners.map(w => w.userId));
        const randomDrawCongrats = drawCongratulations[Math.floor(Math.random() * drawCongratulations.length)];
        const message = randomDrawCongrats(winnersList);

        // Insert message as Volley
        const { error: insertError } = await admin
          .from('league_messages')
          .insert({
            league_id: league.id,
            user_id: VOLLEY_USER_ID,
            content: message,
          });

        if (insertError) {
          results.push({ leagueId: league.id, error: insertError.message });
        } else {
          results.push({ leagueId: league.id, success: true, message });
        }
      } else {
        // No winners (shouldn't happen due to earlier check, but just in case)
        results.push({ leagueId: league.id, skipped: true, reason: 'no winner' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const errorCount = results.filter(r => r.error).length;

    console.log(`[sendVolleyGwCongratulations] GW ${gameweek}: ${successCount} sent, ${skippedCount} skipped, ${errorCount} errors out of ${leagues?.length || 0} total leagues`);

    return json(200, {
      ok: true,
      gameweek,
      results,
      totalLeagues: leagues?.length || 0,
      successCount,
      skippedCount,
      errorCount,
    });
  } catch (error: any) {
    console.error('[sendVolleyGwCongratulations] Error:', error);
    return json(500, { error: error.message || 'Internal server error' });
  }
};

