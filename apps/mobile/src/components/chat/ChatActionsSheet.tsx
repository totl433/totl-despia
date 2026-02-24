import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { TotlText, useTokens } from '@totl/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

export default function ChatActionsSheet({
  open,
  onClose,
  onReply,
  onReact,
}: {
  open: boolean;
  onClose: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => [220], []);

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        ref.current?.present();
      });
      return;
    }
    // Dismiss when parent closes (keeps state in sync).
    ref.current?.dismiss();
  }, [open]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      // Keep the sheet background flush to the bottom of the screen.
      // We handle safe-area spacing via content padding so there's no visible "gap" under the sheet.
      bottomInset={0}
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: t.color.surface }}
      handleIndicatorStyle={{ backgroundColor: t.color.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior="close"
        />
      )}
    >
      <BottomSheetView style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 + insets.bottom }}>
        <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '900', marginBottom: 10 }}>
          React
        </TotlText>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => onReact(e)}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: t.color.surface2,
                borderWidth: 1,
                borderColor: t.color.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <TotlText
                style={{
                  fontSize: 22,
                  lineHeight: 26,
                  textAlign: 'center',
                  ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
                }}
              >
                {e}
              </TotlText>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 14 }} />

        <Pressable
          onPress={onReply}
          style={({ pressed }) => ({
            width: '100%',
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: t.color.brand,
            opacity: pressed ? 0.92 : 1,
            alignItems: 'center',
          })}
        >
          <TotlText style={{ color: '#FFFFFF', fontWeight: '900' }}>Reply</TotlText>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

