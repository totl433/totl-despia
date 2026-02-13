import React from 'react';
import { Platform, Image, Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

import type { LeagueChatMessage } from '../../hooks/useLeagueChat';

function formatTimeHHMM(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function initial1(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] ?? '?').toUpperCase();
}

const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
  isMe,
  authorName,
  avatarLabel,
  avatarUri,
  showAvatar = true,
  showAuthorName = true,
  topSpacing = 10,
  reactions,
  onPressReaction,
  onLongPress,
}: {
  message: LeagueChatMessage;
  isMe: boolean;
  authorName: string;
  avatarLabel?: string | null;
  avatarUri?: string | null;
  showAvatar?: boolean;
  showAuthorName?: boolean;
  topSpacing?: number;
  reactions?: Array<{ emoji: string; count: number; hasUserReacted: boolean }>;
  onPressReaction?: (emoji: string) => void;
  onLongPress?: () => void;
}) {
  const t = useTokens();

  const statusLabel = message.status === 'sending' ? 'Sending…' : message.status === 'error' ? 'Failed' : null;
  const time = formatTimeHHMM(message.created_at);

  // iOS/HIG-ish surfaces (lighter chrome, no heavy borders)
  const incomingBubble = '#FFFFFF';
  const outgoingBubble = 'rgba(28,131,118,0.18)'; // brand-tinted, subtle (not WhatsApp green)
  const bubbleBg = isMe ? outgoingBubble : incomingBubble;

  // Bubble corner rules:
  // - Default: fully-rounded bubbles everywhere.
  // - Exception: the incoming bubble that sits next to an avatar keeps the current "tail" corner.
  const bubbleBottomLeftRadius = !isMe && showAvatar ? 6 : 16;
  const bubbleBottomRightRadius = 16;

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end', // bottom-align avatar with bubble column
        marginTop: topSpacing,
        paddingHorizontal: 8, // row padding (keeps list full-bleed without visible side "frame")
      }}
    >
      {/* Keep a consistent left gutter for incoming messages so bubbles don't "step out" when avatar is hidden. */}
      {!isMe ? (
        <View style={{ width: 32 + 8, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
          {showAvatar ? (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: 'rgba(148,163,184,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
                marginBottom: 2,
                overflow: 'hidden',
              }}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: 32, height: 32 }} resizeMode="cover" />
              ) : (
                <TotlText variant="caption" style={{ fontWeight: '900' }}>
                  {initial1(avatarLabel ?? authorName)}
                </TotlText>
              )}
            </View>
          ) : (
            <View style={{ width: 32, height: 32, marginRight: 8, marginBottom: 2 }} />
          )}
        </View>
      ) : null}

      <View style={{ maxWidth: '82%' }}>
        <Pressable
          onLongPress={onLongPress}
          style={{
            backgroundColor: bubbleBg,
            // Avoid strong borders; use a subtle shadow like native bubbles.
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 6,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: bubbleBottomLeftRadius,
            borderBottomRightRadius: bubbleBottomRightRadius,
          }}
        >
          {!isMe && showAuthorName ? (
            <TotlText
              style={{
                marginBottom: 4,
                fontFamily: 'System',
                fontSize: 13,
                lineHeight: 16,
                color: 'rgba(15,23,42,0.55)',
              }}
            >
              {authorName}
            </TotlText>
          ) : null}

          {message.reply_to ? (
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: t.color.brand,
                paddingLeft: 10,
                paddingVertical: 4,
                marginBottom: 6,
                borderRadius: 8,
                backgroundColor: 'rgba(15,23,42,0.04)',
              }}
            >
              <TotlText
                numberOfLines={1}
                style={{ fontFamily: 'System', fontSize: 12, lineHeight: 14, color: 'rgba(15,23,42,0.70)' }}
              >
                Reply
              </TotlText>
              <TotlText numberOfLines={2} style={{ fontFamily: 'System', fontSize: 12, lineHeight: 16, color: 'rgba(15,23,42,0.60)' }}>
                {message.reply_to.content}
              </TotlText>
            </View>
          ) : null}

          <TotlText style={{ fontFamily: 'System', fontSize: 16, lineHeight: 20, color: '#0F172A' }}>{message.content}</TotlText>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
            {statusLabel ? (
              <TotlText style={{ marginRight: 6, fontFamily: 'System', fontSize: 11, lineHeight: 12, color: message.status === 'error' ? '#EF4444' : 'rgba(15,23,42,0.45)' }}>
                {statusLabel}
              </TotlText>
            ) : null}
            {time ? (
              <TotlText style={{ fontFamily: 'System', fontSize: 11, lineHeight: 12, color: 'rgba(15,23,42,0.45)' }}>
                {time}
              </TotlText>
            ) : null}
          </View>
        </Pressable>

        {reactions && reactions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
            {reactions.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => onPressReaction?.(r.emoji)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  // Avoid emoji cropping (emoji glyphs often exceed typical text bounds).
                  minHeight: 28,
                  paddingVertical: 4,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: 'rgba(15,23,42,0.10)',
                  backgroundColor: r.hasUserReacted ? 'rgba(28,131,118,0.12)' : 'rgba(255,255,255,0.85)',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <TotlText
                  style={{
                    fontSize: 16,
                    lineHeight: 20,
                    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
                  }}
                >
                  {r.emoji}
                </TotlText>
                <TotlText style={{ marginLeft: 6, fontFamily: 'System', fontSize: 12, lineHeight: 14, color: 'rgba(15,23,42,0.55)' }}>
                  {r.count}
                </TotlText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
});

export default ChatMessageBubble;

