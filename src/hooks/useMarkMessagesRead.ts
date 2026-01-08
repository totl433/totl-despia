import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { invalidateLeagueCache } from '../api/leagues';

interface UseMarkMessagesReadOptions {
  leagueId: string | null | undefined;
  userId: string | null | undefined;
  enabled?: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook to mark messages as read when they become visible.
 * Uses IntersectionObserver to detect when messages are visible in viewport.
 * Also marks as read when user sends a message (they're clearly reading).
 */
export function useMarkMessagesRead({
  leagueId,
  userId,
  enabled = true,
  containerRef,
}: UseMarkMessagesReadOptions) {
  const lastUpdateRef = useRef<number>(0);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 2000; // Max once per 2 seconds

  const markAsRead = useCallback(async () => {
    if (!leagueId || !userId || !enabled) return;

    const now = Date.now();
    // Debounce updates
    if (now - lastUpdateRef.current < DEBOUNCE_MS) {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      updateTimeoutRef.current = setTimeout(() => {
        markAsRead();
      }, DEBOUNCE_MS - (now - lastUpdateRef.current));
      return;
    }

    lastUpdateRef.current = now;

    try {
      await supabase
        .from('league_message_reads')
        .upsert(
          { league_id: leagueId, user_id: userId, last_read_at: new Date().toISOString() },
          { onConflict: 'league_id,user_id' }
        );

      // Invalidate cache and dispatch event for badge refresh
      invalidateLeagueCache(userId);
      window.dispatchEvent(
        new CustomEvent('leagueMessagesRead', {
          detail: { leagueId, userId },
        })
      );
    } catch (error) {
      console.error('[useMarkMessagesRead] Error marking messages as read:', error);
    }
  }, [leagueId, userId, enabled]);

  // IntersectionObserver to detect when messages are visible
  useEffect(() => {
    if (!enabled || !leagueId || !userId || !containerRef.current) return;

    const container = containerRef.current;
    
    // Observe the container itself - if it's visible and has messages, mark as read
    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0]?.isIntersecting;
        if (isVisible) {
          // Check if container has messages
          const hasMessages = container.querySelectorAll('[data-message-id]').length > 0;
          if (hasMessages) {
            markAsRead();
          }
        }
      },
      {
        root: null, // Use viewport as root
        rootMargin: '0px',
        threshold: 0.1, // Trigger when 10% of container is visible
      }
    );

    observer.observe(container);

    // Also mark as read on scroll (user is actively reading)
    const handleScroll = () => {
      if (container.scrollTop > 0) {
        markAsRead();
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [enabled, leagueId, userId, containerRef, markAsRead]);

  return { markAsRead };
}
