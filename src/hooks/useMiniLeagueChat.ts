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
};

type UseMiniLeagueChatOptions = {
  userId?: string | null;
  enabled?: boolean;
  autoSubscribe?: boolean;
};

const normalizeMessage = (row: any): MiniLeagueChatMessage => ({
  id: row.id,
  league_id: row.league_id,
  user_id: row.user_id,
  content: row.content,
  created_at: row.created_at ?? new Date().toISOString(),
  status: "sent",
});

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
      const query = supabase
        .from("league_messages")
        .select("id, league_id, user_id, content, created_at")
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

      const normalized = (data ?? []).map(normalizeMessage).reverse();

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
        (payload) => {
          if (!active) return;
          const incoming = normalizeMessage(payload.new);
          applyMessages((prev) => {
            if (prev.some((msg) => msg.id === incoming.id)) {
              return prev;
            }
            return dedupeAndSort([...prev, incoming]);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
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
    async (text: string) => {
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
      };

      applyMessages((prev) => dedupeAndSort([...prev, optimistic]));

      const { data, error } = await supabase
        .from("league_messages")
        .insert({
          league_id: miniLeagueId,
          user_id: userId,
          content: trimmed,
        })
        .select("id, league_id, user_id, content, created_at")
        .single();

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
