import React from 'react';
import { FlatList, Image, type ViewStyle, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export type LeaderboardRow = {
  user_id: string;
  name: string;
  value: number;
  avatar_url?: string | null;
};

function initial1(name: string): string {
  const s = name.trim();
  if (!s) return '?';
  return s.slice(0, 1).toUpperCase();
}

function formatRank(rank: number, tied: boolean): string {
  return tied ? `${rank}=` : `${rank}`;
}

export default function LeaderboardTable({
  rows,
  valueLabel,
  highlightUserId,
  style,
  refreshing,
  onRefresh,
  listRef,
}: {
  rows: LeaderboardRow[];
  valueLabel: string;
  highlightUserId?: string | null;
  style?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  listRef?: React.RefObject<FlatList<any> | null>;
}) {
  const t = useTokens();

  const ranked = React.useMemo(() => {
    const out: Array<{ row: LeaderboardRow; rank: number; tied: boolean }> = [];
    let currentRank = 1;
    for (let i = 0; i < rows.length; i++) {
      const prev = rows[i - 1];
      const cur = rows[i]!;
      if (i > 0 && prev && prev.value !== cur.value) currentRank = i + 1;
      const next = rows[i + 1];
      const tied = (prev?.value === cur.value && prev !== undefined) || (next?.value === cur.value && next !== undefined);
      out.push({ row: cur, rank: currentRank, tied });
    }
    return out;
  }, [rows]);

  return (
    <Card
      style={[
        {
          padding: 0,
          flex: 1,
          // Flat (no shadow) to match the new iOS design language.
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: 0,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: 'rgba(148,163,184,0.08)',
          borderBottomWidth: 1,
          borderBottomColor: t.color.border,
        }}
      >
        <TotlText variant="caption" style={{ color: t.color.muted, width: 36, fontWeight: '900' }}>
          #
        </TotlText>
        <TotlText variant="caption" style={{ color: t.color.muted, flex: 1, fontWeight: '900' }}>
          Player
        </TotlText>
        <TotlText variant="caption" style={{ color: t.color.muted, width: 70, textAlign: 'right', fontWeight: '900' }}>
          {valueLabel}
        </TotlText>
      </View>

      <FlatList
        ref={listRef as any}
        data={ranked}
        keyExtractor={(it) => it.row.user_id}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING }}
        refreshControl={
          onRefresh ? <TotlRefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
        }
        ListFooterComponent={<View style={{ height: 12 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.color.border, opacity: 0.6, marginLeft: 16 }} />}
        renderItem={({ item }) => {
          const isMe = !!highlightUserId && item.row.user_id === highlightUserId;
          // Only top (including joint-top) gets a trophy
          const showTrophy = item.rank === 1;
          const AVATAR_SIZE = 20;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: isMe ? 'rgba(28,131,118,0.45)' : 'transparent',
              }}
            >
              <TotlText style={{ width: 36, fontWeight: '900' }}>{formatRank(item.rank, item.tied)}</TotlText>

              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    borderRadius: 999,
                    backgroundColor: t.color.surface2,
                    borderWidth: 1,
                    borderColor: t.color.border,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 6,
                  }}
                >
                  {item.row.avatar_url ? (
                    <Image source={{ uri: item.row.avatar_url }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} />
                  ) : (
                  <TotlText variant="caption" style={{ fontWeight: '900' }}>
                      {initial1(item.row.name)}
                  </TotlText>
                  )}
                </View>

                {showTrophy ? (
                  <TotlText style={{ marginRight: 8, color: '#FACC15', fontWeight: '900' }}>🏆</TotlText>
                ) : null}

                {/* Match Home mini-league table row typography */}
                <TotlText variant="caption" numberOfLines={1} style={{ fontWeight: isMe ? '900' : '700', flexShrink: 1 }}>
                  {item.row.name}
                </TotlText>
              </View>

              <TotlText style={{ width: 70, textAlign: 'right', fontWeight: '900' }}>{String(item.row.value)}</TotlText>
            </View>
          );
        }}
      />
    </Card>
  );
}

