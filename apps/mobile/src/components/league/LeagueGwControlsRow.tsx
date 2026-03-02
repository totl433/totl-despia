import React from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { TotlText, useTokens } from '@totl/ui';

import LeaguePillButton from './LeaguePillButton';

export default function LeagueGwControlsRow({
  availableGws,
  selectedGw,
  onChangeGw,
  onPressRules,
  onPressMenu,
}: {
  availableGws: number[];
  selectedGw: number | null;
  onChangeGw: (gw: number) => void;
  onPressRules: () => void;
  onPressMenu?: () => void;
}) {
  const t = useTokens();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<BottomSheetModal>(null);
  const sortedGws = React.useMemo(() => [...availableGws].sort((a, b) => b - a), [availableGws]);
  const snapPoints = React.useMemo(() => [Math.min(400, 120 + sortedGws.length * 48)], [sortedGws.length]);

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => ref.current?.present());
      return;
    }
    ref.current?.dismiss();
  }, [open]);

  const renderItem = React.useCallback(
    ({ item: gw }: { item: number }) => {
      const active = gw === selectedGw;
      return (
        <Pressable
          onPress={() => {
            onChangeGw(gw);
            setOpen(false);
          }}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: active ? 'rgba(28, 131, 118, 0.12)' : t.color.surface,
            opacity: pressed ? 0.92 : 1,
            borderBottomWidth: 1,
            borderBottomColor: t.color.border,
          })}
        >
          <TotlText variant="body" style={{ fontWeight: active ? '900' : '700', color: active ? t.color.brand : undefined }}>
            Gameweek {gw}
          </TotlText>
        </Pressable>
      );
    },
    [onChangeGw, selectedGw, t.color.brand, t.color.surface]
  );

  const ListHeaderComponent = React.useMemo(
    () => (
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.color.border }}>
        <TotlText variant="body" style={{ fontWeight: '900' }}>
          Select Gameweek
        </TotlText>
      </View>
    ),
    [t.color.border]
  );

  if (availableGws.length <= 1) return null;

  return (
    <>
      <View
        style={{
          marginTop: t.space[4],
          marginBottom: t.space[3],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 40,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: t.color.border,
            backgroundColor: t.color.surface,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingHorizontal: 12,
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <TotlText variant="caption" style={{ color: t.color.text, fontWeight: '700' }}>
            {typeof selectedGw === 'number' ? `Gameweek ${selectedGw}` : 'Select gameweek'}
          </TotlText>
          <Ionicons name="chevron-down" size={16} color={t.color.text} />
        </Pressable>

        <LeaguePillButton label="Rules" onPress={onPressRules} />
        {onPressMenu ? (
          <Pressable
            onPress={onPressMenu}
            accessibilityRole="button"
            accessibilityLabel="League menu"
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: t.color.border,
              backgroundColor: t.color.surface,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <Ionicons name="settings-outline" size={20} color={t.color.text} />
          </Pressable>
        ) : null}
      </View>

      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={() => setOpen(false)}
        backgroundStyle={{ backgroundColor: t.color.surface }}
        handleIndicatorStyle={{ backgroundColor: t.color.border }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
        )}
      >
        <BottomSheetFlatList
          data={sortedGws}
          keyExtractor={(gw) => String(gw)}
          renderItem={renderItem}
          ListHeaderComponent={ListHeaderComponent}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </BottomSheetModal>
    </>
  );
}

