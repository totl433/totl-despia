import React from 'react';
import { FlatList, Image, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';
import type { BrandedLeaderboardStandingsRow } from '@totl/domain';
import HostBadge from './HostBadge';

function initial1(name: string): string {
  const s = name.trim();
  return s ? s.slice(0, 1).toUpperCase() : '?';
}

type Props = {
  rows: BrandedLeaderboardStandingsRow[];
  highlightUserId?: string | null;
  valueLabel?: string;
};

export default function BrandedLeaderboardTable({ rows, highlightUserId, valueLabel = 'Pts' }: Props) {
  const t = useTokens();

  return (
    <View>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: t.color.border,
        }}
      >
        {/* Keep the rank column spacing, but hide the header label. */}
        <TotlText style={{ width: 36, fontSize: 11, color: t.color.muted, fontWeight: '600' }} />
        <TotlText style={{ flex: 1, fontSize: 11, color: t.color.muted, fontWeight: '600' }}>Player</TotlText>
        <TotlText style={{ width: 50, textAlign: 'right', fontSize: 11, color: t.color.muted, fontWeight: '600' }}>
          {valueLabel}
        </TotlText>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.user_id}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const isMe = item.user_id === highlightUserId;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: isMe ? t.color.surface2 : 'transparent',
              }}
            >
              <TotlText
                style={{
                  width: 36,
                  fontSize: 14,
                  fontWeight: '600',
                  color: t.color.text,
                }}
              >
                {item.rank === 1 ? '🏆' : item.rank}
              </TotlText>

              {item.avatar_url ? (
                <Image
                  source={{ uri: item.avatar_url }}
                  style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }}
                />
              ) : (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    marginRight: 8,
                    backgroundColor: t.color.surface2,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <TotlText style={{ fontSize: 12, color: t.color.muted }}>
                    {initial1(item.name)}
                  </TotlText>
                </View>
              )}

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TotlText
                  style={{
                    fontSize: 14,
                    fontWeight: isMe ? '700' : '400',
                    color: t.color.text,
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </TotlText>
                {item.is_host && <HostBadge />}
              </View>

              <TotlText
                style={{
                  width: 50,
                  textAlign: 'right',
                  fontSize: 14,
                  fontWeight: '700',
                  color: t.color.text,
                }}
              >
                {item.value}
              </TotlText>
            </View>
          );
        }}
      />
    </View>
  );
}
