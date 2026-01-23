import React from 'react';
import { Pressable, View } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { TotlText, useTokens } from '@totl/ui';

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
  const ref = React.useRef<BottomSheet>(null);
  const snapPoints = React.useMemo(() => [220], []);

  React.useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      ref.current?.snapToIndex(0);
    });
  }, [open]);

  if (!open) return null;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(2,6,23,0.5)' }} />
      <BottomSheet
        ref={ref}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backgroundStyle={{ backgroundColor: t.color.surface }}
        handleIndicatorStyle={{ backgroundColor: t.color.border }}
      >
        <BottomSheetView style={{ paddingHorizontal: 16, paddingTop: 8 }}>
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
                <TotlText style={{ fontSize: 20 }}>{e}</TotlText>
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
      </BottomSheet>
    </View>
  );
}

