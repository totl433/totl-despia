import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../lib/supabase";
import { getCached, setCached, CACHE_TTL } from "../lib/cache";
import { logDataFetch } from "../lib/dataFetchLogger";

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
  let replyTo = null;
  if (row.reply_to) {
    // Handle array or object format from Supabase
    const replyToData = Array.isArray(row.reply_to) ? row.reply_to[0] : row.reply_to;
    if (replyToData && replyToData.id && replyToData.user_id) {
      replyTo = {
        id: replyToData.id,
        content: replyToData.content || "",
        user_id: replyToData.user_id,
        author_name: replyToData.author_name,
      };
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
  // Simple Set-based deduplication by message ID
  const seen = new Set<string>();
  const unique: MiniLeagueChatMessage[] = [];
  
  for (const msg of list) {
    if (!seen.has(msg.id)) {
      seen.add(msg.id);
      unique.push(msg);
    }
  }
  
  return unique.sort(
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
  const latestTimestampRef = useRef<string | null>(null);
  const messagesRef = useRef<MiniLeagueChatMessage[]>(messages);
  const subscriptionStatusRef = useRef<'idle' | 'subscribing' | 'subscribed' | 'failed'>('idle');
  // CRITICAL: Use ref for userId to prevent subscription recreation when user object changes
  const userIdRef = useRef<string | null | undefined>(userId);
  // Track reconnection attempts to force effect re-run when subscription closes unexpectedly
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  
  // Keep userIdRef in sync with userId
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const applyMessages = useCallback(
    (updater: (prev: MiniLeagueChatMessage[]) => MiniLeagueChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        messagesRef.current = next;
        earliestTimestampRef.current = next.length ? next[0].created_at : null;
        latestTimestampRef.current = next.length ? next[next.length - 1].created_at : null;
        
        // Single cache update point - cache only real messages
        if (miniLeagueId && next.length > 0) {
          const realMessages = next.filter(msg => !msg.id.startsWith('optimistic-'));
          if (realMessages.length > 0) {
            const cacheKey = `chat:messages:${miniLeagueId}`;
            setCached(cacheKey, realMessages, CACHE_TTL.HOME);
          }
        }
        
        return next;
      });
    },
    [miniLeagueId]
  );
  
  const refreshRef = useRef<((skipCache?: boolean) => Promise<void>) | null>(null);
  const applyMessagesRef = useRef<((updater: (prev: MiniLeagueChatMessage[]) => MiniLeagueChatMessage[]) => void) | null>(null);
  
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fetchPage = useCallback(
    async ({ before, append }: { before?: string; append: boolean }) => {
      if (!miniLeagueId || !enabled) return;
      
      // Try using Supabase foreign key relationship first
      const query = supabase
        .from("league_messages")
        .select(`
          id, 
          league_id, 
          user_id, 
          content, 
          created_at,
          reply_to_message_id,
          reply_to:league_messages!reply_to_message_id(id, content, user_id)
        `)
        .eq("league_id", miniLeagueId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (before) {
        query.lt("created_at", before);
      }

      const { data, error } = await query;
      
      // Log the message fetch for debugging
      logDataFetch('useMiniLeagueChat', 'Fetch messages page', 'league_messages', { data, error }, { leagueId: miniLeagueId, before, pageSize: PAGE_SIZE });
      
      if (error) {
        console.error('[useMiniLeagueChat] Error fetching messages:', error);
        throw error;
      }

      // If foreign key didn't work, fallback to manual fetching
      const messagesWithReply = (data ?? []).filter((row: any) => row.reply_to_message_id);
      const replyMessageIds = [...new Set(messagesWithReply.map((row: any) => row.reply_to_message_id))];
      
      let replyDataMap = new Map<string, any>();
      const hasForeignKeys = messagesWithReply.some((row: any) => row.reply_to && !Array.isArray(row.reply_to));
      
      if (!hasForeignKeys && replyMessageIds.length > 0) {
        // Fallback: manual fetch if foreign keys didn't work
        const { data: replyMessages, error: replyError } = await supabase
          .from("league_messages")
          .select("id, content, user_id")
          .in("id", replyMessageIds);
        
        // Log reply messages fetch
        logDataFetch('useMiniLeagueChat', 'Fetch reply messages', 'league_messages', { data: replyMessages, error: replyError }, { leagueId: miniLeagueId, replyMessageIds: replyMessageIds.length });
        
        if (replyError) {
          console.error('[useMiniLeagueChat] Error fetching reply messages:', replyError);
        } else if (replyMessages) {
          replyMessages.forEach((msg: any) => {
            replyDataMap.set(msg.id, msg);
          });
        }
      }

      // Transform messages with reply data
      const normalized = (data ?? []).map((row: any) => {
        if (row.reply_to_message_id) {
          // Try foreign key first, fallback to manual map
          if (row.reply_to && !Array.isArray(row.reply_to)) {
            row.reply_to = row.reply_to;
          } else {
            const replyData = replyDataMap.get(row.reply_to_message_id);
            row.reply_to = replyData || null;
          }
        } else {
          row.reply_to = null;
        }
        return normalizeMessage(row);
      }).reverse();

      applyMessages((prev) => {
        const result = append
          ? dedupeAndSort([...normalized, ...prev])
          : dedupeAndSort([...prev, ...normalized]);
        return result;
      });

      if ((data ?? []).length < PAGE_SIZE) {
        setHasMore(false);
      } else if (!append) {
        setHasMore(true);
      }
    },
    [miniLeagueId, enabled, applyMessages]
  );

  const refresh = useCallback(async (skipCache: boolean = false) => {
    if (!miniLeagueId || !enabled) {
      setMessages([]);
      setHasMore(true);
      return;
    }
    
    const hasMessages = messagesRef.current.length > 0;
    if (!hasMessages) {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Check cache first if no messages AND not skipping cache
      if (!hasMessages && !skipCache) {
        const cachedMessages = getCached<MiniLeagueChatMessage[]>(`chat:messages:${miniLeagueId}`);
        if (cachedMessages && cachedMessages.length > 0) {
          applyMessages(() => cachedMessages);
          if (cachedMessages.length > 0) {
            earliestTimestampRef.current = cachedMessages[0].created_at;
            latestTimestampRef.current = cachedMessages[cachedMessages.length - 1].created_at;
          }
          setHasMore(cachedMessages.length >= 50);
          setLoading(false);
        }
      }
      
      // Always fetch fresh data
      await fetchPage({ append: false });
    } catch (err: any) {
      const { getUserFriendlyMessage } = await import('../lib/chatErrors');
      console.error('[useMiniLeagueChat] Error in refresh:', err);
      setError(getUserFriendlyMessage(err, 'refresh'));
    } finally {
      if (!hasMessages) {
        setLoading(false);
      }
    }
  }, [miniLeagueId, enabled, fetchPage, applyMessages]);

  useEffect(() => {
    refreshRef.current = refresh;
    applyMessagesRef.current = applyMessages;
  }, [refresh, applyMessages]);
  
  // Track previous dependencies to detect what changed
  const prevDepsRef = useRef<{ miniLeagueId?: string | null; enabled: boolean; autoSubscribe: boolean } | null>(null);
  
  // FIRST: Subscription effect (separate from cache logic to prevent constant recreation)
  useEffect(() => {
    // Log subscription effect mount with current dependencies
    const effectId = Date.now();
    const dependencies = {
      miniLeagueId,
      enabled,
      autoSubscribe,
      userId: userIdRef.current,
    };
    
    // Detect what changed
    const prevDeps = prevDepsRef.current;
    let changedFields: string[] = [];
    if (prevDeps) {
      if (prevDeps.miniLeagueId !== miniLeagueId) changedFields.push(`miniLeagueId: "${prevDeps.miniLeagueId}" → "${miniLeagueId}"`);
      if (prevDeps.enabled !== enabled) changedFields.push(`enabled: ${prevDeps.enabled} → ${enabled}`);
      if (prevDeps.autoSubscribe !== autoSubscribe) changedFields.push(`autoSubscribe: ${prevDeps.autoSubscribe} → ${autoSubscribe}`);
    } else {
      changedFields.push('initial mount');
    }
    prevDepsRef.current = { miniLeagueId, enabled, autoSubscribe };
    
    try {
      const existingLogs = localStorage.getItem('message_subscription_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push({
        timestamp: Date.now(),
        leagueId: miniLeagueId,
        status: 'EFFECT_MOUNT',
        channel: `league-messages:${miniLeagueId}`,
        dependencies,
        effectId,
        changedFields,
        reason: changedFields.length > 0 ? `Subscription effect mounted - changed: ${changedFields.join(', ')}` : 'Subscription effect mounted',
      });
      const recentLogs = logs.slice(-50);
      localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
    } catch (e) {
      console.error('[useMiniLeagueChat] Failed to log effect mount:', e);
    }

    if (!miniLeagueId || !enabled || !autoSubscribe) {
      // Log early return
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push({
          timestamp: Date.now(),
          leagueId: miniLeagueId,
          status: 'EFFECT_SKIP',
          channel: `league-messages:${miniLeagueId}`,
          dependencies,
          effectId,
          reason: `Skipped: miniLeagueId=${!!miniLeagueId}, enabled=${enabled}, autoSubscribe=${autoSubscribe}`,
        });
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        // Ignore
      }
      return;
    }

    let active = true;
    let safetyFallbackTimeout: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    subscriptionStatusRef.current = 'subscribing';
    channel = supabase
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
          
          // CRITICAL FIX: Skip own messages - they're handled by sendMessage
          // This prevents race condition where real-time and sendMessage both try to add the same message
          // Use ref to avoid dependency on userId (prevents subscription recreation)
          if (payload.new.user_id === userIdRef.current) {
            return; // Don't process own messages via subscription - sendMessage handles them
          }
          
          try {
            // Use payload.new directly - it already has all message data (INSTANT!)
            const incomingMessage = payload.new;
            
            // Only fetch reply data if this message is a reply
            if (incomingMessage.reply_to_message_id) {
              const { data: replyMessage } = await supabase
                .from("league_messages")
                .select("id, content, user_id")
                .eq("id", incomingMessage.reply_to_message_id)
                .single();
              
              if (replyMessage) {
                (incomingMessage as any).reply_to = replyMessage;
              } else {
                (incomingMessage as any).reply_to = null;
              }
            } else {
              (incomingMessage as any).reply_to = null;
            }
            
            // Normalize and add message immediately
            const incoming = normalizeMessage(incomingMessage);
            applyMessagesRef.current?.((prev) => {
              // Check if message already exists (double safety check)
              if (!prev.some(msg => msg.id === incoming.id)) {
                return dedupeAndSort([...prev, incoming]);
              }
              return prev;
            });
          } catch (err) {
            console.error('[useMiniLeagueChat] Error processing real-time message:', err);
            // Fallback: add message from payload even if reply fetch fails
            try {
              const incoming = normalizeMessage(payload.new);
              applyMessagesRef.current?.((prev) => {
                if (!prev.some(msg => msg.id === incoming.id)) {
                  return dedupeAndSort([...prev, incoming]);
                }
                return prev;
              });
            } catch (fallbackErr) {
              console.error('[useMiniLeagueChat] Fallback also failed:', fallbackErr);
            }
          }
        }
      )
      .subscribe((status) => {
        subscriptionStatusRef.current = status === 'SUBSCRIBED' ? 'subscribed' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'failed' : 'idle';
        
        // Log subscription status changes
        try {
          const existingLogs = localStorage.getItem('message_subscription_logs');
          const logs = existingLogs ? JSON.parse(existingLogs) : [];
          logs.push({
            timestamp: Date.now(),
            leagueId: miniLeagueId,
            status,
            channel: `league-messages:${miniLeagueId}`,
          });
          const recentLogs = logs.slice(-50); // Keep last 50
          localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
        } catch (e) {
          console.error('[useMiniLeagueChat] Failed to log subscription status:', e);
        }
        
        if (status === 'SUBSCRIBED') {
          // Clear safety fallback since subscription succeeded
          if (safetyFallbackTimeout) {
            clearTimeout(safetyFallbackTimeout);
            safetyFallbackTimeout = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Subscription failed - trigger safety fallback refresh after 2 seconds
          if (safetyFallbackTimeout) {
            clearTimeout(safetyFallbackTimeout);
          }
          safetyFallbackTimeout = setTimeout(() => {
            if (active && subscriptionStatusRef.current !== 'subscribed') {
              console.warn('[useMiniLeagueChat] Subscription failed, triggering safety refresh');
              refreshRef.current?.(false).catch(() => {});
            }
          }, 2000);
        } else if (status === 'CLOSED') {
          // Subscription closed unexpectedly - force reconnection by triggering effect re-run
          // Only reconnect if component is still active (not during cleanup)
          // If active is false, the component is unmounting and we shouldn't reconnect
          if (active && subscriptionStatusRef.current !== 'subscribed') {
            console.warn('[useMiniLeagueChat] Subscription closed unexpectedly, forcing reconnection');
            // Trigger effect re-run by updating reconnectTrigger
            // Use setTimeout to avoid state update during render
            setTimeout(() => {
              // Double-check active flag after timeout (component might have unmounted)
              if (active) {
                setReconnectTrigger(prev => prev + 1);
              }
            }, 100);
            // Also trigger refresh to get latest messages immediately
            if (safetyFallbackTimeout) {
              clearTimeout(safetyFallbackTimeout);
            }
            safetyFallbackTimeout = setTimeout(() => {
              if (active && subscriptionStatusRef.current !== 'subscribed') {
                refreshRef.current?.(false).catch(() => {});
              }
            }, 1000);
          } else {
            // CLOSED during cleanup is expected - don't reconnect
            if (!active) {
              console.log('[useMiniLeagueChat] CLOSED during cleanup (expected)');
            } else {
              console.warn('[useMiniLeagueChat] CLOSED detected but not reconnecting:', {
                active,
                currentStatus: subscriptionStatusRef.current
              });
            }
          }
        }
      });

    return () => {
      // Log cleanup with current dependencies
      try {
        const existingLogs = localStorage.getItem('message_subscription_logs');
        const logs = existingLogs ? JSON.parse(existingLogs) : [];
        logs.push({
          timestamp: Date.now(),
          leagueId: miniLeagueId,
          status: 'EFFECT_UNMOUNT',
          channel: `league-messages:${miniLeagueId}`,
          dependencies: {
            miniLeagueId,
            enabled,
            autoSubscribe,
            userId: userIdRef.current,
          },
          effectId,
          reason: 'Subscription effect unmounting (cleanup)',
        });
        const recentLogs = logs.slice(-50);
        localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.error('[useMiniLeagueChat] Failed to log effect unmount:', e);
      }
      
      active = false;
      if (safetyFallbackTimeout) {
        clearTimeout(safetyFallbackTimeout);
      }
      if (channel) {
        supabase.removeChannel(channel);
        // Log explicit channel removal
        try {
          const existingLogs = localStorage.getItem('message_subscription_logs');
          const logs = existingLogs ? JSON.parse(existingLogs) : [];
          logs.push({
            timestamp: Date.now(),
            leagueId: miniLeagueId,
            status: 'CLOSED',
            channel: `league-messages:${miniLeagueId}`,
            dependencies: {
              miniLeagueId,
              enabled,
              autoSubscribe,
              userId: userIdRef.current,
            },
            effectId,
            reason: 'Channel removed in cleanup',
          });
          const recentLogs = logs.slice(-50);
          localStorage.setItem('message_subscription_logs', JSON.stringify(recentLogs));
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [miniLeagueId, enabled, autoSubscribe, reconnectTrigger]); // reconnectTrigger forces reconnection on CLOSED

  // SECOND: Separate effect for cache/refresh (won't trigger subscription recreation)
  useEffect(() => {
    if (!miniLeagueId || !enabled) {
      setMessages([]);
      setHasMore(true);
      return;
    }

    // Check if coming from notification - if yes, skip cache and fetch fresh immediately
    const comingFromNotification = typeof window !== 'undefined' && 
      new URLSearchParams(window.location.search).get('tab') === 'chat';

    if (comingFromNotification) {
      // Coming from notification - skip cache, fetch fresh immediately
      // This ensures we get the message that triggered the notification
      refreshRef.current?.(true).catch(() => {});
      return;
    }

    // Normal flow - check cache
    const currentMessages = messagesRef.current;
    const cachedMessages = getCached<MiniLeagueChatMessage[]>(`chat:messages:${miniLeagueId}`);
    
    if (currentMessages.length > 0) {
      // Already have messages, verify timestamps
      if (currentMessages.length > 0) {
        earliestTimestampRef.current = currentMessages[0].created_at;
        latestTimestampRef.current = currentMessages[currentMessages.length - 1].created_at;
        setHasMore(currentMessages.length >= 50);
      }
      // Still refresh in background to get latest (but don't block UI)
      refreshRef.current?.(false).catch(() => {});
    } else if (cachedMessages && cachedMessages.length > 0) {
      // Load from cache
      applyMessages(() => cachedMessages);
      if (cachedMessages.length > 0) {
        earliestTimestampRef.current = cachedMessages[0].created_at;
        latestTimestampRef.current = cachedMessages[cachedMessages.length - 1].created_at;
      }
      setHasMore(cachedMessages.length >= 50);
      // Refresh in background to get latest
      refreshRef.current?.(false).catch(() => {});
    } else {
      // No cache - fetch on mount
      refreshRef.current?.(false).catch(() => {});
    }
  }, [miniLeagueId, enabled]); // Only re-run if league or enabled changes, not when messages change

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
          reply_to_message_id,
          reply_to:league_messages!reply_to_message_id(id, content, user_id)
        `)
        .single();

      // Log message insert
      logDataFetch('useMiniLeagueChat', 'Insert message', 'league_messages', { data, error }, { leagueId: miniLeagueId, userId, hasReplyTo: !!replyToMessageId });

      if (error) {
        const { handleChatError } = await import('../lib/chatErrors');
        const chatError = handleChatError(error, 'sendMessage');
        console.error('[useMiniLeagueChat] Error sending message:', error);
        applyMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticId ? { ...msg, status: "error" as const } : msg
          )
        );
        throw new Error(chatError.message);
      }

      if (data) {
        // If foreign key didn't work, fetch reply data manually
        if (data.reply_to_message_id && (!data.reply_to || Array.isArray(data.reply_to))) {
          const { data: replyMessage } = await supabase
            .from("league_messages")
            .select("id, content, user_id")
            .eq("id", data.reply_to_message_id)
            .single();
          
          if (replyMessage) {
            (data as any).reply_to = replyMessage;
          } else {
            (data as any).reply_to = null;
          }
        }
        
        const finalized = normalizeMessage(data);
        finalized.client_msg_id = clientId;
        finalized.status = "sent";
        
        applyMessages((prev) => {
          // Replace optimistic message with real one
          const optimisticIndex = prev.findIndex(msg => 
            msg.id === optimisticId || 
            (msg.client_msg_id === clientId && msg.id.startsWith('optimistic-'))
          );
          
          if (optimisticIndex >= 0) {
            const updated = [...prev];
            updated[optimisticIndex] = finalized;
            return dedupeAndSort(updated);
          } else {
            // Optimistic not found, check if real message exists
            if (!prev.some(msg => msg.id === finalized.id)) {
              return dedupeAndSort([...prev, finalized]);
            }
            return prev;
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
