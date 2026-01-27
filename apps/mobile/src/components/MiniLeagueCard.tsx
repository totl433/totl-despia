import React from 'react';
import { Image, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

export type MiniLeagueTableRow = { user_id: string; name: string; score: number; unicorns: number };
export type MiniLeagueTableRowWithAvatar = MiniLeagueTableRow & { avatar_url?: string | null };

export default function MiniLeagueCard({
  title,
  avatarUri,
  gwIsLive,
  winnerChip,
  rows,
  width = 320,
  emptyLabel = 'No table yet.',
  fixedRowCount,
}: {
  title: string;
  avatarUri: string | null;
  gwIsLive: boolean;
  winnerChip: string | null;
  rows: MiniLeagueTableRowWithAvatar[];
  width?: number;
  emptyLabel?: string;
  /**
   * When provided, the card will always reserve space for this many rows.
   * Useful for keeping live cards a consistent height even when fewer rows are available.
   */
  fixedRowCount?: number;
}) {
  const t = useTokens();
  // Column sizing tuned to match the Figma spec (right-aligned numbers).
  const ptsColWidth = 44;
  const unicornColWidth = 28;
  const rowGap = 16;
  const avatarBg = t.color.surface2;
  const isLightMode = t.color.background.toLowerCase() === '#f8fafc';

  const displayRows: Array<MiniLeagueTableRowWithAvatar | null> = React.useMemo(() => {
    if (!fixedRowCount) return rows;
    const out: Array<MiniLeagueTableRowWithAvatar | null> = [];
    for (let i = 0; i < fixedRowCount; i++) out.push(rows[i] ?? null);
    return out;
  }, [fixedRowCount, rows]);

  return (
    <Card
      style={{
        width,
        padding: 20,
        borderRadius: 16,
        backgroundColor: t.color.surface,
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
        <TotlText numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 18, color: t.color.text, flex: 1 }}>
          {title}
        </TotlText>
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

          return (
            <React.Fragment key={r?.user_id ?? `placeholder-${idx}`}>
              <View
                pointerEvents={isPlaceholder ? 'none' : 'auto'}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'stretch',
                  opacity: isPlaceholder && !showEmptyLabelInFirstRow ? 0 : 1,
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
                    color: showEmptyLabelInFirstRow ? t.color.muted : t.color.text,
                    flex: 1,
                  }}
                >
                  {showEmptyLabelInFirstRow ? emptyLabel : r?.name ?? '—'}
                </TotlText>

                <TotlText style={{ width: ptsColWidth, textAlign: 'right', fontSize: 14, color: t.color.text }}>
                  {showEmptyLabelInFirstRow ? '—' : String(r?.score ?? '—')}
                </TotlText>
                <>
                  <View style={{ width: 20 }} />
                  <TotlText style={{ width: unicornColWidth, textAlign: 'right', fontSize: 14, color: t.color.text }}>
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
  );
}

