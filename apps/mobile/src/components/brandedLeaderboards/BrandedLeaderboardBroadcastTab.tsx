import React from 'react';
import { FlatList, Keyboard, Modal, Platform, Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, TotlText, useTokens } from '@totl/ui';
import { useBrandedLeaderboardBroadcastReadReceipts } from '../../hooks/useBrandedLeaderboardBroadcastReadReceipts';
import { useBrandedLeaderboardBroadcastReactions } from '../../hooks/useBrandedLeaderboardBroadcastReactions';
import type { BrandedLeaderboardBroadcastUiMessage } from '../../lib/brandedLeaderboardBroadcastUnread';
import { VOLLEY_NAME, VOLLEY_USER_ID } from '../../lib/volley';

const DEFAULT_VISIBLE_REACTION_EMOJIS = ['👍', '🔥', '😬'] as const;
const EXTRA_REACTION_EMOJIS = ['👎', '🙌', '😮'] as const;
const REACTION_TRAY_WIDTH = 184;
const REACTION_TRAY_HEIGHT = 64;

function BroadcastComposer({
  draft,
  onChangeDraft,
  onSubmit,
  insetsBottom,
  keyboardVisible,
  sending,
}: {
  draft: string;
  onChangeDraft: (value: string) => void;
  onSubmit: () => void;
  insetsBottom: number;
  keyboardVisible: boolean;
  sending: boolean;
}) {
  const t = useTokens();
  const trimmed = draft.trim();

  return (
    <View
      style={{
        borderTopWidth: 0,
        backgroundColor: t.color.background,
        paddingTop: 8,
        paddingBottom: keyboardVisible ? 12 : Math.max(16, insetsBottom),
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
          value={draft}
          onChangeText={onChangeDraft}
          placeholder="Message..."
          placeholderTextColor={t.color.muted}
          selectionColor={t.color.brand}
          multiline
          editable={!sending}
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
            onPress={onSubmit}
            disabled={sending}
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
              opacity: sending ? 0.55 : pressed ? 0.9 : 1,
            })}
          >
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
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

function shouldShowIncomingUsername(
  current: BrandedLeaderboardBroadcastUiMessage,
  previous: BrandedLeaderboardBroadcastUiMessage | null
) {
  if (!previous) return true;
  if (previous.user_id !== current.user_id) return true;
  return !isSameDaySafe(current.created_at, previous.created_at);
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
  const [draft, setDraft] = React.useState('');
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
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
  const { reactions, toggleReaction, isReactionPending } = useBrandedLeaderboardBroadcastReactions({
    leaderboardId,
    messages,
    userId: currentUserId,
    enabled: visible,
  });
  const listRef = React.useRef<FlatList<any> | null>(null);

  const sortedMessages = React.useMemo(() => {
    return [...messages].sort((a, b) => {
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      if (at === bt) return a.id.localeCompare(b.id);
      return at - bt;
    });
  }, [messages]);
  const keyboardInset = Math.max(0, keyboardHeight - keyboardVerticalOffset);
  const keyboardVisible = keyboardInset > 0;

  React.useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const frameEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';

    const handleShow = (event: any) => {
      const nextHeight = Number(event?.endCoordinates?.height ?? 0);
      setKeyboardHeight(Number.isFinite(nextHeight) ? nextHeight : 0);
    };
    const handleHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent as any, handleShow);
    const frameSub = Keyboard.addListener(frameEvent as any, handleShow);
    const hideSub = Keyboard.addListener(hideEvent as any, handleHide);

    return () => {
      showSub.remove();
      frameSub.remove();
      hideSub.remove();
    };
  }, []);

  const timelineItems = React.useMemo(() => {
    const items: Array<
      | { key: string; type: 'day'; label: string }
      | {
          key: string;
          type: 'message';
          message: BrandedLeaderboardBroadcastUiMessage;
          isMe: boolean;
          isRight: boolean;
          authorName: string;
          showUsername: boolean;
        }
    > = [];

    sortedMessages.forEach((message, index) => {
      const previous = index > 0 ? sortedMessages[index - 1] ?? null : null;
      if (!previous || !isSameDaySafe(previous.created_at, message.created_at)) {
        const label = formatDayLabel(message.created_at);
        if (label) items.push({ key: `day:${message.id}`, type: 'day', label });
      }

      const isMe =
        !!currentUserId && message.user_id === currentUserId && message.user_id !== VOLLEY_USER_ID;
      const isVolley =
        message.user_id === VOLLEY_USER_ID || message.message_type === 'system';
      const authorName = isMe ? 'You' : isVolley ? VOLLEY_NAME : message.user_name ?? 'Host';

      items.push({
        key: `msg:${message.id}`,
        type: 'message',
        message,
        isMe,
        isRight: isMe,
        authorName,
        showUsername: !isMe && shouldShowIncomingUsername(message, previous),
      });
    });

    return items;
  }, [currentUserId, sortedMessages]);

  React.useEffect(() => {
    if (!visible) return;
    if (!messages.length) return;
    const newest = messages[messages.length - 1]?.created_at ?? null;
    if (!newest || newest === lastReadMarkedAtRef.current) return;
    setLastReadAt(newest);
    void markAsRead({ lastReadAtOverride: newest });
    lastReadMarkedAtRef.current = newest;
  }, [markAsRead, messages, setLastReadAt, visible]);

  React.useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, [keyboardInset, timelineItems.length]);

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
    async () => {
      const text = draft.trim();
      if (!text) return;
      setSending(true);
      try {
        await onSend(text);
        setDraft('');
        const newest = new Date().toISOString();
        setLastReadAt(newest);
      } finally {
        setSending(false);
      }
    },
    [draft, onSend, setLastReadAt]
  );

  const renderTimelineItem = React.useCallback(
    ({
      item,
    }: {
      item:
        | { key: string; type: 'day'; label: string }
        | {
            key: string;
            type: 'message';
            message: BrandedLeaderboardBroadcastUiMessage;
            isMe: boolean;
            isRight: boolean;
            authorName: string;
            showUsername: boolean;
          };
    }) => {
      if (item.type === 'day') {
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
                {item.label}
              </TotlText>
            </View>
          </View>
        );
      }

      const { message, isRight, authorName, showUsername } = item;
      const messageId = String(message.id);
      const list = reactions[messageId] ?? [];
      const bubbleAlign = isRight ? 'flex-end' : 'flex-start';

      return (
        <View style={{ alignItems: bubbleAlign, marginBottom: 10 }}>
          <View
            style={{
              maxWidth: '84%',
              backgroundColor: isRight ? t.color.brand : t.color.surface,
              borderWidth: 0,
              borderRadius: 18,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 10,
            }}
          >
            {showUsername ? (
              <TotlText
                style={{
                  marginBottom: 4,
                  fontSize: 13,
                  lineHeight: 16,
                  fontFamily: t.font.medium,
                  color: 'rgba(15,23,42,0.45)',
                }}
              >
                {authorName}
              </TotlText>
            ) : null}

            <TotlText
              style={{
                fontFamily: 'System',
                fontSize: 16,
                lineHeight: 20,
                color: isRight ? '#FFFFFF' : t.color.text,
              }}
            >
              {String(message.content ?? '')}
            </TotlText>

            <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
              <TotlText
                style={{
                  color: isRight ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.45)',
                  fontSize: 12,
                  lineHeight: 14,
                }}
              >
                {new Date(message.created_at).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </TotlText>
            </View>

            {message.message_type !== 'system' ? (
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
                    const reaction = list.find((entry) => entry.emoji === emoji);
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
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [handleToggleReaction, isReactionPending, openReactionTray, reactions, t]
  );

  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: t.color.background,
        paddingBottom: keyboardInset,
      }}
    >
      {error ? (
        <Card style={{ marginHorizontal: t.space[4], marginTop: t.space[4] }}>
          <TotlText variant="heading" style={{ marginBottom: 6 }}>
            Couldn’t load broadcast
          </TotlText>
          <TotlText variant="muted">{error}</TotlText>
        </Card>
      ) : null}

      <View style={{ flex: 1, minHeight: 0 }}>
        <FlatList
          ref={listRef}
          data={timelineItems}
          keyExtractor={(item) => item.key}
          renderItem={renderTimelineItem}
          style={{ flex: 1, backgroundColor: t.color.background }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: canPost ? 12 : 0,
          }}
          scrollIndicatorInsets={{ bottom: canPost ? 12 : 0 }}
          onContentSizeChange={() => {
            requestAnimationFrame(() => {
              listRef.current?.scrollToEnd({ animated: false });
            });
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        />
      </View>

      {canPost ? (
        <BroadcastComposer
          draft={draft}
          onChangeDraft={setDraft}
          onSubmit={() => void handleSend()}
          insetsBottom={insets.bottom}
          keyboardVisible={keyboardVisible}
          sending={sending}
        />
      ) : null}

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

      {isLoading && timelineItems.length === 0 ? (
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
