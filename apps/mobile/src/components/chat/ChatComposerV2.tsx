import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatComposerV2({
  value,
  onChange,
  onSend,
  sending,
  bottomInset,
  onInputFocus,
  onInputBlur,
  replyPreview,
  onCancelReply,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  bottomInset?: number;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
  replyPreview: { content: string; authorName?: string } | null;
  onCancelReply: () => void;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const bottomPad = typeof bottomInset === 'number' ? bottomInset : Math.max(8, insets.bottom);

  return (
    <View
      style={{
        paddingTop: 0,
        paddingBottom: bottomPad,
        paddingHorizontal: 20,
        backgroundColor: t.color.background,
      }}
    >
      {replyPreview ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: '#dfebe9',
            backgroundColor: '#ffffff',
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

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            borderRadius: 28,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#dfebe9',
          }}
        >
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          placeholder="Start typing..."
          placeholderTextColor="#adadb1"
          multiline
          style={{
            flex: 1,
            minHeight: 28,
            maxHeight: 120,
            paddingVertical: 0,
            color: t.color.text,
            fontFamily: 'Gramatika-Regular',
            fontSize: 16,
            lineHeight: 22,
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
            borderRadius: 22,
            backgroundColor: t.color.brand,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            opacity: sending ? 0.6 : pressed ? 0.9 : 1,
          })}
        >
          <TotlText style={{ color: '#FFFFFF', fontFamily: 'System', fontSize: 18, lineHeight: 18 }}>
            {sending ? '…' : '➤'}
          </TotlText>
        </Pressable>
      </View>
    </View>
  );
}
