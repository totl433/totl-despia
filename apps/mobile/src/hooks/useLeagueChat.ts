import * as React from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { env } from '../env';

const PAGE_SIZE = 40;

export type LeagueChatMessage = {
  id: string;
  league_id: string;
  user_id: string;
  content: string;
  created_at: string;
  reply_to_message_id?: string | null;
  reply_to?: { id: string; content: string; user_id: string } | null;
  status?: 'sending' | 'error';
};

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 10;
}

function normalizeMessage(row: any): LeagueChatMessage {
  const replyToRaw = row?.reply_to;
  const replyToData = Array.isArray(replyToRaw) ? replyToRaw[0] : replyToRaw;
  const replyTo =
    replyToData && replyToData.id && replyToData.user_id
      ? { id: String(replyToData.id), content: String(replyToData.content ?? ''), user_id: String(replyToData.user_id) }
      : null;

  return {
    id: String(row.id),
    league_id: String(row.league_id),
    user_id: String(row.user_id),
    content: String(row.content ?? ''),
    created_at: isIsoDate(row.created_at) ? row.created_at : new Date().toISOString(),
    reply_to_message_id: typeof row.reply_to_message_id === 'string' ? row.reply_to_message_id : null,
    reply_to: replyTo,
  };
}

function sortAsc(list: LeagueChatMessage[]) {
  return [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function dedupeById(list: LeagueChatMessage[]) {
  const seen = new Set<string>();
  const out: LeagueChatMessage[] = [];
  for (const m of list) {
    const id = String(m.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(m);
  }
  return out;
}

function makeClientMsgId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function notifyLeagueMessage({
  leagueId,
  senderId,
  senderName,
  content,
  accessToken,
}: {
  leagueId: string;
  senderId: string;
  senderName: string;
  content: string;
  accessToken: string | null;
}): Promise<void> {
  // Skip notifications in local dev (matches web best-effort behavior)
  const bff = String(env.EXPO_PUBLIC_BFF_URL ?? '');
  if (bff.includes('localhost') || bff.includes('127.0.0.1')) return;

  const baseUrl = String(env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  if (!baseUrl) return;

  const url = `${baseUrl}/.netlify/functions/notifyLeagueMessageV2`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        leagueId,
        senderId,
        senderName,
        content,
        activeUserIds: [senderId],
      }),
    });
  } catch {
    // best effort
  } finally {
    clearTimeout(timeout);
  }
}

type Page = { rows: LeagueChatMessage[]; nextCursor: string | null };

type ChatInboxLastMessage = {
  league_id: string;
  content: string | null;
  created_at: string;
  user_id: string;
};

type ChatInboxLastByLeagueId = Record<string, ChatInboxLastMessage>;

function upsertChatInboxLastMessage(
  prev: unknown,
  leagueId: string,
  nextMsg: ChatInboxLastMessage
): ChatInboxLastByLeagueId | unknown {
  if (prev == null) return { [String(leagueId)]: nextMsg };

  // Backward compat: tolerate a persisted Map (older builds) and normalize to a plain object.
  let obj: ChatInboxLastByLeagueId | null = null;
  if (prev instanceof Map) {
    obj = {};
    (prev as Map<string, ChatInboxLastMessage>).forEach((v, k) => {
      obj![String(k)] = v;
    });
  } else if (typeof prev === 'object') {
    obj = prev as ChatInboxLastByLeagueId;
  }
  if (!obj) return prev;

  const current = obj[String(leagueId)] ?? null;
  if (current?.created_at && typeof current.created_at === 'string') {
    // Only replace if the new message is newer (ISO strings are lexicographically sortable).
    if (String(nextMsg.created_at).localeCompare(String(current.created_at)) <= 0) return prev;
  }

  return { ...obj, [String(leagueId)]: nextMsg };
}

async function fetchPage({ leagueId, before }: { leagueId: string; before?: string | null }): Promise<Page> {
  const query = supabase
    .from('league_messages')
    .select(
      `
      id,
      league_id,
      user_id,
      content,
      created_at,
      reply_to_message_id,
      reply_to:league_messages!reply_to_message_id(id, content, user_id)
    `
    )
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (before) query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw error;
  const raw = (data ?? []) as any[];
  const normalized = raw.map(normalizeMessage).reverse(); // asc
  const nextCursor = raw.length >= PAGE_SIZE ? normalized[0]?.created_at ?? null : null;
  return { rows: normalized, nextCursor };
}

export function useLeagueChat({
  leagueId,
  enabled,
}: {
  leagueId: string | null;
  enabled: boolean;
}): {
  messages: LeagueChatMessage[];
  fetchOlder: () => Promise<void>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  isLoading: boolean;
  error: string | null;
  sendMessage: (args: { userId: string; senderName: string; content: string; replyToMessageId?: string | null }) => Promise<void>;
} {
  const queryClient = useQueryClient();

  const q = useInfiniteQuery<Page>({
    enabled: enabled && !!leagueId,
    queryKey: ['leagueChat', leagueId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchPage({ leagueId: leagueId as string, before: (pageParam ?? null) as string | null }),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 5_000,
  });

  const messages = React.useMemo(() => {
    const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
    return sortAsc(dedupeById(rows));
  }, [q.data?.pages]);

  // Realtime: insert new messages (skip optimistic ones by dedupe on id).
  React.useEffect(() => {
    if (!enabled || !leagueId) return;
    let active = true;
    const channel = supabase
      .channel(`league-messages:${leagueId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_messages', filter: `league_id=eq.${leagueId}` },
        async (payload: any) => {
          if (!active) return;
          const incoming = normalizeMessage(payload.new);
          queryClient.setQueryData(['leagueChat', leagueId], (prev: any) => {
            if (!prev?.pages) return prev;
            const exists = prev.pages.some((p: Page) => p.rows.some((m) => m.id === incoming.id));
            if (exists) return prev;
            const pages = [...prev.pages];
            const first = pages[0] as Page;
            pages[0] = { ...first, rows: sortAsc([...first.rows, incoming]) };
            return { ...prev, pages };
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [enabled, leagueId, queryClient]);

  const sendMessage = React.useCallback(
    async ({
      userId,
      senderName,
      content,
      replyToMessageId,
    }: {
      userId: string;
      senderName: string;
      content: string;
      replyToMessageId?: string | null;
    }) => {
      if (!leagueId) return;
      const text = content.trim();
      if (!text) return;

      const clientMsgId = makeClientMsgId();
      const optimistic: LeagueChatMessage = {
        id: `optimistic-${clientMsgId}`,
        league_id: leagueId,
        user_id: userId,
        content: text,
        created_at: new Date().toISOString(),
        reply_to_message_id: replyToMessageId ?? null,
        status: 'sending',
      };

      // Update Chat inbox preview immediately (so the list updates without needing a refetch/remount).
      queryClient.setQueriesData(
        {
          predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'chatInboxLastMessagesV2',
        },
        (prev) =>
          upsertChatInboxLastMessage(prev, leagueId, {
            league_id: leagueId,
            content: text,
            created_at: optimistic.created_at,
            user_id: userId,
          })
      );

      queryClient.setQueryData(['leagueChat', leagueId], (prev: any) => {
        if (!prev?.pages) return prev;
        const pages = [...prev.pages];
        const first = pages[0] as Page;
        pages[0] = { ...first, rows: sortAsc([...first.rows, optimistic]) };
        return { ...prev, pages };
      });

      try {
        const { data: session } = await supabase.auth.getSession();
        const accessToken = session.session?.access_token ?? null;

        const { data, error } = await supabase
          .from('league_messages')
          .insert({
            league_id: leagueId,
            user_id: userId,
            content: text,
            reply_to_message_id: replyToMessageId ?? null,
          })
          .select(
            `
            id,
            league_id,
            user_id,
            content,
            created_at,
            reply_to_message_id,
            reply_to:league_messages!reply_to_message_id(id, content, user_id)
          `
          )
          .single();
        if (error) throw error;
        const saved = normalizeMessage(data);

        // Confirm/update inbox preview with canonical server timestamp.
        queryClient.setQueriesData(
          {
            predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'chatInboxLastMessagesV2',
          },
          (prev) =>
            upsertChatInboxLastMessage(prev, leagueId, {
              league_id: leagueId,
              content: saved.content,
              created_at: saved.created_at,
              user_id: saved.user_id,
            })
        );

        queryClient.setQueryData(['leagueChat', leagueId], (prev: any) => {
          if (!prev?.pages) return prev;
          const pages = prev.pages.map((p: Page) => ({ ...p, rows: p.rows.filter((m) => m.id !== optimistic.id) }));
          const exists = pages.some((p: Page) => p.rows.some((m) => m.id === saved.id));
          if (!exists) {
            const first = pages[0] as Page;
            pages[0] = { ...first, rows: sortAsc([...first.rows, saved]) };
          }
          return { ...prev, pages };
        });

        // Best-effort: push notify on successful send.
        void notifyLeagueMessage({
          leagueId,
          senderId: userId,
          senderName,
          content: text,
          accessToken,
        });
      } catch (e: any) {
        queryClient.setQueryData(['leagueChat', leagueId], (prev: any) => {
          if (!prev?.pages) return prev;
          const pages = prev.pages.map((p: Page) => ({
            ...p,
            rows: p.rows.map((m) => (m.id === optimistic.id ? { ...m, status: 'error' as const } : m)),
          }));
          return { ...prev, pages };
        });

        // Ensure the inbox doesn't get stuck showing an optimistic preview if send fails.
        void queryClient.invalidateQueries({
          predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'chatInboxLastMessagesV2',
        });
      }
    },
    [leagueId, queryClient]
  );

  const fetchOlder = React.useCallback(async () => {
    if (!q.hasNextPage || q.isFetchingNextPage) return;
    await q.fetchNextPage();
  }, [q.hasNextPage, q.isFetchingNextPage, q.fetchNextPage]);

  return {
    messages,
    fetchOlder,
    hasOlder: !!q.hasNextPage,
    isFetchingOlder: q.isFetchingNextPage,
    isLoading: q.isLoading,
    error: q.error ? String((q.error as any)?.message ?? q.error) : null,
    sendMessage,
  };
}

