import React from 'react';
import { FlatList, Keyboard, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';

import ChatMessageBubble from './ChatMessageBubble';
import ChatComposer from './ChatComposer';
import ChatActionsSheet from './ChatActionsSheet';
import { api } from '../../lib/api';
import { useLeagueChat } from '../../hooks/useLeagueChat';
import type { LeagueChatMessage } from '../../hooks/useLeagueChat';
import { useLeagueChatPresence } from '../../hooks/useLeagueChatPresence';
import { useLeagueChatReadReceipts } from '../../hooks/useLeagueChatReadReceipts';
import { useLeagueChatReactions } from '../../hooks/useLeagueChatReactions';
import { supabase } from '../../lib/supabase';

type ChatActionsTarget = { id: string; content: string; authorName?: string };
type ReportState = 'idle' | 'submitting' | 'error' | 'success';

type ChatListItem =
  | { type: 'message'; message: LeagueChatMessage }
  | { type: 'day'; key: string; label: string };

const NEAR_BOTTOM_PX = 24;
const LOAD_OLDER_TOP_PX = 40;
const READ_RECEIPT_BOTTOM_PX = 14;

/**
 * IMPORTANT:
 * Set this to match your ChatComposer "resting" height (excluding keyboard).
 * If your composer grows (multiline), consider capping its height so this remains stable.
 */
// const COMPOSER_HEIGHT = 56; // <-- keep if you reintroduce measured clearance

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
  const insets = useSafeAreaInsets();
  const chatBg = t.color.background;

  const listRef = React.useRef<FlatList<any> | null>(null);
  const atBottomRef = React.useRef(true);

  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [replyTo, setReplyTo] = React.useState<ChatActionsTarget | null>(null);
  const [actionsFor, setActionsFor] = React.useState<ChatActionsTarget | null>(null);
  const [composerHeight, setComposerHeight] = React.useState(0);
  const [reportReason, setReportReason] = React.useState('');
  const [reportState, setReportState] = React.useState<ReportState>('idle');
  const [reportError, setReportError] = React.useState<string | null>(null);
  const openActionsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevMessageCountRef = React.useRef(0);
  const lastReadMarkedAtRef = React.useRef<string | null>(null);
  const userInteractedRef = React.useRef(false);

  const bottomInset = Math.max(8, insets.bottom);
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const composerBottomInset = keyboardVisible ? 0 : bottomInset;
  const measuredComposerHeight = composerHeight > 0 ? Math.min(composerHeight, 180) : 0;
  const composerClearance = Math.max(measuredComposerHeight, 52 + composerBottomInset);

  const scrollToBottomAfterLayout = React.useCallback((animated = true) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated });
      });
    });
  }, []);

  const closeActions = React.useCallback(() => {
    if (openActionsTimeoutRef.current) {
      clearTimeout(openActionsTimeoutRef.current);
      openActionsTimeoutRef.current = null;
    }
    setActionsFor(null);
    setReportReason('');
    setReportState('idle');
    setReportError(null);
  }, []);

  React.useEffect(() => {
    return () => {
      if (openActionsTimeoutRef.current) {
        clearTimeout(openActionsTimeoutRef.current);
      }
    };
  }, []);

  const openActionsSheet = React.useCallback((target: ChatActionsTarget) => {
    Keyboard.dismiss();
    if (openActionsTimeoutRef.current) {
      clearTimeout(openActionsTimeoutRef.current);
    }
    openActionsTimeoutRef.current = setTimeout(() => {
      setActionsFor(target);
      openActionsTimeoutRef.current = null;
    }, 180);
  }, []);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user ?? null;
    },
  });

  const meId: string | null = me?.id ?? null;

  const nameById = React.useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const avatarById = React.useMemo(() => new Map(members.map((m) => [m.id, m.avatar_url ?? null])), [members]);
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

  const messages = Array.isArray(messagesRaw) ? messagesRaw : [];
  const sortedMessages = React.useMemo(
    () =>
      [...messages].sort((a, b) => {
        const at = new Date(a.created_at).getTime();
        const bt = new Date(b.created_at).getTime();
        if (at === bt) return a.id.localeCompare(b.id);
        return at - bt;
      }),
    [messages]
  );

  useLeagueChatPresence({ leagueId, userId: meId, enabled: true });
  const { markAsRead } = useLeagueChatReadReceipts({ leagueId, userId: meId, enabled: true });

  React.useEffect(() => {
    if (!meId) return;
    markAsRead();
  }, [markAsRead, meId]);

  React.useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const nextCount = sortedMessages.length;

    // Do not animate/adjust scroll on the initial data fill.
    // We rely on initialScrollIndex to open at bottom with no visible movement.
    if (prevCount === 0) {
      prevMessageCountRef.current = nextCount;
      return;
    }

    prevMessageCountRef.current = nextCount;
    if (nextCount <= prevCount) return;

    if (atBottomRef.current) scrollToBottomAfterLayout(false);
  }, [scrollToBottomAfterLayout, sortedMessages.length]);

  React.useEffect(() => {
    // When keyboard opens and user is already at bottom, keep latest message pinned.
    if (!keyboardVisible) return;
    if (!atBottomRef.current) return;
    scrollToBottomAfterLayout(false);
  }, [keyboardVisible, scrollToBottomAfterLayout]);

  React.useEffect(() => {
    // Keep last bubble attached to composer when its height changes
    // (e.g. first mount, reply preview appears, keyboard transitions).
    if (!atBottomRef.current) return;
    scrollToBottomAfterLayout(false);
  }, [composerClearance, scrollToBottomAfterLayout]);

  const messageIds = React.useMemo(
    () => sortedMessages.map((m) => m.id).filter((id) => !id.startsWith('optimistic-')),
    [sortedMessages]
  );
  const { reactions, toggleReaction } = useLeagueChatReactions({
    leagueId,
    userId: meId,
    enabled: true,
    messageIds,
  });

  React.useEffect(() => {
    if (sortedMessages.length) {
      const newest = sortedMessages[sortedMessages.length - 1]?.created_at ?? null;
      markAsRead({ lastReadAtOverride: newest });
      lastReadMarkedAtRef.current = newest;
    }
  }, [markAsRead, sortedMessages]);

  const onSend = async () => {
    if (!meId) return;
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setSending(true);
    try {
      await sendMessage({ userId: meId, senderName: meName, content: text, replyToMessageId: replyTo?.id ?? null });
      setReplyTo(null);
      const newest = sortedMessages[sortedMessages.length - 1]?.created_at ?? null;
      markAsRead({ lastReadAtOverride: newest });
      lastReadMarkedAtRef.current = newest;
      scrollToBottomAfterLayout(false);
    } finally {
      setSending(false);
    }
  };

  const handleSubmitReport = React.useCallback(async () => {
    if (!actionsFor) return;
    const reason = reportReason.trim();
    if (!reason) {
      setReportError('Please tell us why you are reporting this comment.');
      setReportState('error');
      return;
    }

    setReportError(null);
    setReportState('submitting');
    try {
      await api.submitChatMessageReport({ messageId: actionsFor.id, reason });
      setReportState('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit your report right now. Please try again.';
      setReportError(message);
      setReportState('error');
    }
  }, [actionsFor, reportReason]);

  const listItems: ChatListItem[] = React.useMemo(() => {
    // Chronological (oldest -> newest) so we can use a normal (non-inverted) list.
    // This avoids spacer hacks and keeps the composer + content truly grouped in one layout.
    const items: ChatListItem[] = [];
    let lastDayKey: string | null = null;

    for (const m of sortedMessages) {
      const currKey = dayKeyFromIso(m.created_at);
      if (currKey !== lastDayKey) {
        const label = labelForDayKey(currKey);
        items.push({ type: 'day', key: `day-${currKey}`, label });
        lastDayKey = currKey;
      }
      items.push({ type: 'message', message: m });
    }

    return items;
  }, [sortedMessages]);

  return (
    <View style={{ flex: 1, backgroundColor: chatBg }}>
      {error ? (
        <Card style={{ margin: t.space[4] }}>
          <TotlText variant="heading" style={{ marginBottom: 6 }}>
            Couldn’t load chat
          </TotlText>
          <TotlText variant="muted">{error}</TotlText>
        </Card>
      ) : null}

      <View style={{ flex: 1 }}>
        <FlatList
          ref={(n) => {
            listRef.current = n;
          }}
          data={listItems}
          keyExtractor={(it) => (it.type === 'message' ? it.message.id : it.key)}
          style={{ flex: 1, backgroundColor: chatBg }}
          initialScrollIndex={Math.max(0, listItems.length - 1)}
          onScrollToIndexFailed={() => {
            // Fallback for variable-height rows when FlatList cannot estimate index offset yet.
            requestAnimationFrame(() => {
              listRef.current?.scrollToEnd({ animated: false });
            });
          }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingHorizontal: 0,
            // Reserve exactly enough space for the sticky composer so messages
            // remain visually attached above it and never behind keyboard/input.
            paddingBottom: composerClearance + 4,
            paddingTop: 0,
          }}
          scrollIndicatorInsets={{ bottom: composerClearance }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            userInteractedRef.current = true;
          }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const y = contentOffset.y;
            const distanceFromBottom = Math.max(0, contentSize.height - (y + layoutMeasurement.height));

            const nearBottom = distanceFromBottom <= NEAR_BOTTOM_PX;
            atBottomRef.current = nearBottom;

            if (nearBottom && distanceFromBottom <= READ_RECEIPT_BOTTOM_PX) {
              const newest = sortedMessages[sortedMessages.length - 1]?.created_at ?? null;
              if (newest && newest !== lastReadMarkedAtRef.current) {
                markAsRead({ lastReadAtOverride: newest });
                lastReadMarkedAtRef.current = newest;
              }
            }

            // Fetch older when user scrolls near the very top.
            if (y <= LOAD_OLDER_TOP_PX && hasOlder && !isFetchingOlder) {
              void fetchOlder();
            }
          }}
          scrollEventThrottle={16}
          // We now load older when near the top (see onScroll).
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 8 }}>
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

            const prev = prevMessage(listItems, index);
            const next = nextMessage(listItems, index);
            const sameAsPrev = !!prev && prev.user_id === msg.user_id;
            const sameAsNext = !!next && next.user_id === msg.user_id;
            const speakerChanged = !!prev && prev.user_id !== msg.user_id;

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
                onLongPress={() => openActionsSheet({ id: msg.id, content: msg.content, authorName })}
              />
            );
          }}
        />

        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
          <View
            style={{ borderTopWidth: 1, borderTopColor: t.color.border, backgroundColor: chatBg }}
            onLayout={(e) => {
              const h = Math.round(e.nativeEvent.layout.height);
              if (h > 0 && h !== composerHeight) setComposerHeight(h);
            }}
          >
            <ChatComposer
              value={draft}
              onChange={setDraft}
              onSend={onSend}
              sending={sending}
              bottomInset={composerBottomInset}
              onInputFocus={() => {
                atBottomRef.current = true;
                scrollToBottomAfterLayout(false);
              }}
              replyPreview={replyTo ? { content: replyTo.content, authorName: replyTo.authorName } : null}
              onCancelReply={() => setReplyTo(null)}
            />
          </View>
        </KeyboardStickyView>
      </View>

      <ChatActionsSheet
        open={!!actionsFor}
        onClose={closeActions}
        onReply={() => {
          if (!actionsFor) return;
          setReplyTo(actionsFor);
          closeActions();
        }}
        onReact={(emoji) => {
          if (!actionsFor) return;
          void toggleReaction(actionsFor.id, emoji);
          closeActions();
        }}
        reportReason={reportReason}
        reportState={reportState}
        reportError={reportError}
        onChangeReportReason={(value) => {
          setReportReason(value);
          if (reportError) setReportError(null);
          if (reportState !== 'idle') setReportState('idle');
        }}
        onSubmitReport={() => void handleSubmitReport()}
      />
    </View>
  );
}
