import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

import LeaguePillButton from './LeaguePillButton';

export type LeagueSeasonOption = {
  key: string;
  label: string;
};

/**
 * Footer control to switch between live season (e.g. 2026/27) and archive seasons (e.g. 2025/26 final).
 */
export default function LeagueSeasonPicker({
  options,
  selectedKey,
  onChange,
}: {
  options: LeagueSeasonOption[];
  selectedKey: string;
  onChange: (key: string) => void;
}) {
  const t = useTokens();
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.key === selectedKey) ?? options[0];

  if (options.length < 2) return null;

  return (
    <>
      <LeaguePillButton label={selected?.label ?? 'Seasons'} onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} onPress={() => setOpen(false)} />
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
              <TotlText style={{ fontFamily: t.font.medium, fontSize: 16, fontWeight: '800' }}>Seasons</TotlText>
              <TotlText variant="caption" style={{ color: t.color.muted, marginTop: 4 }}>
                Current season is live. Archive keeps last season’s final tables and GWs.
              </TotlText>
            </View>
            <ScrollView>
              {options.map((opt, index) => {
                const active = opt.key === selectedKey;
                const isLast = index === options.length - 1;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      onChange(opt.key);
                      setOpen(false);
                    }}
                    style={({ pressed }) => ({
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      backgroundColor: pressed
                        ? 'rgba(0,0,0,0.05)'
                        : active
                          ? 'rgba(28,131,118,0.08)'
                          : 'transparent',
                      ...(!isLast ? { borderBottomWidth: 1, borderBottomColor: t.color.border } : {}),
                    })}
                  >
                    <TotlText
                      style={{
                        fontFamily: t.font.medium,
                        fontSize: 15,
                        color: active ? t.color.brand : t.color.text,
                      }}
                    >
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
