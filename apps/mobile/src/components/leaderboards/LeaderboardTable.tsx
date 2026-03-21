import React from 'react';
import { FlatList, Image, Pressable, type ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TotlText, useTokens } from '@totl/ui';
import WinnerShimmer from '../WinnerShimmer';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export type LeaderboardRow = {
  user_id: string;
  name: string;
  value: number;
  secondaryValue?: number;
  compactValues?: Array<number | null | undefined>;
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

function truncateName(value: string, maxChars: number | null): string {
  const trimmed = value.trim();
  if (!trimmed || !maxChars || trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export default function LeaderboardTable({
  rows,
  valueLabel,
  secondaryValueLabel,
  compactValueLabels,
  compactLiveValueLabel,
  highlightUserId,
  winnerUserIds,
  style,
  listRef,
  onPressRow,
}: {
  rows: LeaderboardRow[];
  valueLabel: string;
  secondaryValueLabel?: string;
  compactValueLabels?: string[];
  compactLiveValueLabel?: string;
  highlightUserId?: string | null;
  /** When provided, rows with these user_ids get the winner shiny pill background (monthly tab). */
  winnerUserIds?: string[];
  style?: ViewStyle;
  listRef?: React.RefObject<FlatList<any> | null>;
  onPressRow?: (row: LeaderboardRow) => void;
}) {
  const t = useTokens();
  const compactColumnWidth = React.useMemo(() => {
    const count = compactValueLabels?.length ?? 0;
    if (count >= 5) return 28;
    if (count === 4) return 30;
    return 34;
  }, [compactValueLabels?.length]);
  const hasCompactColumns = (compactValueLabels?.length ?? 0) > 0;
  const valueColumnWidth = hasCompactColumns ? 56 : 70;
  const nameCharacterCap = React.useMemo(() => {
    const count = compactValueLabels?.length ?? 0;
    if (count >= 5) return 11;
    if (count >= 3) return 14;
    return null;
  }, [compactValueLabels?.length]);

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

  const [restListScrolledToTop, setRestListScrolledToTop] = React.useState(false);
  /** Monthly tab: always use split (winners pinned + rest scrollable). Same design for all users. */
  const wouldUseSplit = !!winnerUserIds?.length;
  const showDividerAndShadow = wouldUseSplit && !restListScrolledToTop;

  const dataKeyRef = React.useRef('');
  React.useEffect(() => {
    const key = `${winnerUserIds?.join(',') ?? ''}-${rows.length}`;
    if (dataKeyRef.current !== key) {
      dataKeyRef.current = key;
      if (wouldUseSplit) setRestListScrolledToTop(false);
    }
  }, [winnerUserIds, rows.length, wouldUseSplit]);

  React.useEffect(() => {
    if (!wouldUseSplit) setWinnerSectionHeight(0);
  }, [wouldUseSplit]);
  const { winnerRows, restRows } = React.useMemo(() => {
    if (!wouldUseSplit) return { winnerRows: [] as typeof ranked, restRows: ranked };
    const winnerIds = new Set(winnerUserIds!);
    const winners: typeof ranked = [];
    const rest: typeof ranked = [];
    for (const item of ranked) {
      if (winnerIds.has(item.row.user_id)) winners.push(item);
      else rest.push(item);
    }
    return { winnerRows: winners, restRows: rest };
  }, [ranked, wouldUseSplit, winnerUserIds]);

  const restListRef = React.useRef<FlatList<any> | null>(null);
  const restListReadyRef = React.useRef(false);
  const lastScrollKeyRef = React.useRef<string | null>(null);
  const [winnerSectionHeight, setWinnerSectionHeight] = React.useState<number>(0);
  const [headerHeight, setHeaderHeight] = React.useState<number>(0);

  const highlightIndexInRest = React.useMemo(() => {
    if (!highlightUserId || !wouldUseSplit) return -1;
    return restRows.findIndex((it) => it.row.user_id === highlightUserId);
  }, [highlightUserId, restRows, wouldUseSplit]);

  React.useEffect(() => {
    if (!wouldUseSplit) return;
    if (highlightIndexInRest < 0) return;
    const key = `rest:${highlightUserId ?? ''}:${restRows.length}`;
    if (lastScrollKeyRef.current === key) return;
    lastScrollKeyRef.current = key;
    restListReadyRef.current = false;
    const timer = setTimeout(() => {
      const list = restListRef.current;
      if (!list?.scrollToIndex) return;
      list.scrollToIndex({ index: highlightIndexInRest, animated: false, viewPosition: 0.5 });
      setTimeout(() => {
        restListReadyRef.current = true;
      }, 600);
    }, 80);
    return () => clearTimeout(timer);
  }, [highlightIndexInRest, highlightUserId, restRows.length, wouldUseSplit]);

  const renderRow = React.useCallback(
    (item: (typeof ranked)[number]) => {
      const isMe = !!highlightUserId && item.row.user_id === highlightUserId;
      const isWinner = !!winnerUserIds?.length && winnerUserIds.includes(item.row.user_id);
      const showTrophy = item.rank === 1;
      const AVATAR_SIZE = 20;
      const displayName = truncateName(item.row.name, hasCompactColumns ? nameCharacterCap : null);
      const rowInner = (
        <>
          <TotlText style={{ width: 36, fontFamily: t.font.medium, fontSize: 13, lineHeight: 18, color: isWinner ? '#fff' : t.color.text }}>{formatRank(item.rank, item.tied)}</TotlText>
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
                <TotlText variant="caption" style={{ fontFamily: t.font.medium }}>{initial1(item.row.name)}</TotlText>
              )}
            </View>
            {showTrophy ? <TotlText style={{ marginRight: 8, fontFamily: t.font.medium }}>🏅</TotlText> : null}
            <TotlText
              variant="caption"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontFamily: isWinner ? t.font.medium : t.font.regular,
                color: isWinner ? '#fff' : t.color.text,
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {displayName}
            </TotlText>
          </View>
          {hasCompactColumns
            ? compactValueLabels!.map((label, index) => (
                <TotlText
                  key={`${item.row.user_id}-${label}`}
                  style={{
                    width: compactColumnWidth,
                    textAlign: 'center',
                    fontFamily: t.font.medium,
                    fontSize: 12,
                    lineHeight: 16,
                    color: isWinner ? '#fff' : t.color.muted,
                  }}
                >
                  {typeof item.row.compactValues?.[index] === 'number' ? String(item.row.compactValues?.[index]) : '—'}
                </TotlText>
              ))
            : null}
          {secondaryValueLabel ? (
            <TotlText style={{ width: 62, textAlign: 'center', fontFamily: t.font.medium, fontSize: 13, lineHeight: 18, color: isWinner ? '#fff' : t.color.text }}>
              {typeof item.row.secondaryValue === 'number' ? String(item.row.secondaryValue) : '—'}
            </TotlText>
          ) : null}
          <TotlText style={{ width: valueColumnWidth, textAlign: 'center', fontFamily: t.font.medium, fontSize: 13, lineHeight: 18, color: isWinner ? '#fff' : t.color.text }}>{String(item.row.value)}</TotlText>
        </>
      );
      return (
        <Pressable
          onPress={onPressRow ? () => onPressRow(item.row) : undefined}
          style={[
            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
            isWinner
              ? { overflow: 'hidden', borderRadius: 10, position: 'relative' }
              : isMe
                ? { overflow: 'hidden', borderRadius: 10, backgroundColor: t.color.surface2 }
                : { backgroundColor: 'transparent' },
          ]}
        >
          {isWinner ? (
            <>
              <LinearGradient
                colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
              />
              <WinnerShimmer durationMs={1200} delayMs={4000} opacity={0.9} tint="white" skipFirstDelay />
              <WinnerShimmer durationMs={1800} delayMs={4400} opacity={0.55} tint="gold" skipFirstDelay />
              {rowInner}
            </>
          ) : (
            rowInner
          )}
        </Pressable>
      );
    },
    [compactColumnWidth, compactValueLabels, hasCompactColumns, highlightUserId, nameCharacterCap, onPressRow, secondaryValueLabel, t, valueColumnWidth, winnerUserIds]
  );

  const Separator = () => (
    <View style={{ paddingHorizontal: t.space[4] }}>
      <View style={{ height: 1, backgroundColor: t.color.border, opacity: 0.6 }} />
    </View>
  );

  return (
    <View style={[{ flex: 1, minHeight: 0, position: 'relative' }, style]}>
      <View
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: t.color.surface,
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
        {hasCompactColumns
          ? compactValueLabels!.map((label) => (
              <View
                key={label}
                style={{ width: compactColumnWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
              >
                {compactLiveValueLabel === label ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      backgroundColor: '#EF4444',
                      marginRight: 4,
                    }}
                  />
                ) : null}
                <TotlText
                  variant="caption"
                  style={{
                    color: t.color.muted,
                    textAlign: 'center',
                    fontFamily: t.font.medium,
                    fontSize: 11,
                  }}
                >
                  {label}
                </TotlText>
              </View>
            ))
          : null}
        {secondaryValueLabel ? (
          <TotlText variant="caption" style={{ color: t.color.muted, width: 62, textAlign: 'center', fontFamily: t.font.medium }}>
            {secondaryValueLabel}
          </TotlText>
        ) : null}
        <TotlText variant="caption" style={{ color: t.color.muted, width: valueColumnWidth, textAlign: 'center', fontFamily: t.font.medium }}>
          {valueLabel}
        </TotlText>
      </View>
      {wouldUseSplit ? (
        <>
          <View style={{ flex: 1, position: 'relative' }}>
            <View
              style={{
                flex: 1,
                paddingTop: winnerSectionHeight || winnerRows.length * 55 + 50,
              }}
            >
            <FlatList
            ref={(ref) => {
              (restListRef as React.MutableRefObject<FlatList<any> | null>).current = ref;
              if (listRef) (listRef as React.MutableRefObject<any>).current = ref;
            }}
            data={restRows}
            keyExtractor={(it) => it.row.user_id}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING }}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              if (restListReadyRef.current && y <= 10) {
                restListReadyRef.current = false;
                setRestListScrolledToTop(true);
              } else if (y > 30) {
                setRestListScrolledToTop(false);
              }
            }}
            scrollEventThrottle={16}
            onScrollToIndexFailed={(info) => {
              const list = restListRef.current;
              if (!list?.scrollToOffset || !list?.scrollToIndex) return;
              const offset = Math.max(0, info.averageItemLength * info.index);
              list.scrollToOffset({ offset, animated: false });
              setTimeout(() => {
                list.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.5 });
              }, 60);
            }}
            ListFooterComponent={<View style={{ height: 12 }} />}
            ItemSeparatorComponent={Separator}
            renderItem={({ item }) => renderRow(item)}
          />
            {showDividerAndShadow ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 14,
                  zIndex: 1,
                }}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.1)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={{ flex: 1 }}
                />
              </View>
            ) : null}
            </View>
          </View>
          {/* Winners as root-level overlay - pinned, never scroll */}
          <View
            pointerEvents="box-none"
            collapsable={false}
            style={{
              position: 'absolute',
              top: headerHeight || 48,
              left: 0,
              right: 0,
              zIndex: 10,
              backgroundColor: t.color.surface,
            }}
            onLayout={(e) => setWinnerSectionHeight(e.nativeEvent.layout.height)}
          >
            {winnerRows.map((item, i) => (
              <React.Fragment key={item.row.user_id}>
                {i > 0 ? <Separator /> : null}
                {renderRow(item)}
              </React.Fragment>
            ))}
            {showDividerAndShadow ? (
              <View style={{ paddingTop: 12 }}>
                <View style={{ height: 1, backgroundColor: t.color.border, marginHorizontal: -t.space[4] }} />
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <FlatList
          ref={listRef as any}
          data={ranked}
          keyExtractor={(it) => it.row.user_id}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING }}
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
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => renderRow(item)}
        />
      )}
    </View>
  );
}

