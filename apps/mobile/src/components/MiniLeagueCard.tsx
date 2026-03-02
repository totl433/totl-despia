import React, { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, TotlText, useTokens } from '@totl/ui';

export type MiniLeagueTableRow = { user_id: string; name: string; score: number; unicorns: number };
export type MiniLeagueTableRowWithAvatar = MiniLeagueTableRow & { avatar_url?: string | null };

function CompactRow({
  isPlaceholder,
  showEmptyLabelInFirstRow,
  greyedOut,
  isMyRow,
  compactPtsWidth,
  compactUnicornWidth,
  compactRowGap,
  r,
  avatarBg,
  t,
  idx,
  displayRows,
  isLightMode,
}: {
  isPlaceholder: boolean;
  showEmptyLabelInFirstRow: boolean;
  greyedOut: boolean;
  isMyRow: boolean;
  compactPtsWidth: number;
  compactUnicornWidth: number;
  compactRowGap: number;
  r: MiniLeagueTableRowWithAvatar | null;
  avatarBg: string;
  t: ReturnType<typeof useTokens>;
  idx: number;
  displayRows: Array<MiniLeagueTableRowWithAvatar | null>;
  isLightMode: boolean;
}) {
  const rowHighlightColor = isLightMode ? 'rgba(241, 245, 249, 0.9)' : 'rgba(255, 255, 255, 0.06)';
  const pulseOpacity = useSharedValue(0.75);
  useEffect(() => {
    if (!isMyRow) return;
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.65, { duration: 1400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [isMyRow, pulseOpacity]);
  const bgAnimatedStyle = useAnimatedStyle(() =>
    isMyRow ? { opacity: pulseOpacity.value } : { opacity: 1 }
  );

  const rowContent = (
    <>
      <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: avatarBg, overflow: 'hidden' }}>
        {r?.avatar_url ? <Image source={{ uri: r.avatar_url }} style={{ width: 24, height: 24 }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 4 }} />
      <TotlText style={{ width: compactPtsWidth, textAlign: 'right', fontSize: 12, color: greyedOut ? t.color.muted : t.color.text }}>
        {showEmptyLabelInFirstRow ? '—' : String(r?.score ?? '—')}
      </TotlText>
      <View style={{ width: 8 }} />
      <TotlText style={{ width: compactUnicornWidth, textAlign: 'right', fontSize: 12, color: greyedOut ? t.color.muted : t.color.text }}>
        {showEmptyLabelInFirstRow ? '—' : String(r?.unicorns ?? 0)}
      </TotlText>
    </>
  );

  const baseRowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    opacity: isPlaceholder && !showEmptyLabelInFirstRow ? 0 : greyedOut ? 0.5 : 1,
  };

  if (isMyRow) {
    return (
      <>
        <View pointerEvents={isPlaceholder ? 'none' : 'auto'} style={[baseRowStyle, { position: 'relative' }]}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: rowHighlightColor,
                borderRadius: 6,
              },
              bgAnimatedStyle,
            ]}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, zIndex: 1 }}>{rowContent}</View>
        </View>
        {idx < displayRows.length - 1 ? <View style={{ height: compactRowGap }} /> : null}
      </>
    );
  }

  return (
    <>
      <View
        pointerEvents={isPlaceholder ? 'none' : 'auto'}
        style={[baseRowStyle]}
      >
        {rowContent}
      </View>
      {idx < displayRows.length - 1 ? <View style={{ height: compactRowGap }} /> : null}
    </>
  );
}

export default function MiniLeagueCard({
  title,
  avatarUri,
  gwIsLive,
  winnerChip,
  rows,
  submittedUserIds = [],
  width = 320,
  emptyLabel = 'No table yet.',
  fixedRowCount,
  compact = false,
  currentUserId = null,
  myRank = null,
  submittedCount = null,
  totalMembers = null,
  hideHeaderIndicators = false,
}: {
  title: string;
  avatarUri: string | null;
  gwIsLive: boolean;
  winnerChip: string | null;
  rows: MiniLeagueTableRowWithAvatar[];
  /** IDs of users who have submitted; others are greyed out. */
  submittedUserIds?: string[];
  width?: number;
  emptyLabel?: string;
  /**
   * When provided, the card will always reserve space for this many rows.
   * Useful for keeping live cards a consistent height even when fewer rows are available.
   */
  fixedRowCount?: number;
  /** Compact mode: mini table with avatars (no names), Pts, unicorn. */
  compact?: boolean;
  /** When provided, the current user's row gets a light grey bar highlight (compact only). */
  currentUserId?: string | null;
  /** Current user's rank (1-based). Shown in expanded header when provided. */
  myRank?: number | null;
  /** Submitted count for "X/Y submitted" in expanded header. */
  submittedCount?: number | null;
  /** Total members for "X/Y submitted" in expanded header. */
  totalMembers?: number | null;
  /** Hide rank and "All submitted" row in expanded header (e.g. for Live ML cards). */
  hideHeaderIndicators?: boolean;
}) {
  const t = useTokens();
  const layoutTransition = React.useMemo(
    () => LinearTransition.duration(200).easing(Easing.out(Easing.cubic)),
    []
  );
  // Column sizing tuned to match the Figma spec (right-aligned numbers).
  const ptsColWidth = 44;
  const unicornColWidth = 28;
  const rowGap = 16;
  const avatarBg = t.color.surface2;
  const isLightMode = t.color.background.toLowerCase() === '#f8fafc';
  const CARD_HEIGHT = compact || !fixedRowCount ? undefined : 330;
  const CARD_RADIUS = 16;
  const CARD_BORDER = t.color.border;

  const displayRows: Array<MiniLeagueTableRowWithAvatar | null> = React.useMemo(() => {
    if (!fixedRowCount) return rows;
    const out: Array<MiniLeagueTableRowWithAvatar | null> = [];
    for (let i = 0; i < fixedRowCount; i++) out.push(rows[i] ?? null);
    return out;
  }, [fixedRowCount, rows]);

  const submittedSet = React.useMemo(() => new Set(submittedUserIds.map(String)), [submittedUserIds]);

  function ordinal(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n}st`;
    if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
    if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
    return `${n}th`;
  }
  const rankLabel = typeof myRank === 'number' && Number.isFinite(myRank) ? ordinal(Math.max(1, Math.round(myRank))) : null;
  const hasSubmittedInfo =
    typeof submittedCount === 'number' &&
    Number.isFinite(submittedCount) &&
    typeof totalMembers === 'number' &&
    Number.isFinite(totalMembers) &&
    totalMembers > 0;
  const allSubmitted = hasSubmittedInfo && submittedCount === totalMembers;
  const submittedLabel = hasSubmittedInfo
    ? allSubmitted
      ? 'All submitted'
      : `${submittedCount}/${totalMembers} submitted`
    : null;
  const showHeaderIndicators = !compact && !hideHeaderIndicators && (rankLabel != null || submittedLabel != null);

  if (compact) {
    const compactPtsWidth = 28;
    const compactUnicornWidth = 22;
    const compactRowGap = 8;
    return (
      <Animated.View layout={layoutTransition}>
      <Card
        style={{
          width,
          padding: 12,
          borderRadius: CARD_RADIUS,
          backgroundColor: t.color.surface,
          borderWidth: 1,
          borderColor: CARD_BORDER,
          ...(isLightMode ? { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 } : null),
        }}
      >
        <View style={{ marginBottom: 8 }}>
          <TotlText numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, color: t.color.text }}>
            {title}
          </TotlText>
        </View>
        <View style={{ height: 1, backgroundColor: t.color.border, marginBottom: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ flex: 1 }} />
          <TotlText style={{ width: compactPtsWidth, textAlign: 'right', fontSize: 11, color: t.color.muted }}>Pts</TotlText>
          <View style={{ width: 8 }} />
          <TotlText style={{ width: compactUnicornWidth, textAlign: 'right', fontSize: 11, color: t.color.text }}>🦄</TotlText>
        </View>
        {displayRows.length ? (
          displayRows.map((r, idx) => {
            const isPlaceholder = r === null;
            const showEmptyLabelInFirstRow = !!fixedRowCount && rows.length === 0 && idx === 0;
            const greyedOut = r && submittedUserIds.length > 0 && !submittedSet.has(String(r.user_id));
            const isMyRow = currentUserId && r?.user_id && String(r.user_id) === String(currentUserId);
            return (
              <CompactRow
                key={r?.user_id ?? `placeholder-${idx}`}
                isPlaceholder={isPlaceholder}
                showEmptyLabelInFirstRow={showEmptyLabelInFirstRow}
                greyedOut={!!greyedOut}
                isMyRow={!!isMyRow}
                compactPtsWidth={compactPtsWidth}
                compactUnicornWidth={compactUnicornWidth}
                compactRowGap={compactRowGap}
                r={r}
                avatarBg={avatarBg}
                t={t}
                idx={idx}
                displayRows={displayRows}
                isLightMode={isLightMode}
              />
            );
          })
        ) : (
          <TotlText variant="muted" style={{ fontSize: 11 }}>{emptyLabel}</TotlText>
        )}
      </Card>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={layoutTransition}>
    <Card
      style={{
        width,
        ...(CARD_HEIGHT != null ? { height: CARD_HEIGHT } : {}),
        padding: 20,
        borderRadius: CARD_RADIUS,
        backgroundColor: t.color.surface,
        borderWidth: 1,
        borderColor: CARD_BORDER,
        ...(isLightMode
          ? {
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: 0,
            }
          : null),
      }}
    >
      {/* Header (Figma: 54px avatar + 18px title) */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 999,
              backgroundColor: avatarBg,
              overflow: 'hidden',
            }}
          >
            {avatarUri ? <Image source={{ uri: avatarUri }} style={{ width: 54, height: 54 }} /> : null}
          </View>
          <View style={{ width: 16 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <TotlText numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 18, color: t.color.text }}>
              {title}
            </TotlText>
            {showHeaderIndicators ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 }}>
                {rankLabel != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="medal-outline" size={14} color={t.color.muted} />
                    <TotlText style={{ fontSize: 14, lineHeight: 14, color: t.color.text, fontFamily: t.font.medium }}>
                      {rankLabel}
                    </TotlText>
                  </View>
                ) : null}
                {submittedLabel ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons
                      name={allSubmitted ? 'checkmark-circle' : 'checkmark-done-outline'}
                      size={14}
                      color={allSubmitted ? t.color.brand : t.color.muted}
                    />
                    <TotlText
                      style={{
                        fontSize: 14,
                        lineHeight: 14,
                        color: allSubmitted ? t.color.brand : t.color.muted,
                        fontFamily: t.font.medium,
                      }}
                    >
                      {submittedLabel}
                    </TotlText>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

      <View style={{ height: 16 }} />

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: t.color.border }} />

      <View style={{ height: 16 }} />

      {/* Column headers (right aligned) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
        <View style={{ flex: 1 }} />
        <TotlText style={{ width: ptsColWidth, textAlign: 'right', fontSize: 14, color: t.color.muted }}>Pts</TotlText>
        <>
          <View style={{ width: 20 }} />
          <TotlText style={{ width: unicornColWidth, textAlign: 'right', fontSize: 14, color: t.color.text }}>🦄</TotlText>
        </>
          </View>

      <View style={{ height: 16 }} />

      {/* Rows */}
      {displayRows.length ? (
        displayRows.map((r, idx) => {
          const isPlaceholder = r === null;
          const showEmptyLabelInFirstRow = !!fixedRowCount && rows.length === 0 && idx === 0;
          const greyedOut = r && submittedUserIds.length > 0 && !submittedSet.has(String(r.user_id));

          return (
            <React.Fragment key={r?.user_id ?? `placeholder-${idx}`}>
              <View
                pointerEvents={isPlaceholder ? 'none' : 'auto'}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'stretch',
                  opacity: isPlaceholder && !showEmptyLabelInFirstRow ? 0 : greyedOut ? 0.5 : 1,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    backgroundColor: avatarBg,
                    overflow: 'hidden',
                  }}
                >
                  {r?.avatar_url ? <Image source={{ uri: r.avatar_url }} style={{ width: 30, height: 30 }} /> : null}
            </View>
                <View style={{ width: 12 }} />

                <TotlText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    fontSize: 14,
                    color: showEmptyLabelInFirstRow ? t.color.muted : greyedOut ? t.color.muted : t.color.text,
                    flex: 1,
                  }}
                >
                  {showEmptyLabelInFirstRow ? emptyLabel : r?.name ?? '—'}
                </TotlText>

                <TotlText style={{ width: ptsColWidth, textAlign: 'right', fontSize: 14, color: greyedOut ? t.color.muted : t.color.text }}>
                  {showEmptyLabelInFirstRow ? '—' : String(r?.score ?? '—')}
                </TotlText>
                <>
                  <View style={{ width: 20 }} />
                  <TotlText style={{ width: unicornColWidth, textAlign: 'right', fontSize: 14, color: greyedOut ? t.color.muted : t.color.text }}>
                    {showEmptyLabelInFirstRow ? '—' : String(r?.unicorns ?? 0)}
                  </TotlText>
                </>
              </View>
              {idx < displayRows.length - 1 ? <View style={{ height: rowGap }} /> : null}
            </React.Fragment>
          );
        })
        ) : (
            <TotlText variant="muted">{emptyLabel}</TotlText>
        )}
    </Card>
    </Animated.View>
  );
}

