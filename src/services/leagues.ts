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

    const { error } = await supabase
      .from("league_members")
      .upsert(
        { league_id: league.id, user_id: userId },
        { onConflict: "league_id,user_id" }
      );

    if (error) {
      return { success: false, error: error.message };
    }

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