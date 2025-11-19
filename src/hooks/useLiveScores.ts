import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type LiveScoreData = {
  homeScore: number;
  awayScore: number;
  status: string;
  minute?: number | null;
};

export function useLiveScores() {
  const [liveScores, setLiveScores] = useState<Record<number, LiveScoreData>>({});
  
  // Track previous scores to avoid duplicate notifications or updates
  const prevScoresRef = useRef<Record<number, { homeScore: number; awayScore: number }>>({});
  
  // Track API pull history for debugging
  const apiPullHistoryRef = useRef<Record<number, Array<{
    timestamp: Date;
    minute: number | null;
    status: string;
    homeScore: number;
    awayScore: number;
    kickoffTime: string | null;
    apiMinute: number | null | undefined;
    diffMinutes: number | null;
    halftimeEndTime: string | null;
    halftimeEndMinute: number | null;
    minutesSinceHalftimeEnd: number | null;
  }>>>({});

  const [expandedDebugLog, setExpandedDebugLog] = useState<Record<number, boolean>>({});

  const fetchLiveScore = useCallback(async (apiMatchId: number, kickoffTime?: string | null) => {
    try {
      // Read from Supabase live_scores table
      const { data: liveScore, error } = await supabase
        .from('live_scores')
        .select('*')
        .eq('api_match_id', apiMatchId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No row found
          return null;
        }
        console.error('[useLiveScores] Error fetching live score:', error);
        return null;
      }
      
      if (!liveScore) {
        return null;
      }
      
      const homeScore = liveScore.home_score ?? 0;
      const awayScore = liveScore.away_score ?? 0;
      const status = liveScore.status || 'SCHEDULED';
      let minute = liveScore.minute;
      
      // If minute is not provided, calculate from kickoff time (fallback)
      if ((minute === null || minute === undefined) && (status === 'IN_PLAY' || status === 'PAUSED') && kickoffTime) {
        try {
          const matchStart = new Date(kickoffTime);
          const now = new Date();
          const diffMinutes = Math.floor((now.getTime() - matchStart.getTime()) / (1000 * 60));
          
          if (diffMinutes > 0 && diffMinutes < 120) {
            if (status === 'PAUSED') {
              minute = null;
            } else if (status === 'IN_PLAY') {
              if (diffMinutes <= 50) {
                 minute = diffMinutes;
              } else {
                 // Rough estimate for 2nd half if no precise data
                 minute = diffMinutes - 15;
              }
            }
          }
        } catch (e) {
          console.error("Error calculating minute:", e);
        }
      }
      
      const scoreData: LiveScoreData = {
        homeScore,
        awayScore,
        status,
        minute
      };

      // Update state
      setLiveScores(prev => {
        // Only update if changed to avoid re-renders
        const current = prev[apiMatchId];
        if (current && 
            current.homeScore === scoreData.homeScore && 
            current.awayScore === scoreData.awayScore && 
            current.status === scoreData.status && 
            current.minute === scoreData.minute) {
          return prev;
        }
        return {
          ...prev,
          [apiMatchId]: scoreData
        };
      });

      // Update history log
      const logEntry = {
        timestamp: new Date(),
        minute: minute ?? null,
        status,
        homeScore,
        awayScore,
        kickoffTime: kickoffTime ?? null,
        apiMinute: liveScore.minute,
        diffMinutes: null,
        halftimeEndTime: null,
        halftimeEndMinute: null,
        minutesSinceHalftimeEnd: null,
      };

      apiPullHistoryRef.current = {
        ...apiPullHistoryRef.current,
        [apiMatchId]: [
          logEntry,
          ...(apiPullHistoryRef.current[apiMatchId] || []).slice(0, 49) // Keep last 50
        ]
      };

      return scoreData;

    } catch (err) {
      console.error('[useLiveScores] Exception:', err);
      return null;
    }
  }, []);

  const toggleDebugLog = useCallback((matchId: number) => {
    setExpandedDebugLog(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  }, []);

  return {
    liveScores,
    fetchLiveScore,
    apiPullHistoryRef,
    expandedDebugLog,
    toggleDebugLog
  };
}

