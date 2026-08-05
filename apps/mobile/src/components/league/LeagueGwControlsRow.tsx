import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
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
  seasonOptions,
  selectedSeasonKey,
  onChangeSeason,
}: {
  availableGws: number[];
  selectedGw: number | null;
  onChangeGw: (gw: number) => void;
  onPressRules: () => void;
  onPressMenu?: () => void;
  seasonOptions?: Array<{ key: string; label: string }>;
  selectedSeasonKey?: string;
  onChangeSeason?: (key: string) => void;
}) {
  const t = useTokens();
  const [open, setOpen] = React.useState(false);
  const [seasonOpen, setSeasonOpen] = React.useState(false);
  const ref = React.useRef<BottomSheetModal>(null);
  const sortedGws = React.useMemo(() => [...availableGws].sort((a, b) => b - a), [availableGws]);
  const snapPoints = React.useMemo(() => [Math.min(400, 120 + Math.max(sortedGws.length, 1) * 48)], [sortedGws.length]);
  const hasSeasonPicker = (seasonOptions?.length ?? 0) > 1 && !!onChangeSeason;
  const selectedSeasonLabel =
    seasonOptions?.find((o) => o.key === selectedSeasonKey)?.label ?? seasonOptions?.[0]?.label ?? 'Season';

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
            GW{gw}
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
          Select GW
        </TotlText>
      </View>
    ),
    [t.color.border]
  );

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
          flexWrap: 'wrap',
        }}
      >
        {hasSeasonPicker ? (
          <Pressable
            onPress={() => setSeasonOpen(true)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 100,
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
            <TotlText variant="caption" style={{ color: t.color.text, fontWeight: '700' }} numberOfLines={1}>
              {selectedSeasonLabel}
            </TotlText>
            <Ionicons name="chevron-down" size={16} color={t.color.text} />
          </Pressable>
        ) : null}

        {availableGws.length > 0 ? (
          <Pressable
            onPress={() => {
              if (availableGws.length > 1) setOpen(true);
            }}
            disabled={availableGws.length <= 1}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 90,
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
              opacity: pressed && availableGws.length > 1 ? 0.92 : 1,
            })}
          >
            <TotlText variant="caption" style={{ color: t.color.text, fontWeight: '700' }}>
              {typeof selectedGw === 'number' ? `GW${selectedGw}` : 'GW'}
            </TotlText>
            {availableGws.length > 1 ? <Ionicons name="chevron-down" size={16} color={t.color.text} /> : null}
          </Pressable>
        ) : null}

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

      <Modal visible={seasonOpen} transparent animationType="fade" onRequestClose={() => setSeasonOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} onPress={() => setSeasonOpen(false)} />
          <View
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: 40,
              backgroundColor: t.color.surface,
              borderRadius: 16,
              overflow: 'hidden',
              maxHeight: 360,
            }}
          >
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.color.border }}>
              <TotlText style={{ fontWeight: '900', fontSize: 16 }}>Seasons</TotlText>
            </View>
            <ScrollView>
              {(seasonOptions ?? []).map((opt, index, arr) => {
                const active = opt.key === selectedSeasonKey;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      onChangeSeason?.(opt.key);
                      setSeasonOpen(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      backgroundColor: pressed
                        ? 'rgba(0,0,0,0.05)'
                        : active
                          ? 'rgba(28,131,118,0.08)'
                          : 'transparent',
                      ...(index < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: t.color.border } : {}),
                    })}
                  >
                    <TotlText style={{ fontWeight: '700', fontSize: 15, color: active ? t.color.brand : t.color.text }}>
                      {opt.label}
                    </TotlText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
