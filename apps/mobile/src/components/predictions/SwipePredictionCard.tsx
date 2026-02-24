import React from 'react';
import { Image, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Polygon, Rect, SvgUri } from 'react-native-svg';
import { Card, TotlText, useTokens } from '@totl/ui';
import type { Fixture } from '@totl/domain';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { getMediumName } from '../../../../../src/lib/teamNames';
import { getTeamColor, normalizeTeamCode } from '../../lib/teamColors';
import { getStripedPatternFallbackColor, getTeamPatternUri, hasStripedPattern } from '../../lib/teamPatterns';
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
  const homeBadge = TEAM_BADGES[homeCode] ?? null;
  const awayBadge = TEAM_BADGES[awayCode] ?? null;

  const homeKey = String(fixture.home_team ?? fixture.home_name ?? homeCode ?? 'Home');
  const awayKey = String(fixture.away_team ?? fixture.away_name ?? awayCode ?? 'Away');
  const homeName = getMediumName(homeKey);
  const awayName = getMediumName(awayKey);

  const kickoffLabel = formatKickoffLabel(fixture.kickoff_time ?? null);
  const homeColor = getTeamColor(homeCode, fixture.home_name ?? fixture.home_team ?? null);
  const awayColor = getTeamColor(awayCode, fixture.away_name ?? fixture.away_team ?? null);
  const homePatternUri = getTeamPatternUri(homeCode);
  const awayPatternUri = getTeamPatternUri(awayCode);
  const homeHasStripes = hasStripedPattern(homeCode);
  const awayHasStripes = hasStripedPattern(awayCode);
  const bothHaveStripes = homeHasStripes && awayHasStripes;
  const awaySolidColor = bothHaveStripes ? getStripedPatternFallbackColor(awayCode) : null;
  const finalAwayPatternUri = bothHaveStripes ? null : awayPatternUri;
  const [diagonalAngle, setDiagonalAngle] = React.useState(45);
  // Match Despia/web behavior:
  // - striped patterns use fixed 35deg
  // - non-striped follow card diagonal
  // - away side offset by +45deg
  const homeAngle = homeHasStripes ? STRIPE_ANGLE : diagonalAngle;
  const awayAngle = awayHasStripes ? STRIPE_ANGLE : diagonalAngle + 45;
  const homeScale = homeHasStripes ? 1 : 1.85;
  const awayScale = awayHasStripes ? 1 : 1.85;
  const homeStripe = STRIPE_COLORS[homeCode] ?? { primary: '#111111', secondary: '#F3F4F6' };
  const awayStripe = STRIPE_COLORS[awayCode] ?? { primary: '#111111', secondary: '#F3F4F6' };
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
        }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            const nextAngle = (Math.atan2(height, width) * 180) / Math.PI;
            setDiagonalAngle(nextAngle);
          }
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <ClipPath id="homeClip">
              <Polygon points="0,0 0,100 100,100" />
            </ClipPath>
            <ClipPath id="awayClip">
              <Polygon points="0,0 100,0 100,100" />
            </ClipPath>
          </Defs>

          {homeHasStripes ? (
            <G clipPath="url(#homeClip)">
              <Rect x={0} y={0} width={100} height={100} fill={homeStripe.secondary} />
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
          ) : homePatternUri ? (
            <G clipPath="url(#homeClip)">
              <G transform={`translate(50 50) rotate(${homeAngle}) scale(${homeScale}) translate(-50 -50)`}>
                <SvgUri uri={homePatternUri} x={0} y={0} width={100} height={100} />
              </G>
            </G>
          ) : (
            <Polygon points="0,0 0,100 100,100" fill={homeColor} />
          )}

          {awayHasStripes && !bothHaveStripes ? (
            <G clipPath="url(#awayClip)">
              <Rect x={0} y={0} width={100} height={100} fill={awayStripe.secondary} />
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
          ) : finalAwayPatternUri ? (
            <G clipPath="url(#awayClip)">
              <G transform={`translate(50 50) rotate(${awayAngle}) scale(${awayScale}) translate(-50 -50)`}>
                <SvgUri uri={finalAwayPatternUri} x={0} y={0} width={100} height={100} />
              </G>
            </G>
          ) : (
            <Polygon points="0,0 100,0 100,100" fill={awaySolidColor ?? awayColor} />
          )}
        </Svg>
      </View>
    </Card>
  );
}

export default React.memo(SwipePredictionCard);

