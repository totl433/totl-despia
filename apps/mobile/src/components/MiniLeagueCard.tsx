import React from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, TotlText, useTokens } from '@totl/ui';
import WinnerShimmer from './WinnerShimmer';

export type MiniLeagueTableRow = { user_id: string; name: string; score: number; unicorns: number };

export default function MiniLeagueCard({
  title,
  avatarUri,
  gwIsLive,
  winnerChip,
  rows,
  showUnicorns,
  emptyLabel = 'No table yet.',
}: {
  title: string;
  avatarUri: string | null;
  gwIsLive: boolean;
  winnerChip: string | null;
  rows: MiniLeagueTableRow[];
  showUnicorns: boolean;
  emptyLabel?: string;
}) {
  const t = useTokens();

  return (
    <Card style={{ width: 320, padding: 0 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 47,
              height: 47,
              borderRadius: 999,
              backgroundColor: t.color.surface2,
              borderWidth: 1,
              borderColor: t.color.border,
              overflow: 'hidden',
              marginRight: 10,
            }}
          >
            {avatarUri ? <Image source={{ uri: avatarUri }} style={{ width: 47, height: 47 }} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {gwIsLive ? (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: '#DC2626',
                    marginRight: 8,
                  }}
                />
              ) : null}
              <TotlText variant="body" numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: '800', flexShrink: 1 }}>
                {title}
              </TotlText>
            </View>

            {/* Winner / draw chip */}
            {winnerChip && !gwIsLive ? (
              <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                <LinearGradient
                  colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: t.radius.pill,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                  <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
                  <TotlText variant="caption" style={{ color: '#FFFFFF', fontWeight: '900' }}>
                    {winnerChip.length > 18 ? `${winnerChip.slice(0, 18)}…` : winnerChip}
                  </TotlText>
                </LinearGradient>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Table */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            borderTopWidth: 1,
            borderTopColor: 'rgba(148,163,184,0.14)',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(148,163,184,0.14)',
          }}
        >
          <View style={{ width: 24 }} />
          <TotlText variant="caption" style={{ flex: 1, color: t.color.muted, fontWeight: '700' }}>
            Player
          </TotlText>
          <TotlText variant="caption" style={{ width: 56, textAlign: 'right', color: t.color.muted, fontWeight: '700' }}>
            Score
          </TotlText>
          {showUnicorns ? (
            <TotlText variant="caption" style={{ width: 36, textAlign: 'right', color: t.color.muted, fontWeight: '700' }}>
              🦄
            </TotlText>
          ) : null}
        </View>

        {rows.length ? (
          rows.map((r, rowIdx) => (
            <View
              key={r.user_id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: rowIdx === rows.length - 1 ? 0 : 1,
                borderBottomColor: 'rgba(148,163,184,0.12)',
              }}
            >
              <TotlText variant="caption" style={{ width: 24, fontWeight: '700', color: t.color.muted }}>
                {rowIdx + 1}
              </TotlText>
              <TotlText variant="caption" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
                {r.name}
              </TotlText>
              <TotlText variant="caption" style={{ width: 56, textAlign: 'right', color: t.color.brand, fontWeight: '900' }}>
                {r.score}
              </TotlText>
              {showUnicorns ? (
                <TotlText variant="caption" style={{ width: 36, textAlign: 'right' }}>
                  {r.unicorns}
                </TotlText>
              ) : null}
            </View>
          ))
        ) : (
          <View style={{ paddingVertical: 12 }}>
            <TotlText variant="muted">{emptyLabel}</TotlText>
          </View>
        )}
      </View>
    </Card>
  );
}

