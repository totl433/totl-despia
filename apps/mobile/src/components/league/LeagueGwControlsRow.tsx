import React from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export default function LeagueGwControlsRow({
  availableGws,
  selectedGw,
  onChangeGw,
  onPressRules,
}: {
  availableGws: number[];
  selectedGw: number | null;
  onChangeGw: (gw: number) => void;
  onPressRules: () => void;
}) {
  const t = useTokens();
  const [open, setOpen] = React.useState(false);

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
            justifyContent: 'center',
            paddingHorizontal: 12,
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <TotlText variant="caption" style={{ textAlign: 'center', color: t.color.muted, fontWeight: '700' }}>
            {typeof selectedGw === 'number' ? `Gameweek ${selectedGw}` : 'Select gameweek'}
          </TotlText>
        </Pressable>

        <Pressable
          onPress={onPressRules}
          style={({ pressed }) => ({
            minHeight: 40,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: t.color.border,
            backgroundColor: t.color.surface,
            paddingHorizontal: 14,
            justifyContent: 'center',
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '800' }}>
            Rules
          </TotlText>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(2, 6, 23, 0.62)',
            padding: t.space[4],
            justifyContent: 'center',
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: '100%',
              borderRadius: 16,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: t.color.border,
              backgroundColor: t.color.surface,
            }}
          >
            <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.color.border }}>
              <TotlText variant="body" style={{ fontWeight: '900' }}>
                Select Gameweek
              </TotlText>
            </View>

            <FlatList
              data={[...availableGws].sort((a, b) => b - a)}
              keyExtractor={(gw) => String(gw)}
              style={{ maxHeight: 360 }}
              renderItem={({ item: gw }) => {
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
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

