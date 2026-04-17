import React from 'react';
import { FlatList, Keyboard, View } from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, TotlText, useTokens } from '@totl/ui';

import ChatComposer from '../chat/ChatComposer';
import ChatMessageBubble from '../chat/ChatMessageBubble';
import { useBrandedLeaderboardBroadcastReadReceipts } from '../../hooks/useBrandedLeaderboardBroadcastReadReceipts';
import type { BrandedLeaderboardBroadcastUiMessage } from '../../lib/brandedLeaderboardBroadcastUnread';
import type { LeagueChatMessage } from '../../hooks/useLeagueChat';
import { VOLLEY_NAME, VOLLEY_USER_ID } from '../../lib/volley';

type BroadcastListItem =
  | { type: 'message'; message: BrandedLeaderboardBroadcastUiMessage }
  | { type: 'day'; key: string; label: string };

const NEAR_BOTTOM_PX = 24;
const READ_RECEIPT_BOTTOM_PX = 14;

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

  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function prevMessage(items: BroadcastListItem[], index: number) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item?.type === 'message') return item.message;
  }
  return null;
}

function nextMessage(items: BroadcastListItem[], index: number) {
  for (let i = index + 1; i < items.length; i += 1) {
    const item = items[i];
    if (item?.type === 'message') return item.message;
  }
  return null;
}

function toBubbleMessage(message: BrandedLeaderboardBroadcastUiMessage): LeagueChatMessage {
  return {
    id: message.id,
    league_id: message.leaderboard_id,
    user_id: message.user_id,
    content: message.content,
    created_at: message.created_at,
    reply_to_message_id: null,
    reply_to: null,
    status: message.status,
  };
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
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const composerBottomInset = keyboardVisible ? 0 : Math.max(8, insets.bottom);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [composerHeight, setComposerHeight] = React.useState(0);
  const lastReadMarkedAtRef = React.useRef<string | null>(null);
  const atBottomRef = React.useRef(true);
  const listRef = React.useRef<FlatList<BroadcastListItem> | null>(null);
  const composerClearance = canPost ? Math.max(composerHeight, 52 + composerBottomInset) : Math.max(24, insets.bottom + 16);
  const { markAsRead } = useBrandedLeaderboardBroadcastReadReceipts({
    leaderboardId,
    userId: currentUserId,
    enabled: visible,
  });

  const scrollToBottomAfterLayout = React.useCallback((animated = true) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated });
      });
    });
  }, []);

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
    if (!visible || !atBottomRef.current) return;
    scrollToBottomAfterLayout(false);
  }, [composerClearance, scrollToBottomAfterLayout, visible]);

  const listItems: BroadcastListItem[] = React.useMemo(() => {
    const items: BroadcastListItem[] = [];
    let lastDayKey: string | null = null;
    for (const message of messages) {
      const currentDayKey = dayKeyFromIso(message.created_at);
      if (currentDayKey !== lastDayKey) {
        items.push({ type: 'day', key: `day-${currentDayKey}`, label: labelForDayKey(currentDayKey) });
        lastDayKey = currentDayKey;
      }
      items.push({ type: 'message', message });
    }
    return items;
  }, [messages]);

  const handleSend = React.useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setSending(true);
    try {
      await onSend(text);
      scrollToBottomAfterLayout(false);
    } finally {
      setSending(false);
    }
  }, [draft, onSend, scrollToBottomAfterLayout]);

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
        <FlatList
          ref={(node) => {
            listRef.current = node;
          }}
          data={listItems}
          keyExtractor={(item) => (item.type === 'message' ? item.message.id : item.key)}
          style={{ flex: 1, backgroundColor: t.color.background }}
          onScrollToIndexFailed={() => {
            requestAnimationFrame(() => {
              listRef.current?.scrollToEnd({ animated: false });
            });
          }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingBottom: composerClearance + 4,
          }}
          scrollIndicatorInsets={{ bottom: composerClearance }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const distanceFromBottom = Math.max(0, contentSize.height - (contentOffset.y + layoutMeasurement.height));
            const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;
            atBottomRef.current = nearBottom;

            if (visible && nearBottom && distanceFromBottom <= READ_RECEIPT_BOTTOM_PX) {
              const newest = messages[messages.length - 1]?.created_at ?? null;
              if (newest && newest !== lastReadMarkedAtRef.current) {
                setLastReadAt(newest);
                void markAsRead({ lastReadAtOverride: newest });
                lastReadMarkedAtRef.current = newest;
              }
            }
          }}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 8, paddingTop: 12 }}>
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

            const message = item.message;
            const bubbleMessage = toBubbleMessage(message);
            const isVolley = message.user_id === VOLLEY_USER_ID || message.message_type === 'system';
            const isMe = !!currentUserId && message.user_id === currentUserId && !isVolley;
            const authorName = isMe ? 'You' : isVolley ? VOLLEY_NAME : message.user_name ?? 'Host';
            const avatarUri = !isMe && !isVolley ? message.user_avatar_url ?? null : null;

            const previous = prevMessage(listItems, index);
            const next = nextMessage(listItems, index);
            const previousSender = previous?.message_type === 'system' ? VOLLEY_USER_ID : previous?.user_id ?? null;
            const currentSender = isVolley ? VOLLEY_USER_ID : message.user_id;
            const nextSender = next?.message_type === 'system' ? VOLLEY_USER_ID : next?.user_id ?? null;
            const sameAsPrev = previousSender === currentSender;
            const sameAsNext = nextSender === currentSender;
            const speakerChanged = !!previous && previousSender !== currentSender;

            return (
              <ChatMessageBubble
                message={bubbleMessage}
                isMe={isMe}
                authorName={authorName}
                avatarLabel={authorName}
                avatarUri={isVolley ? null : avatarUri}
                showAvatar={!isMe && !sameAsPrev}
                showAuthorName={!isMe && !sameAsNext}
                topSpacing={sameAsPrev ? 2 : speakerChanged ? 14 : 10}
              />
            );
          }}
        />

        {canPost ? (
          <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
            <View
              style={{ borderTopWidth: 1, borderTopColor: t.color.border, backgroundColor: t.color.background }}
              onLayout={(e) => {
                const height = Math.round(e.nativeEvent.layout.height);
                if (height > 0 && height !== composerHeight) setComposerHeight(height);
              }}
            >
              <ChatComposer
                value={draft}
                onChange={setDraft}
                onSend={handleSend}
                sending={sending}
                bottomInset={composerBottomInset}
                onInputFocus={() => {
                  atBottomRef.current = true;
                  scrollToBottomAfterLayout(false);
                }}
                onInputBlur={() => Keyboard.dismiss()}
                replyPreview={null}
                onCancelReply={() => {}}
              />
            </View>
          </KeyboardStickyView>
        ) : (
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
            <TotlText variant="muted">Only hosts can post here. Subscribers can read broadcast updates.</TotlText>
          </View>
        )}
      </View>
    </View>
  );
}
