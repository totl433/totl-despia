import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../lib/supabase";

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
  const [messages, setMessages] = useState<MiniLeagueChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const earliestTimestampRef = useRef<string | null>(null);

  const applyMessages = useCallback(
    (updater: (prev: MiniLeagueChatMessage[]) => MiniLeagueChatMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        earliestTimestampRef.current = next.length ? next[0].created_at : null;
        return next;
      });
    },
    []
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
          return dedupeAndSort([...normalized, ...prev]);
        }
        return dedupeAndSort(normalized);
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
    setLoading(true);
    setError(null);
    earliestTimestampRef.current = null;
    try {
      await fetchPage({ append: false });
    } catch (err: any) {
      setError(err?.message ?? "Failed to load chat");
    } finally {
      setLoading(false);
    }
  }, [miniLeagueId, enabled, fetchPage]);

  useEffect(() => {
    if (!miniLeagueId || !enabled) {
      setMessages([]);
      setHasMore(true);
      return;
    }

    let active = true;
    refresh();

    if (!autoSubscribe) {
      return () => {
        active = false;
      };
    }

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
          // For real-time updates, fetch the full message with reply data
          const { data: fullMessage } = await supabase
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
              if (prev.some((msg) => msg.id === incoming.id)) {
                return prev;
              }
              return dedupeAndSort([...prev, incoming]);
            });
          } else {
            // Fallback to basic normalization if fetch fails
            const incoming = normalizeMessage(payload.new);
            applyMessages((prev) => {
              if (prev.some((msg) => msg.id === incoming.id)) {
                return prev;
              }
              return dedupeAndSort([...prev, incoming]);
            });
          }
        }
      )
      .subscribe((status) => {
        // If subscription fails or becomes inactive, refresh messages
        if (status === 'SUBSCRIBED') {
          // Subscription active
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Subscription failed - refresh to get any missed messages
          if (active) {
            refresh();
          }
        }
      });

    // Refresh messages when page becomes visible (user returns from background)
    const handleVisibilityChange = () => {
      if (!active) return;
      if (document.visibilityState === 'visible') {
        // User returned to the app - refresh to catch any missed messages
        refresh();
      }
    };

    // Refresh messages when window gains focus (user taps notification)
    const handleFocus = () => {
      if (!active) return;
      // Small delay to ensure we're fully back in the app
      setTimeout(() => {
        if (active) {
          refresh();
        }
      }, 100);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
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
        applyMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticId ? { ...msg, status: "error" as const } : msg
          )
        );
        throw error;
      }

      if (data) {
        const finalized = normalizeMessage(data);
        finalized.client_msg_id = clientId;
        applyMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticId
              ? { ...finalized, status: "sent", client_msg_id: clientId }
              : msg
          )
        );
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
