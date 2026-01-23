import React from 'react';
import { Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

import type { LeagueChatMessage } from '../../hooks/useLeagueChat';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export default function ChatMessageBubble({
  message,
  isMe,
  authorName,
  avatarLabel,
  reactions,
  onPressReaction,
  onLongPress,
}: {
  message: LeagueChatMessage;
  isMe: boolean;
  authorName: string;
  avatarLabel?: string | null;
  reactions?: Array<{ emoji: string; count: number; hasUserReacted: boolean }>;
  onPressReaction?: (emoji: string) => void;
  onLongPress?: () => void;
}) {
  const t = useTokens();

  const statusLabel = message.status === 'sending' ? 'Sending…' : message.status === 'error' ? 'Failed' : null;

  return (
    <View style={{ flexDirection: 'row', justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 10 }}>
      {!isMe ? (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            backgroundColor: t.color.surface2,
            borderWidth: 1,
            borderColor: t.color.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
            marginTop: 2,
          }}
        >
          <TotlText variant="caption" style={{ fontWeight: '900' }}>
            {initials(avatarLabel ?? authorName)}
          </TotlText>
        </View>
      ) : null}

      <View style={{ maxWidth: '82%' }}>
        {!isMe ? (
          <TotlText variant="microMuted" style={{ marginBottom: 4 }}>
            {authorName}
          </TotlText>
        ) : null}

        <Pressable
          onLongPress={onLongPress}
          style={{
            backgroundColor: isMe ? 'rgba(28,131,118,0.25)' : 'rgba(148,163,184,0.14)',
            borderWidth: 1,
            borderColor: 'rgba(148,163,184,0.20)',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 14,
          }}
        >
          {message.reply_to ? (
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: t.color.brand,
                paddingLeft: 10,
                marginBottom: 8,
                opacity: 0.9,
              }}
            >
              <TotlText variant="microMuted" numberOfLines={1} style={{ fontWeight: '900' }}>
                Reply
              </TotlText>
              <TotlText variant="microMuted" numberOfLines={2}>
                {message.reply_to.content}
              </TotlText>
            </View>
          ) : null}

          <TotlText>{message.content}</TotlText>

          {statusLabel ? (
            <TotlText variant="microMuted" style={{ marginTop: 6, color: message.status === 'error' ? '#EF4444' : t.color.muted }}>
              {statusLabel}
            </TotlText>
          ) : null}
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
                  height: 28,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: r.hasUserReacted ? t.color.brand : t.color.border,
                  backgroundColor: r.hasUserReacted ? 'rgba(28,131,118,0.18)' : t.color.surface2,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <TotlText variant="caption" style={{ fontWeight: '900' }}>
                  {r.emoji}
                </TotlText>
                <TotlText variant="caption" style={{ marginLeft: 6, fontWeight: '900', color: t.color.muted }}>
                  {r.count}
                </TotlText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

