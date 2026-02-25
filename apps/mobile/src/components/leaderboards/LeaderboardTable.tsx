import React from 'react';
import { FlatList, Image, Pressable, type ViewStyle, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export type LeaderboardRow = {
  user_id: string;
  name: string;
  value: number;
  secondaryValue?: number;
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
  secondaryValueLabel,
  highlightUserId,
  style,
  refreshing,
  onRefresh,
  listRef,
  onPressRow,
}: {
  rows: LeaderboardRow[];
  valueLabel: string;
  secondaryValueLabel?: string;
  highlightUserId?: string | null;
  style?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  listRef?: React.RefObject<FlatList<any> | null>;
  onPressRow?: (row: LeaderboardRow) => void;
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
  const highlightIndex = React.useMemo(() => {
    if (!highlightUserId) return -1;
    return ranked.findIndex((it) => it.row.user_id === highlightUserId);
  }, [highlightUserId, ranked]);
  const lastAutoScrollKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (highlightIndex < 0) return;
    const key = `${highlightUserId ?? ''}:${rows.length}:${valueLabel}:${secondaryValueLabel ?? ''}`;
    if (lastAutoScrollKeyRef.current === key) return;
    lastAutoScrollKeyRef.current = key;

    const timer = setTimeout(() => {
      const list = listRef?.current as any;
      if (!list?.scrollToIndex) return;
      list.scrollToIndex({ index: highlightIndex, animated: true, viewPosition: 0.4 });
    }, 80);

    return () => clearTimeout(timer);
  }, [highlightIndex, highlightUserId, listRef, rows.length, secondaryValueLabel, valueLabel]);

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
          paddingLeft: 16,
          paddingRight: 8,
          paddingVertical: 12,
          backgroundColor: 'rgba(148,163,184,0.08)',
          borderBottomWidth: 1,
          borderBottomColor: t.color.border,
        }}
      >
        <TotlText variant="caption" style={{ color: t.color.muted, width: 36, fontFamily: t.font.medium }}>
          #
        </TotlText>
        <TotlText variant="caption" style={{ color: t.color.muted, flex: 1, fontFamily: t.font.medium }}>
          Player
        </TotlText>
        {secondaryValueLabel ? (
          <TotlText variant="caption" style={{ color: t.color.muted, width: 62, textAlign: 'center', fontFamily: t.font.medium }}>
            {secondaryValueLabel}
          </TotlText>
        ) : null}
        <TotlText variant="caption" style={{ color: t.color.muted, width: 70, textAlign: 'center', fontFamily: t.font.medium }}>
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
        onScrollToIndexFailed={(info) => {
          const list = listRef?.current as any;
          if (!list?.scrollToOffset || !list?.scrollToIndex) return;
          const offset = Math.max(0, info.averageItemLength * info.index);
          list.scrollToOffset({ offset, animated: false });
          setTimeout(() => {
            list.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.4 });
          }, 60);
        }}
        ListFooterComponent={<View style={{ height: 12 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.color.border, opacity: 0.6, marginLeft: 16 }} />}
        renderItem={({ item }) => {
          const isMe = !!highlightUserId && item.row.user_id === highlightUserId;
          // Only top (including joint-top) gets a trophy
          const showTrophy = item.rank === 1;
          const AVATAR_SIZE = 20;
          return (
            <Pressable
              onPress={onPressRow ? () => onPressRow(item.row) : undefined}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: 16,
                paddingRight: 8,
                paddingVertical: 12,
                backgroundColor: isMe ? 'rgba(28,131,118,0.45)' : 'transparent',
              }}
            >
              <TotlText style={{ width: 36, fontFamily: t.font.medium, fontSize: 13, lineHeight: 18 }}>{formatRank(item.rank, item.tied)}</TotlText>

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
                  <TotlText variant="caption" style={{ fontFamily: t.font.medium }}>
                      {initial1(item.row.name)}
                  </TotlText>
                  )}
                </View>

                {showTrophy ? (
                  <TotlText style={{ marginRight: 8, color: '#FACC15', fontFamily: t.font.medium }}>🏆</TotlText>
                ) : null}

                {/* Match Home mini-league table row typography */}
                <TotlText variant="caption" numberOfLines={1} style={{ fontWeight: isMe ? '900' : '700', flexShrink: 1 }}>
                  {item.row.name}
                </TotlText>
              </View>

              {secondaryValueLabel ? (
                <TotlText style={{ width: 62, textAlign: 'center', fontFamily: t.font.medium, fontSize: 13, lineHeight: 18 }}>
                  {typeof item.row.secondaryValue === 'number' ? String(item.row.secondaryValue) : '—'}
                </TotlText>
              ) : null}
              <TotlText style={{ width: 70, textAlign: 'center', fontFamily: t.font.medium, fontSize: 13, lineHeight: 18 }}>{String(item.row.value)}</TotlText>
            </Pressable>
          );
        }}
      />
    </Card>
  );
}

