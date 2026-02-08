import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  bottomInset,
  replyPreview,
  onCancelReply,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  bottomInset?: number;
  replyPreview: { content: string; authorName?: string } | null;
  onCancelReply: () => void;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const bottomPad = typeof bottomInset === 'number' ? bottomInset : Math.max(8, insets.bottom);

  return (
    <View
      style={{
        paddingTop: 8,
        paddingBottom: bottomPad,
        backgroundColor: t.color.background, // match screen to avoid any "frame" edges
        borderTopWidth: 1,
        borderTopColor: 'rgba(60,60,67,0.18)',
      }}
    >
      {/* Full-bleed bar, with content inset inside (WhatsApp-like). */}
      <View style={{ paddingHorizontal: 12 }}>
        {replyPreview ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: 'rgba(15,23,42,0.10)',
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 13, lineHeight: 14, color: 'rgba(15,23,42,0.75)' }}>
                  Replying{replyPreview.authorName ? ` to ${replyPreview.authorName}` : ''}
                </TotlText>
              </View>
              <Pressable onPress={onCancelReply} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                <TotlText style={{ fontFamily: 'Gramatika-Medium', color: 'rgba(15,23,42,0.55)' }}>✕</TotlText>
              </Pressable>
            </View>
            <TotlText
              numberOfLines={2}
              style={{ marginTop: 4, fontFamily: 'Gramatika-Regular', fontSize: 12, lineHeight: 16, color: 'rgba(15,23,42,0.55)' }}
            >
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
                minHeight: 44, // iOS minimum touch height
                maxHeight: 120,
                borderWidth: 1,
                borderColor: 'rgba(60,60,67,0.18)',
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: t.color.text,
                fontFamily: 'System',
                fontSize: 16,
                lineHeight: 20,
              }}
            />
          </View>
          <View style={{ width: 8 }} />
          <Pressable
            disabled={sending}
            onPress={onSend}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: t.color.brand,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: sending ? 0.6 : pressed ? 0.9 : 1,
            })}
          >
            <TotlText style={{ color: '#FFFFFF', fontFamily: 'System', fontSize: 18, lineHeight: 18 }}>
              {sending ? '…' : '➤'}
            </TotlText>
          </Pressable>
        </View>
      </View>

      {/* Future: add attachments / tools row here */}
    </View>
  );
}

