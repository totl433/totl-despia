import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Goal {
  minute: number | null;
  scorer: string | null;
  scorerId: number | null;
  team: string | null;
  teamId: number | null;
}

export interface RedCard {
  minute: number | null;
  player: string | null;
  playerId: number | null;
  team: string | null;
  teamId: number | null;
}

export interface LiveScore {
  api_match_id: number;
  gw: number;
  fixture_index: number;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  minute: number | null;
  home_team: string | null;
  away_team: string | null;
  kickoff_time: string | null;
  goals: Goal[] | null;
  red_cards: RedCard[] | null;
}

/**
 * Hook to subscribe to live scores in real-time
 * @param gw - Gameweek to subscribe to (optional, if not provided subscribes to all)
 * @param apiMatchIds - Specific match IDs to subscribe to (optional)
 */
export function useLiveScores(gw?: number, apiMatchIds?: number[]) {
  const [liveScores, setLiveScores] = useState<Map<number, LiveScore>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let alive = true;

    async function setupSubscription() {
      try {
        // First, fetch initial live scores
        let query = supabase
          .from('live_scores')
          .select('*');

        if (gw !== undefined) {
          query = query.eq('gw', gw);
        }

        if (apiMatchIds && apiMatchIds.length > 0) {
          query = query.in('api_match_id', apiMatchIds);
        }

        const { data: initialData, error: fetchError } = await query;

        if (fetchError) {
          console.error('[useLiveScores] Error fetching initial scores:', fetchError);
          if (alive) {
            setError(fetchError.message);
            setLoading(false);
          }
          return;
        }

        // Initialize map with initial data
        const initialMap = new Map<number, LiveScore>();
        (initialData || []).forEach((score: LiveScore) => {
          initialMap.set(score.api_match_id, score);
        });

        if (alive) {
          setLiveScores(initialMap);
          setLoading(false);
        }

        // Set up real-time subscription
        // Subscribe to ALL changes on live_scores table, then filter in the callback
        // This ensures we catch all updates even if filters don't match exactly
        const channelName = `live_scores_${gw || 'all'}_${apiMatchIds?.join('-') || 'all'}_${Date.now()}`;
        
        // Subscribe WITHOUT any filter to catch ALL changes
        // We'll filter in the callback based on our criteria
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
              schema: 'public',
              table: 'live_scores',
              // NO FILTER - subscribe to ALL changes on the table
            },
            (payload) => {

              if (!alive) return;

              // Filter in the callback based on our criteria
              const shouldInclude = (score: LiveScore | null) => {
                if (!score) return false;
                
                // If we have a gw filter, check it
                if (gw !== undefined && score.gw !== gw) {
                  return false;
                }
                
                // If we have apiMatchIds filter, check it
                // BUT: if apiMatchIds is empty or undefined, include all
                if (apiMatchIds && apiMatchIds.length > 0) {
                  if (!apiMatchIds.includes(score.api_match_id)) {
                    return false;
                  }
                }
                
                return true;
              };

              setLiveScores((prev) => {
                const updated = new Map(prev);
                let hasChanges = false;

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                  const newScore = payload.new as LiveScore;
                  if (shouldInclude(newScore)) {
                    const prevScore = prev.get(newScore.api_match_id);
                    // Check if score, status, goals, or red cards changed
                    const scoreChanged = !prevScore || 
                      prevScore.home_score !== newScore.home_score ||
                      prevScore.away_score !== newScore.away_score ||
                      prevScore.status !== newScore.status ||
                      JSON.stringify(prevScore.goals) !== JSON.stringify(newScore.goals) ||
                      JSON.stringify(prevScore.red_cards) !== JSON.stringify(newScore.red_cards);
                    
                    if (scoreChanged) {
                      updated.set(newScore.api_match_id, newScore);
                      hasChanges = true;
                    }
                  }
                } else if (payload.eventType === 'DELETE') {
                  const oldScore = payload.old as LiveScore;
                  if (shouldInclude(oldScore)) {
                    updated.delete(oldScore.api_match_id);
                    hasChanges = true;
                  }
                }

                // Always return a new Map instance to ensure React detects the change
                return hasChanges ? new Map(updated) : new Map(prev);
              });
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.error('[useLiveScores] Channel error:', status);
              if (alive) {
                setError('Failed to subscribe to live scores');
              }
            }
          });

      } catch (err: any) {
        console.error('[useLiveScores] Error setting up subscription:', err);
        if (alive) {
          setError(err?.message || 'Failed to set up live scores subscription');
          setLoading(false);
        }
      }
    }

    setupSubscription();

    return () => {
      alive = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [gw, apiMatchIds ? apiMatchIds.join(',') : undefined]);

  return { liveScores, loading, error };
}

