import { supabase } from "../lib/supabase";
import { getDeterministicLeagueAvatar } from "../lib/leagueAvatars";
import { VOLLEY_USER_ID } from "../lib/volley";
import { resolveLeagueStartGw } from "../lib/leagueStart";
import { fetchUserLeagues } from "./userLeagues";

export type League = {
  id: string;
  name: string;
  code: string;
  created_at: string;
  avatar?: string | null;
};

export type LeagueMember = {
  id: string;
  name: string;
};

export async function getLeagueByCode(code: string): Promise<League | null> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, code, name, created_at, avatar")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  const { data, error } = await supabase
    .from("league_members")
    .select("user_id, users(name)")
    .eq("league_id", leagueId);

  if (error) {
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.user_id,
    name: row.users?.name ?? "Unknown",
  }));
}

export async function joinLeague(code: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const league = await getLeagueByCode(code);
    if (!league) {
      return { success: false, error: "League not found" };
    }

    // Check if user is already in 20 mini-leagues (max limit)
    const userLeagues = await fetchUserLeagues(userId);
    if (userLeagues.length >= 20) {
      return { 
        success: false, 
        error: "You're already in 20 mini-leagues, which is the maximum. Leave a league before joining another." 
      };
    }

    // Check if league has been running for more than 4 gameweeks
    // Get current gameweek
    const { data: metaData } = await supabase
      .from("app_meta")
      .select("current_gw")
      .eq("id", 1)
      .maybeSingle();

    const currentGw = metaData?.current_gw ?? null;
    
    if (currentGw !== null) {
      // Calculate league start GW
      const leagueStartGw = await resolveLeagueStartGw(
        { id: league.id, name: league.name, created_at: league.created_at },
        currentGw
      );

      // Check if league has been running for 4+ gameweeks
      // If current_gw - league_start_gw >= 4, the league is locked
      if (currentGw - leagueStartGw >= 4) {
        return {
          success: false,
          error: "This league has been running for more than 4 gameweeks. New members can only be added during the first 4 gameweeks."
        };
      }
    }

    const members = await getLeagueMembers(league.id);
    if (members.length >= 8) {
      return { success: false, error: "League is full" };
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:entry',message:'joinLeague called',data:{code,userId:userId.slice(0,8)+'...',leagueId:league.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Check if user is already a member (before upsert)
    const { data: existingMember } = await supabase
      .from("league_members")
      .select("user_id")
      .eq("league_id", league.id)
      .eq("user_id", userId)
      .maybeSingle();

    const isNewMember = !existingMember;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:memberCheck',message:'Member check result',data:{leagueId:league.id,userId:userId.slice(0,8)+'...',isNewMember,hasExistingMember:!!existingMember},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    const { error } = await supabase
      .from("league_members")
      .upsert(
        { league_id: league.id, user_id: userId },
        { onConflict: "league_id,user_id" }
      );

    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:dbError',message:'Database upsert error',data:{error:error.message,leagueId:league.id,userId:userId.slice(0,8)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return { success: false, error: error.message };
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:upsertSuccess',message:'Successfully joined league',data:{leagueId:league.id,userId:userId.slice(0,8)+'...',isNewMember},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Send notification to other members if this is a new join (not just an upsert of existing member)
    if (isNewMember) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:notificationStart',message:'Starting notification flow',data:{leagueId:league.id,userId:userId.slice(0,8)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      try {
        // Get user's name from users table
        const { data: userData } = await supabase
          .from("users")
          .select("name, email")
          .eq("id", userId)
          .maybeSingle();

        const userName = userData?.name || userData?.email || 'Someone';

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:userDataFetched',message:'User data fetched',data:{userName,hasName:!!userData?.name,hasEmail:!!userData?.email,userId:userId.slice(0,8)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:fetchCall',message:'Calling notifyLeagueMemberJoin function',data:{leagueId:league.id,userId:userId.slice(0,8)+'...',userName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion

        // Send notification asynchronously (don't block the join)
        const response = await fetch('/.netlify/functions/notifyLeagueMemberJoin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leagueId: league.id,
            userId: userId,
            userName: userName,
          }),
        });

        const responseText = await response.text();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:fetchResponse',message:'Notification function response',data:{status:response.status,ok:response.ok,bodyLength:responseText.length,bodyPreview:responseText.substring(0,200),leagueId:league.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion

        if (!response.ok) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:fetchError',message:'Notification function returned error',data:{status:response.status,body:responseText,leagueId:league.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          console.error('[joinLeague] Notification failed:', response.status, responseText);
        } else {
          try {
            const result = JSON.parse(responseText);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:notificationResult',message:'Notification result parsed',data:{ok:result.ok,sent:result.sent,recipients:result.recipients,breakdown:result.breakdown,userResults:result.result?.user_results,errors:result.result?.errors,fullResult:result.result,leagueId:league.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
            console.log('[joinLeague] Notification result:', result);
            
            // Log detailed failure info if failed
            if (result.breakdown?.failed > 0) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:failedDetails',message:'Notification failures detected',data:{failedCount:result.breakdown.failed,userResults:result.result?.user_results?.filter((r:any)=>r.result==='failed'),errors:result.result?.errors,leagueId:league.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
              // #endregion
              console.error('[joinLeague] Notification failures:', {
                failed: result.breakdown.failed,
                userResults: result.result?.user_results?.filter((r: any) => r.result === 'failed'),
                errors: result.result?.errors
              });
            }
          } catch (parseError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:parseError',message:'Failed to parse notification response',data:{error:String(parseError),responseText:responseText.substring(0,500),leagueId:league.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            console.error('[joinLeague] Failed to parse notification response:', parseError);
          }
        }
      } catch (notifError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:exception',message:'Exception sending notification',data:{error:String(notifError),stack:notifError?.stack?.substring(0,200),leagueId:league.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        // Log error but don't fail the join if notification fails
        console.error('[joinLeague] Error sending notification:', notifError);
      }
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:skipNotification',message:'Skipping notification - not a new member',data:{leagueId:league.id,userId:userId.slice(0,8)+'...',isNewMember},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'leagues.ts:joinLeague:exit',message:'joinLeague returning success',data:{leagueId:league.id,userId:userId.slice(0,8)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to join league" };
  }
}

export async function leaveLeague(leagueId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to leave league" };
  }
}

export async function createLeague(name: string, userId: string): Promise<{ success: boolean; league?: League; error?: string }> {
  try {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();

    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .insert({ name, code })
      .select("id, name, code, created_at")
      .single();

    if (leagueError) {
      return { success: false, error: leagueError.message };
    }

    // Assign deterministic avatar based on league ID (after creation)
    const avatar = getDeterministicLeagueAvatar(league.id);
    await supabase
      .from("leagues")
      .update({ avatar })
      .eq("id", league.id);

    // Return league with avatar
    const leagueWithAvatar = { ...league, avatar };

    const { error: memberError } = await supabase
      .from("league_members")
      .insert({ league_id: league.id, user_id: userId });

    if (memberError) {
      return { success: false, error: memberError.message };
    }

    // Send Volley's welcome message as the first message in the chat
    try {
      const welcomeMessages = [
        "Hello 👋 I'm Volley. I'll let you know who wins and when new Gameweeks are ready to play.",
        "Hi — I'm Volley 🦄 I'll share results and let you know when new Gameweeks are ready.",
        "I'm Volley. I'll handle the scoring and tell you when new Gameweeks are ready to play.",
        "I'm Volley 🦄 I'll let you know who wins, plus when new Gameweeks are ready.",
        "Hello, I'm Volley. I'll keep track of results and new Gameweeks for you.",
      ];
      const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
      
      await supabase
        .from("league_messages")
        .insert({
          league_id: league.id,
          user_id: VOLLEY_USER_ID,
          content: randomMessage,
        });
    } catch (error) {
      // Log error but don't fail league creation if message insert fails
      console.error('[createLeague] Failed to insert Volley welcome message:', error);
    }

    return { success: true, league: leagueWithAvatar };
  } catch (error) {
    return { success: false, error: "Failed to create league" };
  }
}