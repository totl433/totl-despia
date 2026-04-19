import React from 'react';
import { Image, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Polygon, Rect } from 'react-native-svg';
import { Card, TotlText, useTokens } from '@totl/ui';
import type { Fixture } from '@totl/domain';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { getMediumName } from '../../../../../src/lib/teamNames';
import { getTeamColor, normalizeTeamCode } from '../../lib/teamColors';
import { getStripedPatternFallbackColor, hasStripedPattern } from '../../lib/teamPatterns';
import { formatLocalDateTimeLabel } from '../../lib/dateTime';

function formatKickoffLabel(kickoff: string | null | undefined): string | null {
  return formatLocalDateTimeLabel(kickoff);
}

function FormDots({ form }: { form: string | null | undefined }) {
  const dots = React.useMemo(() => {
    const raw = (form ?? '').trim().toUpperCase();
    const lastFive = (raw || '?????').slice(-5).padStart(5, '?');
    return lastFive.split('');
  }, [form]);

  const dotColor = (c: string) => {
    if (c === 'W') return '#10B981'; // emerald-500
    if (c === 'L') return '#DC2626'; // red-600
    return '#D1D5DB'; // gray-300 (draw/unknown)
  };

  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
      {dots.map((c, i) => (
        <View key={`${c}-${i}`} style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: dotColor(c) }} />
      ))}
    </View>
  );
}

const STRIPE_COLORS: Record<string, { primary: string; secondary: string }> = {
  BOU: { primary: '#DA291C', secondary: '#111111' },
  BRE: { primary: '#E30613', secondary: '#F7F7F7' },
  BHA: { primary: '#0057B8', secondary: '#F7F7F7' },
  CRY: { primary: '#1B458F', secondary: '#C4122E' },
  NEW: { primary: '#101010', secondary: '#F3F4F6' },
  SUN: { primary: '#E03A3E', secondary: '#F7F7F7' },
};

const STRIPE_ANGLE = 35;
const STRIPE_BAND_WIDTH = 14;
const STRIPE_BAND_STEP = 28;
const DEFAULT_DIAGONAL_ANGLE = 34;

function SwipePredictionCard({
  fixture,
  homeForm,
  awayForm,
  showSwipeHint = true,
}: {
  fixture: Fixture;
  homeForm?: string | null;
  awayForm?: string | null;
  showSwipeHint?: boolean;
}) {
  const t = useTokens();
  const homeCode = normalizeTeamCode(fixture.home_code);
  const awayCode = normalizeTeamCode(fixture.away_code);
  const clipPathBaseId = React.useMemo(() => {
    const raw = String(fixture.id ?? fixture.fixture_index ?? `${homeCode}-${awayCode}`) || 'fixture';
    return `prediction-card-${raw.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }, [awayCode, fixture.fixture_index, fixture.id, homeCode]);
  const homeBadge = TEAM_BADGES[homeCode] ?? null;
  const awayBadge = TEAM_BADGES[awayCode] ?? null;

  const homeKey = String(fixture.home_team ?? fixture.home_name ?? homeCode ?? 'Home');
  const awayKey = String(fixture.away_team ?? fixture.away_name ?? awayCode ?? 'Away');
  const homeName = getMediumName(homeKey);
  const awayName = getMediumName(awayKey);

  const kickoffLabel = formatKickoffLabel(fixture.kickoff_time ?? null);
  const homeColor = getTeamColor(homeCode, fixture.home_name ?? fixture.home_team ?? null);
  const awayColor = getTeamColor(awayCode, fixture.away_name ?? fixture.away_team ?? null);
  const homeHasStripes = hasStripedPattern(homeCode);
  const awayHasStripes = hasStripedPattern(awayCode);
  const bothHaveStripes = homeHasStripes && awayHasStripes;
  const awaySolidColor = bothHaveStripes ? getStripedPatternFallbackColor(awayCode) : null;
  // Keep striped clubs visually distinct, but use synchronous fills
  // for everyone else so the card can promote to the top layer without
  // waiting on asset URI SVG parsing.
  const homeAngle = homeHasStripes ? STRIPE_ANGLE : DEFAULT_DIAGONAL_ANGLE;
  const awayAngle = awayHasStripes ? STRIPE_ANGLE : DEFAULT_DIAGONAL_ANGLE + 45;
  const homeStripe = STRIPE_COLORS[homeCode] ?? { primary: '#111111', secondary: '#F3F4F6' };
  const awayStripe = STRIPE_COLORS[awayCode] ?? { primary: '#111111', secondary: '#F3F4F6' };
  const homeClipId = `${clipPathBaseId}-home`;
  const awayClipId = `${clipPathBaseId}-away`;
  const stripeBandOffsets = React.useMemo(
    () => Array.from({ length: 32 }, (_, i) => -260 + i * STRIPE_BAND_STEP),
    []
  );

  return (
    <Card
      style={{
        flex: 1,
        padding: 0,
        borderRadius: 28,
        borderWidth: 0,
        borderColor: 'transparent',
        overflow: 'hidden',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      }}
    >
      <View style={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: 18, backgroundColor: '#FFFFFF' }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <TotlText variant="muted" style={{ fontWeight: '700', color: '#64748B', textAlign: 'center' }}>
            {kickoffLabel ?? 'TBD'}
          </TotlText>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {homeBadge ? <Image source={homeBadge} style={{ width: 104, height: 104 }} /> : null}
            <TotlText style={{ marginTop: 8, fontWeight: '900', color: t.color.text }} numberOfLines={2}>
              {homeName}
            </TotlText>
            <FormDots form={homeForm} />
          </View>

          <View style={{ width: 18 }} />

          <View style={{ flex: 1, alignItems: 'center' }}>
            {awayBadge ? <Image source={awayBadge} style={{ width: 104, height: 104 }} /> : null}
            <TotlText style={{ marginTop: 8, fontWeight: '900', color: t.color.text }} numberOfLines={2}>
              {awayName}
            </TotlText>
            <FormDots form={awayForm} />
          </View>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          minHeight: 160,
          backgroundColor: '#EEF4F3',
          overflow: 'hidden',
        }}
      >
        <Svg
          width="102%"
          height="102%"
          viewBox="-1 -1 102 102"
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: -1, left: -1 }}
        >
          <Defs>
            <ClipPath id={homeClipId}>
              <Polygon points="-2,-2 -2,102 102,102" />
            </ClipPath>
            <ClipPath id={awayClipId}>
              <Polygon points="-2,-2 102,-2 102,102" />
            </ClipPath>
          </Defs>

          {homeHasStripes ? (
            <G clipPath={`url(#${homeClipId})`}>
              <Rect x={-2} y={-2} width={104} height={104} fill={homeStripe.secondary} />
              <G transform={`translate(50 50) rotate(${homeAngle}) translate(-50 -50)`}>
                {stripeBandOffsets.map((x) => (
                  <Rect
                    key={`home-stripe-${x}`}
                    x={x}
                    y={-220}
                    width={STRIPE_BAND_WIDTH}
                    height={540}
                    fill={homeStripe.primary}
                  />
                ))}
              </G>
            </G>
          ) : (
            <Polygon points="-2,-2 -2,102 102,102" fill={homeColor} />
          )}

          {awayHasStripes && !bothHaveStripes ? (
            <G clipPath={`url(#${awayClipId})`}>
              <Rect x={-2} y={-2} width={104} height={104} fill={awayStripe.secondary} />
              <G transform={`translate(50 50) rotate(${awayAngle}) translate(-50 -50)`}>
                {stripeBandOffsets.map((x) => (
                  <Rect
                    key={`away-stripe-${x}`}
                    x={x}
                    y={-220}
                    width={STRIPE_BAND_WIDTH}
                    height={540}
                    fill={awayStripe.primary}
                  />
                ))}
              </G>
            </G>
          ) : (
            <Polygon points="-2,-2 102,-2 102,102" fill={awaySolidColor ?? awayColor} />
          )}
        </Svg>
      </View>
    </Card>
  );
}

export default React.memo(SwipePredictionCard);

