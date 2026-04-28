import React from 'react';
import { Keyboard, Modal, Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Bubble, Composer, GiftedChat, type IMessage } from 'react-native-gifted-chat';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';

import { Card, TotlText, useTokens } from '@totl/ui';
import { useBrandedLeaderboardBroadcastReadReceipts } from '../../hooks/useBrandedLeaderboardBroadcastReadReceipts';
import { useBrandedLeaderboardBroadcastReactions } from '../../hooks/useBrandedLeaderboardBroadcastReactions';
import type { BrandedLeaderboardBroadcastUiMessage } from '../../lib/brandedLeaderboardBroadcastUnread';
import { VOLLEY_NAME, VOLLEY_USER_ID } from '../../lib/volley';

const DEFAULT_VISIBLE_REACTION_EMOJIS = ['👍', '🔥', '😬'] as const;
const EXTRA_REACTION_EMOJIS = ['👎', '🙌', '😮'] as const;
const REACTION_TRAY_WIDTH = 184;
const REACTION_TRAY_HEIGHT = 64;

function toGiftedMessage(
  message: BrandedLeaderboardBroadcastUiMessage,
  currentUserId: string | null
): IMessage {
  const isMe = !!currentUserId && message.user_id === currentUserId && message.user_id !== VOLLEY_USER_ID;
  const isVolley = message.user_id === VOLLEY_USER_ID || message.message_type === 'system';
  const authorName = isMe ? 'You' : isVolley ? VOLLEY_NAME : message.user_name ?? 'Host';

  return {
    _id: message.id,
    text: message.content ?? '',
    createdAt: new Date(message.created_at),
    user: {
      _id: message.user_id,
      name: authorName,
      ...(message.user_avatar_url ? { avatar: message.user_avatar_url } : {}),
    },
    status: message.status,
  };
}

function BroadcastInputToolbar({
  insetsBottom,
  ...props
}: any & {
  insetsBottom: number;
}) {
  const t = useTokens();
  const { progress } = useReanimatedKeyboardAnimation();

  const wrapperStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return { paddingBottom: p > 0.02 ? 12 : Math.max(16, insetsBottom) };
  }, [insetsBottom]);

  const text = typeof props.text === 'string' ? props.text : '';
  const trimmed = text.trim();

  return (
    <Reanimated.View style={[{ backgroundColor: t.color.background }, wrapperStyle]}>
      <View
        style={{
          borderTopWidth: 0,
          backgroundColor: t.color.background,
          paddingTop: 8,
          paddingBottom: 0,
          paddingHorizontal: 8,
          shadowColor: '#000000',
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
          elevation: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <TextInput
            value={text}
            onChangeText={props.textInputProps?.onChangeText}
            ref={props.textInputProps?.ref}
            placeholder="Message..."
            placeholderTextColor={t.color.muted}
            selectionColor={t.color.brand}
            multiline
            style={{
              flex: 1,
              minHeight: 50,
              maxHeight: 120,
              color: t.color.text,
              backgroundColor: t.color.surface,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: t.color.border,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
              fontSize: 16,
              lineHeight: 22,
            }}
          />
          {trimmed ? (
            <Pressable
              onPress={() => props.onSend?.({ text: trimmed }, true)}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                marginLeft: 8,
                marginBottom: 4,
                borderRadius: 18,
                backgroundColor: t.color.brand,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Reanimated.View>
  );
}

function formatDayLabel(input: Date | number | string | undefined) {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((today - dateOnly) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isSameDaySafe(a: Date | number | string | undefined, b: Date | number | string | undefined) {
  if (!a || !b) return false;
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function shouldShowIncomingUsername(props: any) {
  if (props?.position !== 'left') return false;
  const currentId = props?.currentMessage?.user?._id;
  if (!currentId) return false;
  const previousId = props?.previousMessage?.user?._id;
  if (!previousId) return true;
  if (previousId !== currentId) return true;
  return !isSameDaySafe(props?.currentMessage?.createdAt, props?.previousMessage?.createdAt);
}

function formatReactionCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

export default function BrandedLeaderboardBroadcastTab({
  leaderboardId,
  currentUserId,
  visible,
  canPost,
  messages,
  isLoading,
  error,
  onSend,
  setLastReadAt,
  keyboardVerticalOffset = 0,
}: {
  leaderboardId: string;
  currentUserId: string | null;
  visible: boolean;
  canPost: boolean;
  messages: BrandedLeaderboardBroadcastUiMessage[];
  isLoading: boolean;
  error: string | null;
  onSend: (content: string) => Promise<void>;
  setLastReadAt: (lastReadAt: string | null) => void;
  keyboardVerticalOffset?: number;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [sending, setSending] = React.useState(false);
  const [trayState, setTrayState] = React.useState<{
    messageId: string;
    x: number;
    y: number;
  } | null>(null);
  const lastReadMarkedAtRef = React.useRef<string | null>(null);
  const { markAsRead } = useBrandedLeaderboardBroadcastReadReceipts({
    leaderboardId,
    userId: currentUserId,
    enabled: visible,
  });
  const messageTypeById = React.useMemo(
    () =>
      new Map(messages.map((message) => [String(message.id), message.message_type])),
    [messages]
  );
  const { reactions, toggleReaction, isReactionPending } = useBrandedLeaderboardBroadcastReactions({
    leaderboardId,
    messages,
    userId: currentUserId,
    enabled: visible,
  });

  const giftedMessages = React.useMemo(() => {
    return [...messages]
      .sort((a, b) => {
        const at = new Date(a.created_at).getTime();
        const bt = new Date(b.created_at).getTime();
        if (at === bt) return b.id.localeCompare(a.id);
        return bt - at;
      })
      .map((message) => toGiftedMessage(message, currentUserId));
  }, [currentUserId, messages]);

  React.useEffect(() => {
    if (!visible) return;
    if (!messages.length) return;
    const newest = messages[messages.length - 1]?.created_at ?? null;
    if (!newest || newest === lastReadMarkedAtRef.current) return;
    setLastReadAt(newest);
    void markAsRead({ lastReadAtOverride: newest });
    lastReadMarkedAtRef.current = newest;
  }, [markAsRead, messages, setLastReadAt, visible]);

  const openReactionTray = React.useCallback(
    (messageId: string, pageX: number, pageY: number) => {
      const nextX = Math.min(
        Math.max(12, Math.round(pageX - REACTION_TRAY_WIDTH / 2)),
        Math.max(12, windowWidth - REACTION_TRAY_WIDTH - 12)
      );
      const nextY = Math.max(
        insets.top + 12,
        Math.round(pageY - REACTION_TRAY_HEIGHT - 20)
      );
      setTrayState({ messageId, x: nextX, y: nextY });
    },
    [insets.top, windowWidth]
  );

  const handleToggleReaction = React.useCallback(
    async (messageId: string, emoji: string) => {
      await toggleReaction(messageId, emoji);
      setTrayState((prev) => (prev?.messageId === messageId ? null : prev));
    },
    [toggleReaction]
  );

  const handleSend = React.useCallback(
    async (newMsgs: IMessage[] = []) => {
      const first = newMsgs[0];
      const text = String(first?.text ?? '').trim();
      if (!text) return;
      setSending(true);
      try {
        await onSend(text);
        const newest = new Date().toISOString();
        setLastReadAt(newest);
      } finally {
        setSending(false);
      }
    },
    [onSend, setLastReadAt]
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      {error ? (
        <Card style={{ marginHorizontal: t.space[4], marginTop: t.space[4] }}>
          <TotlText variant="heading" style={{ marginBottom: 6 }}>
            Couldn’t load broadcast
          </TotlText>
          <TotlText variant="muted">{error}</TotlText>
        </Card>
      ) : null}

      <View style={{ flex: 1 }}>
        <GiftedChat
          messages={giftedMessages}
          onSend={handleSend}
          user={{ _id: currentUserId ?? 'anon', name: 'You' }}
          textInputProps={{
            placeholder: 'Message…',
            placeholderTextColor: t.color.muted,
            selectionColor: t.color.brand,
          }}
          messagesContainerStyle={{ backgroundColor: t.color.background }}
          renderBubble={(props: any) => (
            <Bubble
              {...props}
              isUsernameVisible={shouldShowIncomingUsername(props)}
              renderUsername={() => null}
              wrapperStyle={{
                left: {
                  backgroundColor: t.color.surface,
                  borderWidth: 0,
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  paddingBottom: 10,
                },
                right: {
                  backgroundColor: t.color.brand,
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  paddingBottom: 10,
                },
              }}
              textStyle={{
                left: { color: t.color.text },
                right: { color: '#FFFFFF' },
              }}
              renderMessageText={(messageProps: any) => {
                const user = messageProps?.currentMessage?.user;
                const showUsername =
                  messageProps?.position === 'left' && shouldShowIncomingUsername(messageProps);
                return (
                  <View>
                    {showUsername && user ? (
                      <TotlText
                        style={{
                          marginBottom: 4,
                          fontSize: 13,
                          lineHeight: 16,
                          fontFamily: t.font.medium,
                          color: 'rgba(15,23,42,0.45)',
                        }}
                      >
                        {user._id === VOLLEY_USER_ID ? VOLLEY_NAME : String(user.name ?? '')}
                      </TotlText>
                    ) : null}
                    <TotlText
                      style={{
                        fontFamily: 'System',
                        fontSize: 16,
                        lineHeight: 20,
                        color:
                          messageProps?.position === 'right' ? '#FFFFFF' : t.color.text,
                      }}
                    >
                      {String(messageProps?.currentMessage?.text ?? '')}
                    </TotlText>
                  </View>
                );
              }}
              timeTextStyle={{
                left: { color: 'rgba(15,23,42,0.45)' },
                right: { color: 'rgba(255,255,255,0.75)' },
              }}
            />
          )}
          isCustomViewBottom
          renderCustomView={(props: any) => {
            const messageId = String(props?.currentMessage?._id ?? '');
            if (!messageId) return null;
            if (messageTypeById.get(messageId) === 'system') return null;

            const list = reactions[messageId] ?? [];
            const isRight = props?.position === 'right';
            return (
              <View
                style={{
                  marginTop: 8,
                  alignItems: isRight ? 'flex-end' : 'flex-start',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  {DEFAULT_VISIBLE_REACTION_EMOJIS.map((emoji) => {
                    const reaction = list.find((item) => item.emoji === emoji);
                    const hasUserReacted = reaction?.hasUserReacted ?? false;
                    const count = reaction?.count ?? 0;
                    const isPending = isReactionPending(messageId, emoji);
                    return (
                      <Pressable
                        key={emoji}
                        disabled={isPending}
                        onPress={() => {
                          void handleToggleReaction(messageId, emoji);
                        }}
                        style={({ pressed }) => ({
                          minHeight: 32,
                          paddingLeft: 10,
                          paddingRight: count > 0 ? 12 : 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: hasUserReacted
                            ? 'rgba(28,131,118,0.22)'
                            : 'rgba(15,23,42,0.10)',
                          backgroundColor: hasUserReacted
                            ? 'rgba(28,131,118,0.16)'
                            : isRight
                              ? 'rgba(255,255,255,0.14)'
                              : 'rgba(255,255,255,0.92)',
                          marginRight: 6,
                          marginBottom: 4,
                          opacity: isPending ? 0.55 : pressed ? 0.92 : 1,
                        })}
                      >
                        <TotlText style={{ fontSize: 16, lineHeight: 20 }}>{emoji}</TotlText>
                        {count > 0 ? (
                          <TotlText
                            style={{
                              marginLeft: 6,
                              fontFamily: 'System',
                              fontSize: 12,
                              lineHeight: 14,
                              color: isRight
                                ? hasUserReacted
                                  ? 'rgba(255,255,255,0.95)'
                                  : 'rgba(255,255,255,0.88)'
                                : 'rgba(15,23,42,0.55)',
                            }}
                          >
                            {formatReactionCount(count)}
                          </TotlText>
                        ) : null}
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={(event) =>
                      openReactionTray(
                        messageId,
                        event.nativeEvent.pageX,
                        event.nativeEvent.pageY
                      )
                    }
                    style={({ pressed }) => ({
                      minHeight: 32,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(15,23,42,0.10)',
                      backgroundColor: isRight
                        ? 'rgba(255,255,255,0.14)'
                        : 'rgba(15,23,42,0.06)',
                      marginBottom: 4,
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <>
                      <Ionicons
                        name="happy-outline"
                        size={16}
                        color={isRight ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.55)'}
                      />
                      <TotlText
                        style={{
                          marginLeft: 6,
                          fontFamily: 'System',
                          fontSize: 12,
                          lineHeight: 14,
                          color: isRight ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.55)',
                        }}
                      >
                        More
                      </TotlText>
                    </>
                  </Pressable>
                </View>
              </View>
            );
          }}
          renderComposer={(props: any) => (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Composer
                {...props}
                composerHeight={50}
                textInputProps={{
                  ...(props.textInputProps ?? {}),
                  placeholderTextColor: t.color.muted,
                  selectionColor: t.color.brand,
                  style: {
                    color: t.color.text,
                    backgroundColor: t.color.surface,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: t.color.border,
                    minHeight: 50,
                    lineHeight: 22,
                    textAlignVertical: 'center',
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 12,
                    marginLeft: 0,
                    marginRight: 0,
                    maxHeight: 120,
                  },
                }}
              />
            </View>
          )}
          renderDay={(props: any) => {
            const label = formatDayLabel(props?.currentMessage?.createdAt);
            if (!label) return null;
            return (
              <View style={{ alignItems: 'center', marginVertical: 8 }}>
                <View
                  style={{
                    backgroundColor: 'rgba(15,23,42,0.12)',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                  }}
                >
                  <TotlText
                    style={{
                      fontSize: 12,
                      lineHeight: 14,
                      fontFamily: t.font.medium,
                      color: 'rgba(15,23,42,0.70)',
                    }}
                  >
                    {label}
                  </TotlText>
                </View>
              </View>
            );
          }}
          listProps={{
            style: { backgroundColor: t.color.background },
            contentContainerStyle: { paddingBottom: 0 },
          }}
          keyboardAvoidingViewProps={{
            keyboardVerticalOffset,
            behavior: 'padding' as any,
          }}
          keyboardProviderProps={{ preload: false }}
          renderInputToolbar={(props: any) =>
            canPost ? (
              <BroadcastInputToolbar {...props} insetsBottom={insets.bottom} sending={sending} />
            ) : null
          }
          keyboardShouldPersistTaps="handled"
        />
      </View>

      {!canPost ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            paddingBottom: Math.max(14, insets.bottom + 8),
            borderTopWidth: 1,
            borderTopColor: t.color.border,
            backgroundColor: t.color.background,
          }}
        >
          <TotlText variant="muted">
            Only hosts can post here. Subscribers can read broadcast updates.
          </TotlText>
        </View>
      ) : null}

      {isLoading && giftedMessages.length === 0 ? (
        <View style={{ position: 'absolute', top: 12, left: 16 }}>
          <TotlText variant="muted">Loading…</TotlText>
        </View>
      ) : null}

      <Modal
        transparent
        visible={!!trayState}
        animationType="fade"
        onRequestClose={() => setTrayState(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'transparent' }}
          onPress={() => setTrayState(null)}
        >
          {trayState ? (
            <View
              style={{
                position: 'absolute',
                top: trayState.y,
                left: trayState.x,
                width: REACTION_TRAY_WIDTH,
                minHeight: REACTION_TRAY_HEIGHT,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 8,
                backgroundColor: 'rgba(33,33,33,0.94)',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                shadowColor: '#000000',
                shadowOpacity: 0.22,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 6 },
                elevation: 12,
              }}
            >
              {EXTRA_REACTION_EMOJIS.map((emoji) => {
                const hasUserReacted =
                  (reactions[trayState.messageId] ?? []).find(
                    (reaction) => reaction.emoji === emoji
                  )?.hasUserReacted ?? false;
                const isPending = isReactionPending(trayState.messageId, emoji);
                return (
                  <Pressable
                    key={emoji}
                    disabled={isPending}
                    onPress={() => {
                      void handleToggleReaction(trayState.messageId, emoji);
                    }}
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: hasUserReacted
                        ? 'rgba(28,131,118,0.26)'
                        : pressed
                          ? 'rgba(255,255,255,0.08)'
                          : 'transparent',
                      opacity: isPending ? 0.55 : 1,
                    })}
                  >
                    <TotlText style={{ fontSize: 24, lineHeight: 26 }}>{emoji}</TotlText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
