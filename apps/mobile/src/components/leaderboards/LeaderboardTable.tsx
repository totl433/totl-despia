import React from 'react';
import { FlatList, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

export type LeaderboardRow = {
  user_id: string;
  name: string;
  value: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function formatRank(rank: number, tied: boolean): string {
  return tied ? `${rank}=` : `${rank}`;
}

export default function LeaderboardTable({
  rows,
  valueLabel,
  highlightUserId,
}: {
  rows: LeaderboardRow[];
  valueLabel: string;
  highlightUserId?: string | null;
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
    <Card style={{ padding: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: 'rgba(148,163,184,0.08)',
          borderBottomWidth: 1,
          borderBottomColor: t.color.border,
        }}
      >
        <TotlText variant="caption" style={{ color: t.color.muted, width: 42, fontWeight: '900' }}>
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
        data={ranked}
        keyExtractor={(it) => it.row.user_id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.color.border, opacity: 0.6, marginLeft: 16 }} />}
        renderItem={({ item }) => {
          const isMe = !!highlightUserId && item.row.user_id === highlightUserId;
          const showTrophy = item.rank <= 4;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: isMe ? 'rgba(28,131,118,0.45)' : 'transparent',
              }}
            >
              <TotlText style={{ width: 42, fontWeight: '900' }}>{formatRank(item.rank, item.tied)}</TotlText>

              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    backgroundColor: t.color.surface2,
                    borderWidth: 1,
                    borderColor: t.color.border,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <TotlText variant="caption" style={{ fontWeight: '900' }}>
                    {initials(item.row.name)}
                  </TotlText>
                </View>

                {showTrophy ? (
                  <TotlText style={{ marginRight: 10, color: '#FACC15', fontWeight: '900' }}>🏆</TotlText>
                ) : null}

                <TotlText numberOfLines={1} style={{ fontWeight: isMe ? '900' : '700', flexShrink: 1 }}>
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

