import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';
import { useQuery } from '@tanstack/react-query';

import ChatMessageBubble from './ChatMessageBubble';
import ChatComposer from './ChatComposer';
import ChatActionsSheet from './ChatActionsSheet';
import { useLeagueChat } from '../../hooks/useLeagueChat';
import { useLeagueChatPresence } from '../../hooks/useLeagueChatPresence';
import { useLeagueChatReadReceipts } from '../../hooks/useLeagueChatReadReceipts';
import { useLeagueChatReactions } from '../../hooks/useLeagueChatReactions';
import { supabase } from '../../lib/supabase';

export default function LeagueChatTab({
  leagueId,
  members,
}: {
  leagueId: string;
  members: Array<{ id: string; name: string }>;
}) {
  const t = useTokens();
  const listRef = React.useRef<FlatList<any> | null>(null);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<{ id: string; content: string; authorName?: string } | null>(null);
  const [actionsFor, setActionsFor] = React.useState<{ id: string; content: string; authorName?: string } | null>(null);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });

  const meId: string | null = me?.id ?? null;
  const nameById = React.useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const meName = meId ? nameById.get(meId) ?? 'You' : 'You';

  const { messages, fetchOlder, hasOlder, isFetchingOlder, isLoading, error, sendMessage } = useLeagueChat({
    leagueId,
    enabled: true,
  });

  useLeagueChatPresence({ leagueId, userId: meId, enabled: true });
  const { markAsRead } = useLeagueChatReadReceipts({ leagueId, userId: meId, enabled: true });

  const messageIds = React.useMemo(() => messages.map((m) => m.id).filter((id) => !id.startsWith('optimistic-')), [messages]);
  const { reactions, toggleReaction } = useLeagueChatReactions({
    leagueId,
    userId: meId,
    enabled: true,
    messageIds,
  });

  React.useEffect(() => {
    if (messages.length) {
      markAsRead();
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
      markAsRead();
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    } finally {
      setSending(false);
    }
  };

  const data = React.useMemo(() => [...messages].reverse(), [messages]); // inverted for FlatList

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <View style={{ flex: 1 }}>
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
          data={data}
          keyExtractor={(m) => m.id}
          inverted
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: t.space[4], paddingBottom: 8, paddingTop: 12 }}
          onScroll={(e) => {
            // With inverted list, offset ~0 means "at bottom / latest"
            if (e.nativeEvent.contentOffset.y < 40) {
              markAsRead();
            }
          }}
          scrollEventThrottle={16}
          onEndReached={() => {
            if (hasOlder && !isFetchingOlder) void fetchOlder();
          }}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={
            isLoading ? <TotlText variant="muted">Loading…</TotlText> : hasOlder ? <TotlText variant="microMuted">Pull up for earlier…</TotlText> : null
          }
          renderItem={({ item }) => {
            const isMe = !!meId && item.user_id === meId;
            const authorName = isMe ? meName : nameById.get(item.user_id) ?? 'Unknown';
            const r = reactions[item.id] ?? [];
            return (
              <ChatMessageBubble
                message={item}
                isMe={isMe}
                authorName={authorName}
                reactions={r}
                onPressReaction={(emoji) => void toggleReaction(item.id, emoji)}
                onLongPress={() => setActionsFor({ id: item.id, content: item.content, authorName })}
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

