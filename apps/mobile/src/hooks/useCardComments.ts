import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { LeagueChatMessage } from './useLeagueChat';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

/** A row of game_centre_comments, as the signed-in reader may see it (RLS hides blocked people). */
export type CardCommentRow = {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  reply_to_comment_id: string | null;
  created_at: string;
};

export type CommentAuthor = { id: string; name: string; avatar_url: string | null };

const COMMENT_COLUMNS = 'id, card_id, user_id, content, reply_to_comment_id, created_at';

/** Comment rows as chat messages, so the Mini League chat view can show them. */
export function commentsAsMessages(rows: CardCommentRow[]): LeagueChatMessage[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    const parent = row.reply_to_comment_id ? byId.get(row.reply_to_comment_id) : undefined;
    return {
      id: row.id,
      league_id: row.card_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      reply_to_message_id: row.reply_to_comment_id,
      reply_to: parent ? { id: parent.id, content: parent.content, user_id: parent.user_id } : null,
    };
  });
}

/** Post a comment on a card (the footer box and the comments screen both use this). */
export async function postCardComment(input: {
  cardId: string;
  userId: string;
  content: string;
  replyToId?: string | null;
}): Promise<CardCommentRow | null> {
  const content = input.content.trim();
  if (!input.cardId || !content) return null;
  const { data, error } = await (supabase as any)
    .from('game_centre_comments')
    .insert({ card_id: input.cardId, user_id: input.userId, content, reply_to_comment_id: input.replyToId ?? null })
    .select(COMMENT_COLUMNS)
    .single();
  if (error) throw error;
  return data as CardCommentRow;
}

/**
 * One card's public comment thread: loaded, kept live through Realtime, and written by
 * both the card's footer and its comments screen, so the two always agree.
 */
export function useCardComments(cardId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ['game-centre-comments', cardId] as const, [cardId]);

  const comments = useQuery({
    enabled: !!cardId,
    queryKey,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('game_centre_comments')
        .select(COMMENT_COLUMNS)
        .eq('card_id', cardId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as CardCommentRow[];
    },
  });

  const authorIds = React.useMemo(
    () => [...new Set((comments.data ?? []).map((row) => row.user_id))].sort(),
    [comments.data]
  );
  const authors = useQuery({
    enabled: authorIds.length > 0,
    queryKey: ['game-centre-comment-authors', authorIds.join(',')],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, name, avatar_url').in('id', authorIds);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name ?? '') || 'Someone',
        avatar_url: typeof row.avatar_url === 'string' && row.avatar_url.trim() ? row.avatar_url : null,
      })) as CommentAuthor[];
    },
  });

  React.useEffect(() => {
    if (!cardId) return;
    const channel = supabase
      .channel(`game-centre-comments:${cardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_centre_comments', filter: `card_id=eq.${cardId}` },
        () => void queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cardId, queryClient, queryKey]);

  const send = React.useCallback(
    async (input: { userId: string; content: string; replyToId?: string | null }) => {
      if (!cardId) return;
      const data = await postCardComment({ cardId, userId: input.userId, content: input.content, replyToId: input.replyToId });
      if (!data) return;
      queryClient.setQueryData<CardCommentRow[]>(queryKey, (current) =>
        current?.some((row) => row.id === data.id) ? current : [...(current ?? []), data]
      );
      void queryClient.invalidateQueries({ queryKey: ['game-centre-comment-counts'] });
    },
    [cardId, queryClient, queryKey]
  );

  const report = React.useCallback(async (commentId: string, reason: string) => {
    await api.submitGameCentreCommentReport({ commentId, reason });
  }, []);

  const block = React.useCallback(
    async (blockerId: string, blockedId: string) => {
      const { error } = await (supabase as any)
        .from('user_blocks')
        .upsert({ blocker_user_id: blockerId, blocked_user_id: blockedId }, { onConflict: 'blocker_user_id,blocked_user_id', ignoreDuplicates: true });
      if (error) throw error;
      // Their comments drop out everywhere once RLS stops returning them.
      await queryClient.invalidateQueries({ queryKey: ['game-centre-comments'] });
      void queryClient.invalidateQueries({ queryKey: ['game-centre-comment-counts'] });
    },
    [queryClient]
  );

  return {
    comments: comments.data ?? [],
    authors: authors.data ?? [],
    isLoading: comments.isLoading,
    error: comments.error,
    send,
    report,
    block,
  };
}

/** How many comments each card has, for the feed. One query for every card on screen. */
export function useCardCommentCounts(cardIds: string[], enabled: boolean) {
  const ids = React.useMemo(() => [...new Set(cardIds)].sort(), [cardIds]);
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: enabled && ids.length > 0,
    queryKey: ['game-centre-comment-counts', ids.join(',')],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('game_centre_comments').select('card_id').in('card_id', ids).limit(5000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ card_id: string }>) counts[row.card_id] = (counts[row.card_id] ?? 0) + 1;
      return counts;
    },
  });
  React.useEffect(() => {
    if (!enabled || ids.length === 0) return;
    const channel = supabase
      .channel('game-centre-comment-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_centre_comments' }, () =>
        void queryClient.invalidateQueries({ queryKey: ['game-centre-comment-counts'] })
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, ids.length, queryClient]);
  return query.data ?? {};
}
