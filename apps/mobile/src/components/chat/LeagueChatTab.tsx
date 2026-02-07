import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';
import { useQuery } from '@tanstack/react-query';

import ChatMessageBubble from './ChatMessageBubble';
import ChatComposer from './ChatComposer';
import ChatActionsSheet from './ChatActionsSheet';
import { useLeagueChat } from '../../hooks/useLeagueChat';
import type { LeagueChatMessage } from '../../hooks/useLeagueChat';
import { useLeagueChatPresence } from '../../hooks/useLeagueChatPresence';
import { useLeagueChatReadReceipts } from '../../hooks/useLeagueChatReadReceipts';
import { useLeagueChatReactions } from '../../hooks/useLeagueChatReactions';
import { supabase } from '../../lib/supabase';

type ChatListItem =
  | { type: 'message'; message: LeagueChatMessage }
  | { type: 'day'; key: string; label: string };

function dayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function labelForDayKey(key: string): string {
  if (key === 'unknown') return '';
  const now = new Date();
  const todayKey = dayKeyFromIso(now.toISOString());
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const yesterdayKey = dayKeyFromIso(yest.toISOString());

  if (key === todayKey) return 'Today';
  if (key === yesterdayKey) return 'Yesterday';

  // Render like "Sat 31 Jan"
  const d = new Date(`${key}T12:00:00`);
  try {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${weekdays[d.getDay()] ?? ''} ${d.getDate()} ${months[d.getMonth()] ?? ''}`.trim();
  }
}

function prevMessage(items: ChatListItem[], index: number) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const it = items[i];
    if (it?.type === 'message') return it.message;
  }
  return null;
}

function nextMessage(items: ChatListItem[], index: number) {
  for (let i = index + 1; i < items.length; i += 1) {
    const it = items[i];
    if (it?.type === 'message') return it.message;
  }
  return null;
}

export default function LeagueChatTab({
  leagueId,
  members,
}: {
  leagueId: string;
  members: Array<{ id: string; name: string; avatar_url?: string | null }>;
}) {
  const t = useTokens();
  const chatBg = t.color.background;
  const listRef = React.useRef<FlatList<any> | null>(null);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<{ id: string; content: string; authorName?: string } | null>(null);
  const [actionsFor, setActionsFor] = React.useState<{ id: string; content: string; authorName?: string } | null>(null);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      // IMPORTANT: Prefer `getSession()` (local, reliable) over `getUser()` (network-backed).
      // If `getUser()` fails/returns null transiently, read receipts won't write and badges won't clear.
      const { data } = await supabase.auth.getSession();
      return data.session?.user ?? null;
    },
  });

  const meId: string | null = me?.id ?? null;
  const nameById = React.useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const avatarById = React.useMemo(() => new Map(members.map((m) => [m.id, m.avatar_url ?? null])), [members]);
  const meName = meId ? nameById.get(meId) ?? 'You' : 'You';

  const { messages, fetchOlder, hasOlder, isFetchingOlder, isLoading, error, sendMessage } = useLeagueChat({
    leagueId,
    enabled: true,
  });

  useLeagueChatPresence({ leagueId, userId: meId, enabled: true });
  const { markAsRead } = useLeagueChatReadReceipts({ leagueId, userId: meId, enabled: true });

  // Ensure we record a read receipt on first open (as soon as we know who "me" is),
  // so unread badges clear when navigating back without requiring a second open.
  React.useEffect(() => {
    if (!meId) return;
    markAsRead();
  }, [markAsRead, meId]);

  const messageIds = React.useMemo(() => messages.map((m) => m.id).filter((id) => !id.startsWith('optimistic-')), [messages]);
  const { reactions, toggleReaction } = useLeagueChatReactions({
    leagueId,
    userId: meId,
    enabled: true,
    messageIds,
  });

  React.useEffect(() => {
    if (messages.length) {
      const newest = messages[messages.length - 1]?.created_at ?? null;
      markAsRead({ lastReadAtOverride: newest });
    }
  }, [markAsRead, messages.length]);

  const onSend = async () => {
    if (!meId) return;
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setSending(true);
    try {
      await sendMessage({ userId: meId, senderName: meName, content: text, replyToMessageId: replyTo?.id ?? null });
      setReplyTo(null);
      const newest = messages[messages.length - 1]?.created_at ?? null;
      markAsRead({ lastReadAtOverride: newest });
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    } finally {
      setSending(false);
    }
  };

  const listItems: ChatListItem[] = React.useMemo(() => {
    const newestFirst = [...messages].reverse(); // for inverted FlatList
    const items: ChatListItem[] = [];
    for (let i = 0; i < newestFirst.length; i += 1) {
      const m = newestFirst[i]!;
      items.push({ type: 'message', message: m });
      const currDay = dayKeyFromIso(m.created_at);
      const next = newestFirst[i + 1] ?? null; // older
      const nextDay = next ? dayKeyFromIso(next.created_at) : null;
      if (!next || nextDay !== currDay) {
        const label = labelForDayKey(currDay);
        items.push({ type: 'day', key: `day-${currDay}`, label });
      }
    }
    return items;
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // We’re not inside a native nav header; offsetting here causes visual gaps.
      keyboardVerticalOffset={0}
    >
      <View style={{ flex: 1, backgroundColor: chatBg }}>
        {error ? (
          <Card style={{ margin: t.space[4] }}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Couldn’t load chat
            </TotlText>
            <TotlText variant="muted">{error}</TotlText>
          </Card>
        ) : null}

        <FlatList
          ref={(n) => {
            listRef.current = n;
          }}
          data={listItems}
          keyExtractor={(it) => (it.type === 'message' ? it.message.id : it.key)}
          inverted
          style={{ flex: 1, backgroundColor: chatBg }}
          // No inset "frame" — keep the list full-bleed and apply row padding within message rows instead.
          contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: 8, paddingTop: 0 }}
          onScroll={(e) => {
            // With inverted list, offset ~0 means "at bottom / latest"
            if (e.nativeEvent.contentOffset.y < 40) {
              const newest = messages[messages.length - 1]?.created_at ?? null;
              markAsRead({ lastReadAtOverride: newest });
            }
          }}
          scrollEventThrottle={16}
          onEndReached={() => {
            if (hasOlder && !isFetchingOlder) void fetchOlder();
          }}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 8 }}>
              {/* Gap between the newest message and the composer (WhatsApp-like breathing room). */}
              <View style={{ height: 8 }} />
              {isLoading ? <TotlText variant="muted">Loading…</TotlText> : null}
            </View>
          }
          renderItem={({ item, index }) => {
            if (item.type === 'day') {
              if (!item.label) return <View style={{ height: 10 }} />;
              return (
                <View style={{ alignItems: 'center', marginVertical: 10 }}>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: 'rgba(148,163,184,0.18)',
                    }}
                  >
                    <TotlText style={{ fontFamily: 'System', fontSize: 12, lineHeight: 14, color: 'rgba(15,23,42,0.55)' }}>
                      {item.label}
                    </TotlText>
                  </View>
                </View>
              );
            }

            const msg = item.message;
            const isMe = !!meId && msg.user_id === meId;
            const authorName = isMe ? meName : nameById.get(msg.user_id) ?? 'Unknown';
            const avatarUri = isMe ? null : avatarById.get(msg.user_id) ?? null;
            const r = reactions[msg.id] ?? [];

            const prev = prevMessage(listItems, index); // newer (visually below)
            const next = nextMessage(listItems, index); // older (visually above)
            const sameAsPrev = !!prev && prev.user_id === msg.user_id;
            const sameAsNext = !!next && next.user_id === msg.user_id;
            const speakerChanged = !!prev && prev.user_id !== msg.user_id;

            // Strict grouping:
            // - same sender in a run: keep bubbles aligned + tight spacing
            // - show avatar once per run (newest message in that run)
            // - show name once per run (oldest message in that run)
            const showAvatar = !isMe && !sameAsPrev;
            const showAuthorName = !isMe && !sameAsNext;
            const topSpacing = sameAsPrev ? 2 : speakerChanged ? 14 : 10;

            return (
              <ChatMessageBubble
                message={msg}
                isMe={isMe}
                authorName={authorName}
                avatarLabel={authorName}
                avatarUri={avatarUri}
                showAvatar={showAvatar}
                showAuthorName={showAuthorName}
                topSpacing={topSpacing}
                reactions={r}
                onPressReaction={(emoji) => void toggleReaction(msg.id, emoji)}
                onLongPress={() => setActionsFor({ id: msg.id, content: msg.content, authorName })}
              />
            );
          }}
        />

        <View style={{ borderTopWidth: 1, borderTopColor: t.color.border }}>
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={onSend}
            sending={sending}
            replyPreview={replyTo ? { content: replyTo.content, authorName: replyTo.authorName } : null}
            onCancelReply={() => setReplyTo(null)}
          />
        </View>

        <ChatActionsSheet
          open={!!actionsFor}
          onClose={() => setActionsFor(null)}
          onReply={() => {
            if (!actionsFor) return;
            setReplyTo(actionsFor);
            setActionsFor(null);
          }}
          onReact={(emoji) => {
            if (!actionsFor) return;
            void toggleReaction(actionsFor.id, emoji);
            setActionsFor(null);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

