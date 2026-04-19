import React from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Bubble, Composer, GiftedChat, InputToolbar, Send, type IMessage } from 'react-native-gifted-chat';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';

import { Card, TotlText, useTokens } from '@totl/ui';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { VOLLEY_AVATAR_SOURCE, VOLLEY_NAME, VOLLEY_USER_ID } from '../../lib/volley';

import ChatActionsSheet from './ChatActionsSheet';
import { useLeagueChat } from '../../hooks/useLeagueChat';
import { useLeagueChatPresence } from '../../hooks/useLeagueChatPresence';
import { useLeagueChatReadReceipts } from '../../hooks/useLeagueChatReadReceipts';
import { useLeagueChatReactions } from '../../hooks/useLeagueChatReactions';
import type { LeagueChatMessage } from '../../hooks/useLeagueChat';

type ChatActionsTarget = { id: string; content: string; authorName?: string; userId?: string | null };
type ReportState = 'idle' | 'submitting' | 'error' | 'success';

function toGiftedMessage(
  m: LeagueChatMessage,
  nameById: Map<string, string>,
  avatarById: Map<string, string | number | null>,
  meId: string | null
): IMessage {
  const isMe = !!meId && m.user_id === meId;
  const isVolley = m.user_id === VOLLEY_USER_ID;
  const authorName = isMe ? 'You' : isVolley ? VOLLEY_NAME : (nameById.get(m.user_id) ?? 'Unknown');
  const avatar = isVolley ? VOLLEY_AVATAR_SOURCE : (avatarById.get(m.user_id) ?? null);

  return {
    _id: m.id,
    text: m.content ?? '',
    createdAt: new Date(m.created_at),
    user: {
      _id: m.user_id,
      name: authorName,
      ...(avatar ? { avatar } : {}),
    },
    ...(m.reply_to
      ? {
          replyMessage: {
            _id: m.reply_to.id,
            text: m.reply_to.content,
            user: {
              _id: m.reply_to.user_id,
              name:
                m.reply_to.user_id === VOLLEY_USER_ID
                  ? VOLLEY_NAME
                  : m.reply_to.user_id === meId
                    ? 'You'
                    : nameById.get(m.reply_to.user_id) ?? 'Unknown',
            },
          },
        }
      : {}),
    reply_to_message_id: m.reply_to_message_id ?? null,
    status: m.status,
  };
}

function InputToolbarWithAnimatedInset({
  insetsBottom,
  replyTarget,
  onClearReply,
  ...props
}: any & {
  insetsBottom: number;
  replyTarget: { id: string; content: string; authorName?: string } | null;
  onClearReply: () => void;
}) {
  const t = useTokens();
  // This runs inside GiftedChat's KeyboardProvider, so we get real progress values.
  const { progress } = useReanimatedKeyboardAnimation();

  const wrapperStyle = useAnimatedStyle(() => {
    const p = progress.value; // 0..1
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
        {replyTarget ? (
          <View
            style={{
              marginBottom: 8,
              borderWidth: 1,
              borderColor: 'rgba(15,23,42,0.10)',
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 13, lineHeight: 14, color: 'rgba(15,23,42,0.75)' }}>
                  Replying{replyTarget.authorName ? ` to ${replyTarget.authorName}` : ''}
                </TotlText>
              </View>
              <Pressable onPress={onClearReply} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                <TotlText style={{ fontFamily: 'Gramatika-Medium', color: 'rgba(15,23,42,0.55)' }}>✕</TotlText>
              </Pressable>
            </View>
            <TotlText
              numberOfLines={2}
              style={{ marginTop: 4, fontFamily: 'Gramatika-Regular', fontSize: 12, lineHeight: 16, color: 'rgba(15,23,42,0.55)' }}
            >
              {replyTarget.content}
            </TotlText>
          </View>
        ) : null}
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
  const isDark = t.color.background.toLowerCase() !== '#f8fafc';
  const chatBg = t.color.background;
  const incomingBubbleBg = t.color.surface;
  const outgoingBubbleBg = isDark ? '#0B7A6D' : t.color.brand;
  const incomingMeta = isDark ? 'rgba(248,250,252,0.58)' : 'rgba(15,23,42,0.45)';
  const outgoingMeta = 'rgba(255,255,255,0.75)';
  const composerBg = t.color.surface;
  const composerBorder = t.color.border;
  const composerTextColor = isDark ? '#F8FAFC' : t.color.text;
  const dayChipBg = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)';
  const dayChipText = isDark ? '#F8FAFC' : 'rgba(15,23,42,0.70)';
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

  const rawMessageById = React.useMemo(() => {
    return new Map((messagesRaw ?? []).map((message) => [String(message.id), message]));
  }, [messagesRaw]);

  const messageIds = React.useMemo(() => {
    // Keep reaction hook warm, even if UI isn't rendered yet.
    const ids = messages
      .map((m) => String(m._id))
      .filter((id) => id && !id.startsWith('optimistic-'));
    return Array.from(new Set(ids)).sort();
  }, [messages]);
  const { reactions, toggleReaction } = useLeagueChatReactions({
    leagueId,
    userId: meId,
    enabled: true,
    messageIds,
  });

  const [actionsFor, setActionsFor] = React.useState<ChatActionsTarget | null>(null);
  const [replyTo, setReplyTo] = React.useState<ChatActionsTarget | null>(null);
  const [reportReason, setReportReason] = React.useState('');
  const [reportState, setReportState] = React.useState<ReportState>('idle');
  const [reportError, setReportError] = React.useState<string | null>(null);
  const openActionsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
        replyToMessageId: replyTo?.id ?? null,
        replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, user_id: replyTo.userId ?? null } : null,
      });

      markAsRead();
      setReplyTo(null);
    },
    [markAsRead, meId, meName, replyTo?.id, sendMessage]
  );

  const handleLongPress = React.useCallback(
    (_: unknown, msg: IMessage) => {
      const id = String(msg?._id ?? '');
      if (!id) return;
      Keyboard.dismiss();
      if (openActionsTimeoutRef.current) {
        clearTimeout(openActionsTimeoutRef.current);
      }
      openActionsTimeoutRef.current = setTimeout(() => {
        setActionsFor({
          id,
          content: String(msg?.text ?? ''),
          authorName: typeof msg?.user?.name === 'string' ? msg.user.name : undefined,
          userId: msg?.user?._id != null ? String(msg.user._id) : null,
        });
        openActionsTimeoutRef.current = null;
      }, 180);
    },
    []
  );

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
          textInputProps={{
            placeholder: 'Message…',
            placeholderTextColor: t.color.muted,
            selectionColor: t.color.brand,
          }}
          // Ensure areas revealed during keyboard animation are painted (avoid gray underlay).
          messagesContainerStyle={{ backgroundColor: chatBg }}
          renderBubble={(props: any) => (
            (() => {
              const current = props?.currentMessage;
              const replyId = current?.reply_to_message_id ? String(current.reply_to_message_id) : null;
              const fallbackReply = replyId ? rawMessageById.get(replyId) : null;
              const resolvedReplyMessage =
                current?.replyMessage ??
                (fallbackReply
                  ? {
                      _id: fallbackReply.id,
                      text: fallbackReply.content,
                      user: {
                        _id: fallbackReply.user_id,
                        name:
                          fallbackReply.user_id === VOLLEY_USER_ID
                            ? VOLLEY_NAME
                            : fallbackReply.user_id === meId
                              ? 'You'
                              : nameById.get(fallbackReply.user_id) ?? 'Unknown',
                      },
                    }
                  : undefined);

              return (
                <Bubble
                  {...props}
                  currentMessage={
                    resolvedReplyMessage ? { ...current, replyMessage: resolvedReplyMessage } : current
                  }
                  isUsernameVisible={shouldShowIncomingUsername(props)}
                  renderUsername={() => null}
                  wrapperStyle={{
                    left: {
                      backgroundColor: incomingBubbleBg,
                      borderWidth: isDark ? 1 : 0,
                      borderColor: composerBorder,
                      paddingHorizontal: 16,
                      paddingTop: 12,
                      paddingBottom: 10,
                    },
                    right: {
                      backgroundColor: outgoingBubbleBg,
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
                    const showUsername = messageProps?.position === 'left' && shouldShowIncomingUsername(messageProps);
                    return (
                      <View>
                        {showUsername && user ? (
                          <TotlText
                            style={{
                              marginBottom: 4,
                              fontSize: 13,
                              lineHeight: 16,
                              fontFamily: t.font.medium,
                              color: incomingMeta,
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
                            color: messageProps?.position === 'right' ? '#FFFFFF' : t.color.text,
                          }}
                        >
                          {String(messageProps?.currentMessage?.text ?? '')}
                        </TotlText>
                      </View>
                    );
                  }}
                  timeTextStyle={{
                    left: { color: incomingMeta },
                    right: { color: outgoingMeta },
                  }}
                  usernameTextStyle={{
                    color: incomingMeta,
                  }}
                  messageReply={{
                    renderMessageReply: ({ replyMessage, position }: any) => (
                      <View
                        style={{
                          alignSelf: 'stretch',
                          borderLeftWidth: 3,
                          borderLeftColor: position === 'right' ? 'rgba(255,255,255,0.6)' : t.color.brand,
                          paddingRight: 14,
                          paddingLeft: 14,
                          paddingTop: 10,
                          paddingBottom: 10,
                          marginTop: 4,
                          marginRight: 4,
                          marginBottom: 8,
                          marginLeft: 4,
                          borderRadius: 8,
                          backgroundColor: position === 'right' ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.04)',
                        }}
                      >
                        <TotlText
                          numberOfLines={1}
                          style={{
                            fontFamily: 'System',
                            fontSize: 12,
                            lineHeight: 14,
                            color: position === 'right' ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.70)',
                          }}
                        >
                          {replyMessage?.user?.name || 'User'}
                        </TotlText>
                        <TotlText
                          numberOfLines={3}
                          style={{
                            marginTop: 4,
                            fontFamily: 'System',
                            fontSize: 12,
                            lineHeight: 16,
                            color: position === 'right' ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.60)',
                          }}
                        >
                          {replyMessage?.text || 'Message'}
                        </TotlText>
                      </View>
                    ),
                  }}
                />
              );
            })()
          )}
          isCustomViewBottom
          renderCustomView={(props: any) => {
            const currentId = String(props?.currentMessage?._id ?? '');
            const list = currentId ? reactions[currentId] ?? [] : [];
            if (list.length === 0) return null;

            return (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 6,
                  justifyContent: props?.position === 'right' ? 'flex-end' : 'flex-start',
                }}
              >
                {list.map((reaction) => (
                  <Pressable
                    key={reaction.emoji}
                    onPress={() => void toggleReaction(currentId, reaction.emoji)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      minHeight: 28,
                      paddingVertical: 4,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: 'rgba(15,23,42,0.10)',
                      backgroundColor: reaction.hasUserReacted ? 'rgba(28,131,118,0.12)' : 'rgba(255,255,255,0.85)',
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <TotlText
                      style={{
                        fontSize: 16,
                        lineHeight: 20,
                      }}
                    >
                      {reaction.emoji}
                    </TotlText>
                    <TotlText style={{ marginLeft: 6, fontFamily: 'System', fontSize: 12, lineHeight: 14, color: 'rgba(15,23,42,0.55)' }}>
                      {reaction.count}
                    </TotlText>
                  </Pressable>
                ))}
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
                    color: composerTextColor,
                    backgroundColor: composerBg,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: composerBorder,
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
          renderSend={(props: any) => {
            if (!props.text?.trim()) return <View />;
            return (
            <Send {...props} containerStyle={{ justifyContent: 'center', marginLeft: 8, marginRight: 0, marginBottom: 4 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: t.color.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
              </View>
            </Send>
            );
          }}
          renderDay={(props: any) => {
            const label = formatDayLabel(props?.currentMessage?.createdAt);
            if (!label) return null;
            return (
              <View style={{ alignItems: 'center', marginVertical: 8 }}>
                <View
                  style={{
                    backgroundColor: dayChipBg,
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
                      color: dayChipText,
                    }}
                  >
                    {label}
                  </TotlText>
                </View>
              </View>
            );
          }}
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
            contentContainerStyle: { paddingBottom: 0 },
          }}
          renderInputToolbar={(props: any) => (
            <InputToolbarWithAnimatedInset
              {...props}
              insetsBottom={insets.bottom}
              replyTarget={replyTo}
              onClearReply={() => setReplyTo(null)}
            />
          )}
          // Try to keep behavior consistent with older implementation.
          keyboardShouldPersistTaps="handled"
        />
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
