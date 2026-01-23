import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export default function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  replyPreview,
  onCancelReply,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  replyPreview: { content: string; authorName?: string } | null;
  onCancelReply: () => void;
}) {
  const t = useTokens();

  return (
    <View style={{ paddingHorizontal: t.space[4], paddingTop: 10, paddingBottom: 12 }}>
      {replyPreview ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface2,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TotlText variant="caption" style={{ fontWeight: '900' }}>
              Replying{replyPreview.authorName ? ` to ${replyPreview.authorName}` : ''}
            </TotlText>
            <Pressable onPress={onCancelReply} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
              <TotlText style={{ fontWeight: '900', color: t.color.muted }}>✕</TotlText>
            </Pressable>
          </View>
          <TotlText variant="microMuted" numberOfLines={2}>
            {replyPreview.content}
          </TotlText>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Message…"
            placeholderTextColor={t.color.muted}
            multiline
            style={{
              minHeight: 44,
              maxHeight: 120,
              borderWidth: 1,
              borderColor: t.color.border,
              backgroundColor: t.color.surface,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: t.color.text,
            }}
          />
        </View>
        <View style={{ width: 10 }} />
        <Pressable
          disabled={sending}
          onPress={onSend}
          style={({ pressed }) => ({
            width: 52,
            height: 44,
            borderRadius: 14,
            backgroundColor: t.color.brand,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: sending ? 0.6 : pressed ? 0.9 : 1,
          })}
        >
          <TotlText style={{ color: '#FFFFFF', fontWeight: '900' }}>{sending ? '…' : 'Send'}</TotlText>
        </Pressable>
      </View>

      {/* Future: add attachments / tools row here */}
    </View>
  );
}

