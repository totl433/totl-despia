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
    let pollInterval: number | null = null;
    let lastUpdateTime = Date.now();

    async function fetchLiveScores() {
      try {
        let query = supabase
          .from('live_scores')
          .select('*');

        if (gw !== undefined) {
          query = query.eq('gw', gw);
        }

        if (apiMatchIds && apiMatchIds.length > 0) {
          query = query.in('api_match_id', apiMatchIds);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          console.error('[useLiveScores] Error fetching scores:', fetchError);
          if (alive) {
            setError(fetchError.message);
            setLoading(false);
          }
          return;
        }

        console.log('[useLiveScores] Fetched live scores:', (data || []).length, 'records');
        if (apiMatchIds && apiMatchIds.length > 0) {
          console.log('[useLiveScores] Looking for api_match_ids:', apiMatchIds);
          console.log('[useLiveScores] Found api_match_ids in response:', (data || []).map((s: LiveScore) => s.api_match_id));
        }

        // Initialize map with fetched data
        const fetchedMap = new Map<number, LiveScore>();
        (data || []).forEach((score: LiveScore) => {
          fetchedMap.set(score.api_match_id, score);
        });

        if (alive) {
          setLiveScores((prev) => {
            // Check if anything actually changed
            let hasChanges = false;
            const updated = new Map(prev);
            
            fetchedMap.forEach((newScore, apiMatchId) => {
              const prevScore = prev.get(apiMatchId);
              if (!prevScore || 
                  prevScore.home_score !== newScore.home_score ||
                  prevScore.away_score !== newScore.away_score ||
                  prevScore.status !== newScore.status ||
                  prevScore.minute !== newScore.minute ||
                  JSON.stringify(prevScore.goals) !== JSON.stringify(newScore.goals) ||
                  JSON.stringify(prevScore.red_cards) !== JSON.stringify(newScore.red_cards)) {
                updated.set(apiMatchId, newScore);
                hasChanges = true;
              }
            });
            
            // Check for deleted scores
            prev.forEach((_, apiMatchId) => {
              if (!fetchedMap.has(apiMatchId)) {
                updated.delete(apiMatchId);
                hasChanges = true;
              }
            });
            
            return hasChanges ? new Map(updated) : prev;
          });
          setLoading(false);
          lastUpdateTime = Date.now();
        }
      } catch (err: any) {
        console.error('[useLiveScores] Error fetching scores:', err);
        if (alive) {
          setError(err?.message || 'Failed to fetch live scores');
          setLoading(false);
        }
      }
    }

    async function setupSubscription() {
      try {
        // First, fetch initial live scores
        await fetchLiveScores();

        // Set up real-time subscription
        const channelName = `live_scores_${gw || 'all'}_${apiMatchIds?.join('-') || 'all'}_${Date.now()}`;
        
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'live_scores',
            },
            (payload) => {
              if (!alive) return;

              const shouldInclude = (score: LiveScore | null) => {
                if (!score) return false;
                
                if (gw !== undefined && score.gw !== gw) {
                  return false;
                }
                
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
                  console.log('[useLiveScores] Real-time update received:', payload.eventType, newScore?.api_match_id);
                  if (shouldInclude(newScore)) {
                    const prevScore = prev.get(newScore.api_match_id);
                    const scoreChanged = !prevScore || 
                      prevScore.home_score !== newScore.home_score ||
                      prevScore.away_score !== newScore.away_score ||
                      prevScore.status !== newScore.status ||
                      prevScore.minute !== newScore.minute ||
                      JSON.stringify(prevScore.goals) !== JSON.stringify(newScore.goals) ||
                      JSON.stringify(prevScore.red_cards) !== JSON.stringify(newScore.red_cards);
                    
                    if (scoreChanged) {
                      updated.set(newScore.api_match_id, newScore);
                      hasChanges = true;
                      lastUpdateTime = Date.now();
                      console.log('[useLiveScores] Updated score for match', newScore.api_match_id, 'minute:', newScore.minute);
                    }
                  }
                } else if (payload.eventType === 'DELETE') {
                  const oldScore = payload.old as LiveScore;
                  if (shouldInclude(oldScore)) {
                    updated.delete(oldScore.api_match_id);
                    hasChanges = true;
                  }
                }

                return hasChanges ? new Map(updated) : new Map(prev);
              });
            }
          )
          .subscribe((status) => {
            console.log('[useLiveScores] Subscription status:', status);
            if (status === 'SUBSCRIBED') {
              console.log('[useLiveScores] Successfully subscribed to real-time updates');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('[useLiveScores] Channel error:', status);
              if (alive) {
                setError('Real-time subscription failed, using polling fallback');
                // Start polling as fallback
                if (!pollInterval) {
                  pollInterval = window.setInterval(() => {
                    if (alive) {
                      fetchLiveScores();
                    }
                  }, 5000); // Poll every 5 seconds if real-time fails
                }
              }
            }
          });

        // Fallback polling: If no real-time updates received for 30 seconds, start polling
        const fallbackCheck = setInterval(() => {
          const timeSinceLastUpdate = Date.now() - lastUpdateTime;
          if (timeSinceLastUpdate > 30000 && !pollInterval) {
            console.warn('[useLiveScores] No real-time updates for 30s, starting polling fallback');
            pollInterval = window.setInterval(() => {
              if (alive) {
                fetchLiveScores();
              }
            }, 5000);
          }
        }, 10000); // Check every 10 seconds

        // Cleanup fallback check on unmount
        return () => {
          clearInterval(fallbackCheck);
        };

      } catch (err: any) {
        console.error('[useLiveScores] Error setting up subscription:', err);
        if (alive) {
          setError(err?.message || 'Failed to set up live scores subscription');
          setLoading(false);
          // Start polling as fallback
          if (!pollInterval) {
            pollInterval = window.setInterval(() => {
              if (alive) {
                fetchLiveScores();
              }
            }, 5000);
          }
        }
      }
    }

    setupSubscription();

    return () => {
      alive = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [gw, apiMatchIds ? apiMatchIds.join(',') : undefined]);

  return { liveScores, loading, error };
}

