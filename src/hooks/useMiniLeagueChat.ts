import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../lib/supabase";
import { getCached, setCached, CACHE_TTL } from "../lib/cache";

const PAGE_SIZE = 50;

export type MiniLeagueChatMessage = {
  id: string;
  league_id: string;
  user_id: string;
  content: string;
  created_at: string;
  client_msg_id?: string;
  status?: "sending" | "sent" | "error";
  reply_to_message_id?: string | null;
  reply_to?: {
    id: string;
    content: string;
    user_id: string;
    author_name?: string;
  } | null;
};

type UseMiniLeagueChatOptions = {
  userId?: string | null;
  enabled?: boolean;
  autoSubscribe?: boolean;
};

const normalizeMessage = (row: any): MiniLeagueChatMessage => {
  // Supabase foreign key relationships can return an empty array [] when no match is found
  // We need to check if reply_to is an array and handle it accordingly
  let replyTo = null;
  if (row.reply_to) {
    // If it's an array, take the first element (or null if empty)
    const replyToData = Array.isArray(row.reply_to) ? row.reply_to[0] : row.reply_to;
    // Debug: log the raw reply_to data for messages that have reply_to_message_id
    if (row.reply_to_message_id) {
      console.log('[normalizeMessage] Message has reply_to_message_id:', row.reply_to_message_id, 'reply_to:', row.reply_to, 'replyToData:', replyToData);
      if (replyToData) {
        console.log('[normalizeMessage] replyToData.id:', replyToData.id, 'replyToData.user_id:', replyToData.user_id, 'replyToData.content:', replyToData.content);
      }
    }
    // Only create reply_to object if we have both id and user_id (required fields)
    if (replyToData && replyToData.id && replyToData.user_id) {
      replyTo = {
        id: replyToData.id,
        content: replyToData.content || "",
        user_id: replyToData.user_id,
        author_name: replyToData.author_name,
      };
    } else if (row.reply_to_message_id && replyToData) {
      // Debug: log when we have reply_to_message_id but can't create reply_to object
      console.warn('[normalizeMessage] Cannot create reply_to object - missing required fields. replyToData:', replyToData, 'has id:', !!replyToData?.id, 'has user_id:', !!replyToData?.user_id);
    }
  }
  
  return {
    id: row.id,
    league_id: row.league_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at ?? new Date().toISOString(),
    status: "sent",
    reply_to_message_id: row.reply_to_message_id ?? null,
    reply_to: replyTo,
  };
};

const dedupeAndSort = (list: MiniLeagueChatMessage[]) => {
  const map = new Map<string, MiniLeagueChatMessage>();
  for (const msg of list) {
    map.set(msg.id, msg);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

export function useMiniLeagueChat(
  miniLeagueId?: string | null,
  options: UseMiniLeagueChatOptions = {}
) {
  const { userId, enabled = true, autoSubscribe = true } = options;
  
  // Initialize with cached messages if available (pre-loaded during initial data load)
  const getInitialMessages = (): MiniLeagueChatMessage[] => {
    if (!miniLeagueId || !enabled) return [];
    const cached = getCached<MiniLeagueChatMessage[]>(`chat:messages:${miniLeagueId}`);
    return cached || [];
  };
  
  const [messages, setMessages] = useState<MiniLeagueChatMessage[]>(getInitialMessages);
  const [loading, setLoading] = useState(false); // Start as false - we'll only set true if no cache
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const earliestTimestampRef = useRef<string | null>(null);
  const initializingLeagueIdRef = useRef<string | null>(null);
  const refreshInProgressRef = useRef<boolean>(false);
  const latestTimestampRef = useRef<string | null>(null);
  const lastCacheUpdateRef = useRef<number>(0);

  const applyMessages = useCallback(
    (updater: (prev: MiniLeagueChatMessage[]) => MiniLeagueChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        earliestTimestampRef.current = next.length ? next[0].created_at : null;
        latestTimestampRef.current = next.length ? next[next.length - 1].created_at : null;
        
        // Update cache when messages change (debounced to avoid excessive writes)
        if (miniLeagueId && next.length > 0) {
          // Only cache if we have real messages (not just optimistic ones)
          const realMessages = next.filter(msg => !msg.id.startsWith('optimistic-'));
          if (realMessages.length > 0) {
            // Debounce cache updates - only update cache every 2 seconds max
            const now = Date.now();
            if (now - lastCacheUpdateRef.current > 2000) {
              lastCacheUpdateRef.current = now;
              const cacheKey = `chat:messages:${miniLeagueId}`;
              setCached(cacheKey, realMessages, CACHE_TTL.HOME);
            }
          }
        }
        
        return next;
      });
    },
    [miniLeagueId]
  );

  const fetchPage = useCallback(
    async ({ before, append }: { before?: string; append: boolean }) => {
      if (!miniLeagueId || !enabled) return;
      console.log('[fetchPage] Starting fetch for league:', miniLeagueId, 'append:', append, 'before:', before);
      // First, fetch all messages
      const query = supabase
        .from("league_messages")
        .select(`
          id, 
          league_id, 
          user_id, 
          content, 
          created_at,
          reply_to_message_id
        `)
        .eq("league_id", miniLeagueId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (before) {
        query.lt("created_at", before);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[useMiniLeagueChat] Error fetching messages:', error);
        throw error;
      }

      console.log('[fetchPage] Fetched', data?.length || 0, 'messages from database');

      // Fetch reply data for messages that have reply_to_message_id
      const messagesWithReply = (data ?? []).filter((row: any) => row.reply_to_message_id);
      const replyMessageIds = [...new Set(messagesWithReply.map((row: any) => row.reply_to_message_id))];
      console.log('[fetchPage] Found', messagesWithReply.length, 'messages with reply_to_message_id, unique reply IDs:', replyMessageIds.length);
      
      let replyDataMap = new Map<string, any>();
      if (replyMessageIds.length > 0) {
        const { data: replyMessages, error: replyError } = await supabase
          .from("league_messages")
          .select("id, content, user_id")
          .in("id", replyMessageIds);
        
        if (replyError) {
          console.error('[useMiniLeagueChat] Error fetching reply messages:', replyError);
        }

        if (!replyError && replyMessages) {
          replyMessages.forEach((msg: any) => {
            replyDataMap.set(msg.id, msg);
          });
        }
      }

      // Debug: Check raw Supabase response for messages with reply_to_message_id
      if (data && data.length > 0) {
        const messagesWithReply = data.filter((row: any) => row.reply_to_message_id);
        if (messagesWithReply.length > 0) {
          console.log('[fetchPage] Found', messagesWithReply.length, 'messages with reply_to_message_id');
          messagesWithReply.slice(0, 3).forEach((row: any) => {
            const replyData = replyDataMap.get(row.reply_to_message_id);
            console.log('[fetchPage] Message', row.id, 'reply_to_message_id:', row.reply_to_message_id, 'replyData:', replyData);
          });
        }
      }

      // Transform the reply_to data (author_name will be resolved on frontend from memberNames)
      const normalized = (data ?? []).map((row: any) => {
        // Manually attach reply_to data from our map
        if (row.reply_to_message_id) {
          const replyData = replyDataMap.get(row.reply_to_message_id);
          if (replyData) {
            row.reply_to = replyData;
          } else {
            row.reply_to = null;
          }
        } else {
          row.reply_to = null;
        }
        return normalizeMessage(row);
      }).reverse();

      applyMessages((prev) => {
        if (append) {
          // Append older messages (for pagination)
          return dedupeAndSort([...normalized, ...prev]);
        } else {
          // For refresh: merge with existing to preserve any real-time messages that arrived during fetch
          // Only replace if we got a full page (50 messages), otherwise merge to preserve newer messages
          const gotFullPage = (data ?? []).length >= PAGE_SIZE;
          if (gotFullPage && prev.length === 0) {
            // Full page fetch AND no existing messages - safe to replace (initial load)
            return dedupeAndSort(normalized);
          } else {
            // Merge: combine existing and fetched messages, keeping all unique messages
            // This preserves real-time messages that arrived during fetch
            const merged = [...prev, ...normalized];
            return dedupeAndSort(merged);
          }
        }
      });

      if ((data ?? []).length < PAGE_SIZE) {
        setHasMore(false);
      } else if (!append) {
        setHasMore(true);
      }
    },
    [miniLeagueId, enabled, applyMessages]
  );

  const refresh = useCallback(async () => {
    if (!miniLeagueId || !enabled) {
      setMessages([]);
      setHasMore(true);
      return;
    }
    
    // Prevent concurrent refreshes
    if (refreshInProgressRef.current) {
      console.log('[useMiniLeagueChat] Refresh already in progress, skipping');
      return;
    }
    
    refreshInProgressRef.current = true;
    
    // Only set loading if we don't already have messages (from cache)
    const hasMessages = messages.length > 0;
    if (!hasMessages) {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Check cache first (pre-loaded during initial data load)
      const cachedMessages = getCached<MiniLeagueChatMessage[]>(`chat:messages:${miniLeagueId}`);
      if (cachedMessages && cachedMessages.length > 0 && !hasMessages) {
        // Use cached messages immediately only if we don't have messages yet
        applyMessages(() => cachedMessages);
        // Set earliest timestamp for pagination
        if (cachedMessages.length > 0) {
          earliestTimestampRef.current = cachedMessages[0].created_at;
          latestTimestampRef.current = cachedMessages[cachedMessages.length - 1].created_at;
        }
        // If we got 50 messages, there might be more
        setHasMore(cachedMessages.length >= 50);
        setLoading(false);
      }
      
      // Always fetch fresh data to ensure we have latest messages
      // This is critical for catching messages that might have been missed by real-time subscription
      console.log('[useMiniLeagueChat] Refreshing messages from database');
      await fetchPage({ append: false });
      
      if (!hasMessages && cachedMessages && cachedMessages.length > 0) {
        // If we used cache, loading was already set to false above
        // But fetchPage might have updated messages, so we're good
      }
    } catch (err: any) {
      console.error('[useMiniLeagueChat] Error in refresh:', err);
      setError(err?.message ?? "Failed to load chat");
    } finally {
      refreshInProgressRef.current = false;
      if (!hasMessages) {
        setLoading(false);
      }
    }
  }, [miniLeagueId, enabled, fetchPage, applyMessages, messages.length]);

  useEffect(() => {
    if (!miniLeagueId || !enabled) {
      setMessages([]);
      setHasMore(true);
      initializingLeagueIdRef.current = null;
      return;
    }

    // Prevent duplicate initialization (React StrictMode runs effects twice in dev)
    // Only skip if we're already initializing the same league
    if (initializingLeagueIdRef.current === miniLeagueId) {
      return;
    }
    initializingLeagueIdRef.current = miniLeagueId;

    // Check cache FIRST - if we already have messages from initial state, use them
    // Otherwise check cache again (in case cache was populated after component mount)
    const hasInitialMessages = messages.length > 0;
    const cachedMessages = getCached<MiniLeagueChatMessage[]>(`chat:messages:${miniLeagueId}`);
    
    if (hasInitialMessages || (cachedMessages && cachedMessages.length > 0)) {
      // We have messages (from initial state or cache) - no loading state needed
      if (!hasInitialMessages && cachedMessages) {
        // Update messages if we got them from cache
        applyMessages(() => cachedMessages);
        if (cachedMessages.length > 0) {
          earliestTimestampRef.current = cachedMessages[0].created_at;
          latestTimestampRef.current = cachedMessages[cachedMessages.length - 1].created_at;
        }
        setHasMore(cachedMessages.length >= 50);
      } else if (hasInitialMessages && messages.length > 0) {
        // Set earliest timestamp from existing messages
        earliestTimestampRef.current = messages[0].created_at;
        latestTimestampRef.current = messages[messages.length - 1].created_at;
        setHasMore(messages.length >= 50);
      }
      // Don't set loading - messages are ready immediately
      // Still set up real-time subscriptions and periodic refresh below
      // This ensures we catch new messages even when cache exists
      initializingLeagueIdRef.current = null;
      // Continue to set up subscriptions - don't return early
    } else {
      // No cache and no initial messages - need to fetch (this is the only case where loading should be true)
      let active = true;
      refresh().finally(() => {
        // Clear flag after refresh completes (allows re-initialization if league changes)
        if (active && initializingLeagueIdRef.current === miniLeagueId) {
          initializingLeagueIdRef.current = null;
        }
      });
    }

    if (!autoSubscribe) {
      return () => {
        // Cleanup if not subscribing
      };
    }
    
    let active = true;

    // Periodic refresh fallback to catch missed messages (every 30 seconds)
    // This ensures messages appear even if real-time subscription fails
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    let lastRefreshTime = Date.now();
    const REFRESH_INTERVAL_MS = 30000; // 30 seconds
    
    const startPeriodicRefresh = () => {
      if (refreshInterval) return; // Already started
      
      refreshInterval = setInterval(() => {
        if (!active) return;
        const now = Date.now();
        // Only refresh if it's been at least 30 seconds since last refresh
        // AND no refresh is currently in progress
        if (now - lastRefreshTime >= REFRESH_INTERVAL_MS && !refreshInProgressRef.current) {
          lastRefreshTime = now;
          // Silently refresh in background to catch missed messages
          // Use a lightweight fetch that only gets messages newer than what we have
          const latestTimestamp = latestTimestampRef.current;
          if (latestTimestamp) {
            // Only fetch messages newer than our latest
            (async () => {
              try {
                const { data, error } = await supabase
                  .from("league_messages")
                  .select("id, league_id, user_id, content, created_at, reply_to_message_id")
                  .eq("league_id", miniLeagueId)
                  .gt("created_at", latestTimestamp)
                  .order("created_at", { ascending: true });
                
                if (!active || error || !data || data.length === 0) return;
                
                // Fetch reply data for any messages with replies
                const messagesWithReply = data.filter((row: any) => row.reply_to_message_id);
                const replyMessageIds = [...new Set(messagesWithReply.map((row: any) => row.reply_to_message_id))];
                
                if (replyMessageIds.length > 0) {
                  const { data: replyMessages } = await supabase
                    .from("league_messages")
                    .select("id, content, user_id")
                    .in("id", replyMessageIds);
                  
                  if (!active || !replyMessages) return;
                  
                  const replyDataMap = new Map<string, any>();
                  replyMessages.forEach((msg: any) => {
                    replyDataMap.set(msg.id, msg);
                  });
                  
                  const enriched = data.map((row: any) => {
                    if (row.reply_to_message_id && replyDataMap.has(row.reply_to_message_id)) {
                      row.reply_to = replyDataMap.get(row.reply_to_message_id);
                    }
                    return normalizeMessage(row);
                  });
                  
                  applyMessages((prev) => dedupeAndSort([...prev, ...enriched]));
                } else {
                  const normalized = data.map((row: any) => normalizeMessage(row));
                  applyMessages((prev) => dedupeAndSort([...prev, ...normalized]));
                }
              } catch (err: any) {
                console.warn('[useMiniLeagueChat] Periodic refresh failed:', err);
              }
            })();
          } else {
            // No latest timestamp, do full refresh
            refresh().catch((err: any) => {
              console.warn('[useMiniLeagueChat] Periodic refresh failed:', err);
            });
          }
        }
      }, REFRESH_INTERVAL_MS);
    };

    const channel = supabase
      .channel(`league-messages:${miniLeagueId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "league_messages",
          filter: `league_id=eq.${miniLeagueId}`,
        },
        async (payload) => {
          if (!active) return;
          console.log('[useMiniLeagueChat] Received real-time message:', payload.new.id);
          
          // Skip if refresh is in progress (to avoid race conditions)
          // The refresh will pick up this message when it completes
          if (refreshInProgressRef.current) {
            console.log('[useMiniLeagueChat] Refresh in progress, will add message after refresh completes');
            // Still add it, but refresh will dedupe
          }
          
          try {
            // For real-time updates, fetch the full message with reply data
            const { data: fullMessage, error: fetchError } = await supabase
              .from("league_messages")
              .select(`
                id, 
                league_id, 
                user_id, 
                content, 
                created_at,
                reply_to_message_id
              `)
              .eq("id", payload.new.id)
              .single();
            
            if (fetchError) {
              console.error('[useMiniLeagueChat] Error fetching full message:', fetchError);
            }
            
            if (fullMessage) {
              // Fetch reply data if this message has a reply
              if (fullMessage.reply_to_message_id) {
                const { data: replyMessage } = await supabase
                  .from("league_messages")
                  .select("id, content, user_id")
                  .eq("id", fullMessage.reply_to_message_id)
                  .single();
                
                if (replyMessage) {
                  (fullMessage as any).reply_to = replyMessage;
                }
              }
              
              const incoming = normalizeMessage(fullMessage);
              applyMessages((prev) => {
                // Check if message already exists (deduplication)
                const exists = prev.some((msg) => msg.id === incoming.id || (msg.client_msg_id && msg.client_msg_id === incoming.client_msg_id));
                if (exists) {
                  console.log('[useMiniLeagueChat] Message already exists, skipping:', incoming.id);
                  // Update existing message if it's an optimistic one being replaced
                  const optimisticIndex = prev.findIndex(msg => msg.client_msg_id && msg.client_msg_id === incoming.client_msg_id && msg.id.startsWith('optimistic-'));
                  if (optimisticIndex >= 0) {
                    // Replace optimistic message with real one
                    const updated = [...prev];
                    updated[optimisticIndex] = incoming;
                    return dedupeAndSort(updated);
                  }
                  return prev;
                }
                console.log('[useMiniLeagueChat] Adding new message:', incoming.id);
                // Always add to end (newest messages at end)
                return dedupeAndSort([...prev, incoming]);
              });
            } else {
              // Fallback to basic normalization if fetch fails
              console.warn('[useMiniLeagueChat] Failed to fetch full message, using payload data:', payload.new.id);
              const incoming = normalizeMessage(payload.new);
              applyMessages((prev) => {
                const exists = prev.some((msg) => msg.id === incoming.id);
                if (exists) {
                  return prev;
                }
                return dedupeAndSort([...prev, incoming]);
              });
            }
          } catch (err) {
            console.error('[useMiniLeagueChat] Error processing real-time message:', err);
            // Fallback: try to add message from payload
            try {
              const incoming = normalizeMessage(payload.new);
              applyMessages((prev) => {
                const exists = prev.some((msg) => msg.id === incoming.id);
                if (exists) {
                  return prev;
                }
                return dedupeAndSort([...prev, incoming]);
              });
            } catch (fallbackErr) {
              console.error('[useMiniLeagueChat] Fallback also failed:', fallbackErr);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[useMiniLeagueChat] Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('[useMiniLeagueChat] Successfully subscribed to real-time updates');
          // Start periodic refresh as fallback
          startPeriodicRefresh();
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useMiniLeagueChat] Channel subscription error - will rely on periodic refresh');
          // Start periodic refresh immediately if subscription fails
          startPeriodicRefresh();
          // Try to resubscribe after a delay
          setTimeout(() => {
            if (active && miniLeagueId) {
              console.log('[useMiniLeagueChat] Attempting to resubscribe after error');
              channel.unsubscribe();
              channel.subscribe();
            }
          }, 5000);
        } else if (status === 'TIMED_OUT') {
          console.warn('[useMiniLeagueChat] Subscription timed out - will rely on periodic refresh');
          startPeriodicRefresh();
          // Try to resubscribe after a delay
          setTimeout(() => {
            if (active && miniLeagueId) {
              console.log('[useMiniLeagueChat] Attempting to resubscribe after timeout');
              channel.unsubscribe();
              channel.subscribe();
            }
          }, 5000);
        } else if (status === 'CLOSED') {
          console.warn('[useMiniLeagueChat] Subscription closed - will rely on periodic refresh');
          startPeriodicRefresh();
        }
      });

    // Single mechanism: refresh when page becomes visible (covers all cases)
    const handleVisibilityChange = () => {
      if (!active) return;
      if (document.visibilityState === 'visible' && !refreshInProgressRef.current) {
        // Refresh to catch any messages missed while backgrounded
        lastRefreshTime = Date.now();
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Start periodic refresh immediately as fallback
    startPeriodicRefresh();

    return () => {
      active = false;
      // Don't clear isInitializingRef here - let it clear after refresh completes
      // This prevents the second StrictMode run from executing
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      supabase.removeChannel(channel);
    };
  }, [miniLeagueId, enabled, autoSubscribe, refresh, applyMessages]);

  const loadMore = useCallback(async () => {
    if (!miniLeagueId || !enabled || !hasMore || loadingMore) return;
    const before = earliestTimestampRef.current ?? messages[0]?.created_at;
    if (!before) return;
    setLoadingMore(true);
    try {
      await fetchPage({ before, append: true });
    } catch (err: any) {
      console.error('[useMiniLeagueChat] Error loading more messages:', err);
      setError(err?.message ?? "Failed to load more messages");
    } finally {
      setLoadingMore(false);
    }
  }, [miniLeagueId, enabled, hasMore, loadingMore, fetchPage, messages]);

  const sendMessage = useCallback(
    async (text: string, replyToMessageId?: string | null) => {
      if (!miniLeagueId || !userId) {
        throw new Error("Missing league or user");
      }
      const trimmed = text.trim();
      if (!trimmed) return;

      const clientId = uuidv4();
      const optimisticId = `optimistic-${clientId}`;

      const optimistic: MiniLeagueChatMessage = {
        id: optimisticId,
        client_msg_id: clientId,
        league_id: miniLeagueId,
        user_id: userId,
        content: trimmed,
        created_at: new Date().toISOString(),
        status: "sending",
        reply_to_message_id: replyToMessageId ?? null,
      };

      applyMessages((prev) => dedupeAndSort([...prev, optimistic]));

      const { data, error } = await supabase
        .from("league_messages")
        .insert({
          league_id: miniLeagueId,
          user_id: userId,
          content: trimmed,
          reply_to_message_id: replyToMessageId ?? null,
        })
        .select(`
          id, 
          league_id, 
          user_id, 
          content, 
          created_at,
          reply_to_message_id
        `)
        .single();
      
      // Fetch reply data if this message has a reply
      if (data && data.reply_to_message_id) {
        const { data: replyMessage } = await supabase
          .from("league_messages")
          .select("id, content, user_id")
          .eq("id", data.reply_to_message_id)
          .single();
        
        if (replyMessage) {
          (data as any).reply_to = replyMessage;
        }
      }

      if (error) {
        console.error('[useMiniLeagueChat] Error sending message:', error);
        applyMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticId ? { ...msg, status: "error" as const } : msg
          )
        );
        throw error;
      }

      if (data) {
        // Fetch reply data if this message has a reply
        if (data.reply_to_message_id) {
          const { data: replyMessage } = await supabase
            .from("league_messages")
            .select("id, content, user_id")
            .eq("id", data.reply_to_message_id)
            .single();
          
          if (replyMessage) {
            (data as any).reply_to = replyMessage;
          }
        }
        
        const finalized = normalizeMessage(data);
        finalized.client_msg_id = clientId;
        finalized.status = "sent";
        
        applyMessages((prev) => {
          // Find and replace optimistic message
          const optimisticIndex = prev.findIndex(msg => msg.id === optimisticId);
          if (optimisticIndex >= 0) {
            const updated = [...prev];
            updated[optimisticIndex] = finalized;
            return dedupeAndSort(updated);
          } else {
            // Optimistic message not found, just add the finalized one
            return dedupeAndSort([...prev, finalized]);
          }
        });
      }
    },
    [miniLeagueId, userId, applyMessages]
  );

  const previewMessages = useMemo(() => messages.slice(-5), [messages]);

  return {
    messages,
    previewMessages,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    sendMessage,
  };
}
