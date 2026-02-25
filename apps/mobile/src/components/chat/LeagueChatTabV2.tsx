import React from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery } from '@tanstack/react-query';
import { GiftedChat, InputToolbar, type IMessage } from 'react-native-gifted-chat';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';

import { Card, TotlText, useTokens } from '@totl/ui';
import { supabase } from '../../lib/supabase';

import ChatActionsSheet from './ChatActionsSheet';
import { useLeagueChat } from '../../hooks/useLeagueChat';
import { useLeagueChatPresence } from '../../hooks/useLeagueChatPresence';
import { useLeagueChatReadReceipts } from '../../hooks/useLeagueChatReadReceipts';
import { useLeagueChatReactions } from '../../hooks/useLeagueChatReactions';
import type { LeagueChatMessage } from '../../hooks/useLeagueChat';

function toGiftedMessage(
  m: LeagueChatMessage,
  nameById: Map<string, string>,
  avatarById: Map<string, string | null>,
  meId: string | null
): IMessage {
  const isMe = !!meId && m.user_id === meId;
  const authorName = isMe ? 'You' : (nameById.get(m.user_id) ?? 'Unknown');
  const avatar = avatarById.get(m.user_id) ?? null;

  return {
    _id: m.id,
    text: m.content ?? '',
    createdAt: new Date(m.created_at),
    user: {
      _id: m.user_id,
      name: authorName,
      ...(avatar ? { avatar } : {}),
    },
  };
}

function InputToolbarWithAnimatedInset({
  insetsBottom,
  ...props
}: any & { insetsBottom: number }) {
  const t = useTokens();
  // This runs inside GiftedChat's KeyboardProvider, so we get real progress values.
  const { progress } = useReanimatedKeyboardAnimation();

  const wrapperStyle = useAnimatedStyle(() => {
    const p = progress.value; // 0..1
    return { paddingBottom: insetsBottom * (1 - p) };
  }, [insetsBottom]);

  return (
    <Reanimated.View style={[{ backgroundColor: t.color.background }, wrapperStyle]}>
      <InputToolbar
        {...props}
        containerStyle={[
          // Remove the default hairline/spacing to match existing style.
          { borderTopWidth: 0, paddingBottom: 0, backgroundColor: t.color.background },
          props.containerStyle,
        ]}
      />
    </Reanimated.View>
  );
}

function ChatFooterKeyboardSpacer({ height }: { height: number }) {
  // Runs inside GiftedChat's KeyboardProvider.
  const { progress } = useReanimatedKeyboardAnimation();
  const style = useAnimatedStyle(() => {
    return { height: height * progress.value };
  }, [height]);

  return <Reanimated.View style={style} />;
}

export default function LeagueChatTabV2({
  leagueId,
  members,
  keyboardHeaderOffset,
}: {
  leagueId: string;
  members: Array<{ id: string; name: string; avatar_url?: string | null }>;
  keyboardHeaderOffset?: number;
}) {
  const t = useTokens();
  const chatBg = t.color.background;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const effectiveHeaderOffset = typeof keyboardHeaderOffset === 'number' ? keyboardHeaderOffset : headerHeight;
  const nameById = React.useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const avatarById = React.useMemo(() => new Map(members.map((m) => [m.id, m.avatar_url ?? null])), [members]);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user ?? null;
    },
  });

  const meId: string | null = me?.id ?? null;
  const meName = meId ? nameById.get(meId) ?? 'You' : 'You';

  const {
    messages: messagesRaw,
    fetchOlder,
    hasOlder,
    isFetchingOlder,
    isLoading,
    error,
    sendMessage,
  } = useLeagueChat({
    leagueId,
    enabled: true,
  });

  useLeagueChatPresence({ leagueId, userId: meId, enabled: true });
  const { markAsRead } = useLeagueChatReadReceipts({ leagueId, userId: meId, enabled: true });

  const messages: IMessage[] = React.useMemo(() => {
    const src = Array.isArray(messagesRaw) ? messagesRaw : [];
    // GiftedChat expects DESC (newest first)
    const sortedDesc = [...src].sort((a, b) => {
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      if (at === bt) return b.id.localeCompare(a.id);
      return bt - at;
    });
    return sortedDesc.map((m) => toGiftedMessage(m, nameById, avatarById, meId));
  }, [avatarById, meId, messagesRaw, nameById]);

  const messageIds = React.useMemo(() => {
    // Keep reaction hook warm, even if UI isn't rendered yet.
    const ids = messages
      .map((m) => String(m._id))
      .filter((id) => id && !id.startsWith('optimistic-'));
    return Array.from(new Set(ids)).sort();
  }, [messages]);
  const { toggleReaction } = useLeagueChatReactions({
    leagueId,
    userId: meId,
    enabled: true,
    messageIds,
  });

  const [actionsFor, setActionsFor] = React.useState<{ id: string; content: string; authorName?: string } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (!meId) return;
      markAsRead();
    }, [markAsRead, meId])
  );

  React.useEffect(() => {
    if (!meId) return;
    // Mark read on mount + whenever messages update
    markAsRead();
  }, [meId, markAsRead, messages.length]);

  const handleSend = React.useCallback(
    async (newMsgs: IMessage[] = []) => {
      if (!meId) return;
      const first = newMsgs[0];
      const text = String(first?.text ?? '').trim();
      if (!text) return;

      await sendMessage({
        userId: meId,
        senderName: meName,
        content: text,
        replyToMessageId: null,
      });

      markAsRead();
    },
    [markAsRead, meId, meName, sendMessage]
  );

  const handleLongPress = React.useCallback(
    (_: unknown, msg: IMessage) => {
      const id = String(msg?._id ?? '');
      if (!id) return;
      setActionsFor({ id, content: String(msg?.text ?? ''), authorName: typeof msg?.user?.name === 'string' ? msg.user.name : undefined });
    },
    []
  );

  return (
    <View style={{ flex: 1, backgroundColor: chatBg }}>
      {error ? (
        <Card style={{ margin: t.space[4] }}>
          <TotlText variant="heading" style={{ marginBottom: 6 }}>
            Couldn’t load chat
          </TotlText>
          <TotlText variant="muted">{String(error)}</TotlText>
        </Card>
      ) : null}

      <View style={{ flex: 1 }}>
        <GiftedChat
          messages={messages}
          onSend={handleSend}
          user={{ _id: meId ?? 'anon', name: meName }}
          onLongPressMessage={handleLongPress}
          textInputProps={{ placeholder: 'Message…' }}
          // Ensure areas revealed during keyboard animation are painted (avoid gray underlay).
          messagesContainerStyle={{ backgroundColor: chatBg }}
          // GiftedChat uses `react-native-keyboard-controller`'s KeyboardAvoidingView internally.
          // With a native stack header, our screen content starts *below* the header, so we must
          // offset by the header height (otherwise the toolbar can sit under the keyboard).
          keyboardAvoidingViewProps={{
            keyboardVerticalOffset: effectiveHeaderOffset,
            behavior: 'padding' as any,
          }}
          keyboardProviderProps={{ preload: false }}
          listProps={{
            style: { backgroundColor: chatBg },
            contentContainerStyle: { paddingBottom: 10 },
          }}
          renderChatFooter={() => <ChatFooterKeyboardSpacer height={insets.bottom} />}
          renderInputToolbar={(props: any) => <InputToolbarWithAnimatedInset {...props} insetsBottom={insets.bottom} />}
          // Try to keep behavior consistent with older implementation.
          keyboardShouldPersistTaps="handled"
        />
      </View>

      <ChatActionsSheet
        open={!!actionsFor}
        onClose={() => setActionsFor(null)}
        onReply={() => {
          // Non-goal in this pass: reply UI/threading.
          setActionsFor(null);
        }}
        onReact={(emoji) => {
          if (!actionsFor) return;
          void toggleReaction(actionsFor.id, emoji);
          setActionsFor(null);
        }}
      />
    </View>
  );
}
