import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Goal {
  minute: number | null;
  scorer: string | null;
  scorerId: number | null;
  team: string | null;
  teamId: number | null;
  isOwnGoal?: boolean;
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
  // Stabilize apiMatchIds to prevent unnecessary re-subscriptions
  // Use a ref to track previous key and array, only update if IDs actually changed
  const stableRef = useRef<{ key: string; array: number[] | undefined }>({ 
    key: '', 
    array: undefined 
  });
  
  // Create a stable key string from the array for dependency tracking
  const apiMatchIdsKey = useMemo(() => {
    if (!apiMatchIds || apiMatchIds.length === 0) return '';
    return apiMatchIds.slice().sort().join(',');
  }, [apiMatchIds]);
  
  const stableApiMatchIds = useMemo(() => {
    // If key hasn't changed, return the previous array reference
    if (stableRef.current.key === apiMatchIdsKey) {
      return stableRef.current.array;
    }
    
    // Key changed, update ref and return new array
    stableRef.current = {
      key: apiMatchIdsKey,
      array: apiMatchIdsKey ? apiMatchIdsKey.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : undefined
    };
    
    return stableRef.current.array;
  }, [apiMatchIdsKey]);
  
  // Load from cache immediately (cache is populated during initial data load)
  const [liveScores, setLiveScores] = useState<Map<number, LiveScore>>(() => {
    if (!gw) return new Map();
    try {
      // Live scores are cached in fixtures cache
      // Try to get them from any fixtures cache key (they're stored together)
      // For now, return empty map - HomePage loads from its own cache
      return new Map();
    } catch {
      return new Map();
    }
  });
  const [loading, setLoading] = useState(false); // Start with false if we have cache
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let alive = true;
    let pollInterval: number | null = null;
    let lastUpdateTime = Date.now();
    let isSettingUp = false;

    // Check cache first
    const loadFromCache = () => {
      if (!gw) return;
      try {
        // Live scores might be cached in multiple places - check fixtures cache
        // HomePage handles this, but we can also check a dedicated cache if it exists
        // For now, rely on HomePage's cache loading - this hook will just fetch fresh data
        return false; // No dedicated cache check here - HomePage handles it
      } catch {
        return false;
      }
    };

    async function fetchLiveScores(_isInitialCheck: boolean = false) {
      if (!alive) return;
      try {
        let query = supabase
          .from('live_scores')
          .select('*');

        if (gw !== undefined) {
          query = query.eq('gw', gw);
          // When GW is provided, fetch ALL live scores for that GW
          // Don't filter by apiMatchIds because some fixtures might not have api_match_id set yet
          // but still have live scores in the database
        } else if (stableApiMatchIds && stableApiMatchIds.length > 0) {
          // Only filter by apiMatchIds if no GW is provided
          query = query.in('api_match_id', stableApiMatchIds);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          if (alive) {
            setError(fetchError.message);
            setLoading(false);
          }
          return;
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
      if (isSettingUp || !alive) return;
      isSettingUp = true;
      
      try {
        // Check cache first - if available, use it immediately, then refresh
        const hasCache = loadFromCache();
        
        // If no cache, set loading true for initial fetch
        if (!hasCache && liveScores.size === 0) {
          setLoading(true);
        }
        
        // Fetch initial live scores (or refresh if cache exists)
        await fetchLiveScores(true);

        if (!alive) {
          isSettingUp = false;
          return;
        }

        // Set up real-time subscription with stable channel name (no Date.now())
        const channelName = `live_scores_${gw || 'all'}_${stableApiMatchIds?.join('-') || 'all'}`;
        
        // Remove any existing channel first
        if (channel) {
          supabase.removeChannel(channel);
        }
        
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
                
                // If GW is provided, include all scores for that GW (don't filter by apiMatchIds)
                if (gw !== undefined) {
                  return score.gw === gw;
                }
                
                // If no GW but apiMatchIds provided, filter by apiMatchIds
                if (stableApiMatchIds && stableApiMatchIds.length > 0) {
                  return stableApiMatchIds.includes(score.api_match_id);
                }
                
                // If neither GW nor apiMatchIds provided, include all
                return true;
              };

              setLiveScores((prev) => {
                const updated = new Map(prev);
                let hasChanges = false;

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                  const newScore = payload.new as LiveScore;
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
                    }
                  }
                } else if (payload.eventType === 'DELETE') {
                  const oldScore = payload.old as LiveScore;
                  if (shouldInclude(oldScore)) {
                    updated.delete(oldScore.api_match_id);
                    hasChanges = true;
                  }
                }

                return hasChanges ? new Map(updated) : prev;
              });
            }
          )
          .subscribe((status) => {
            if (!alive) return;
            
            if (status === 'SUBSCRIBED') {
              isSettingUp = false;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              // Don't log as error - this is expected during cleanup
              isSettingUp = false;
              if (alive) {
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
          if (!alive) return;
          const timeSinceLastUpdate = Date.now() - lastUpdateTime;
          if (timeSinceLastUpdate > 30000 && !pollInterval) {
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
        isSettingUp = false;
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
      isSettingUp = false;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, [gw, stableApiMatchIds]);

  return { liveScores, loading, error };
}

