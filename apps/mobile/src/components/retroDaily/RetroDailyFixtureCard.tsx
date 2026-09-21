import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Card, TotlText, useTokens } from '@totl/ui';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { getTeamColor, normalizeTeamCode } from '../../lib/teamColors';
import { ordinal } from '../../lib/retroDaily/buildPuzzle';
import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';

const STROKE = 10;

/**
 * Fixture face for Retro Totl Daily (no form pips — era may predate reliable form).
 * Temporary: shows final-table finish under each team so difficulty ramp can be verified.
 */
export default function RetroDailyFixtureCard({ fixture }: { fixture: RetroFixture }) {
  const t = useTokens();
  const home = normalizeTeamCode(fixture.homeCode);
  const away = normalizeTeamCode(fixture.awayCode);
  const homeBadge = TEAM_BADGES[home] ?? null;
  const awayBadge = TEAM_BADGES[away] ?? null;
  const homeColor = getTeamColor(home, fixture.homeName);
  const awayColor = getTeamColor(away, fixture.awayName);
  const gap =
    fixture.homeFinish != null && fixture.awayFinish != null
      ? Math.abs(fixture.homeFinish - fixture.awayFinish)
      : null;

  return (
    <Card
      style={{
        flex: 1,
        padding: 0,
        borderRadius: 28,
        borderWidth: 0,
        overflow: 'hidden',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      }}
    >
      <View style={{ paddingTop: 14, paddingHorizontal: 18, paddingBottom: 18, backgroundColor: '#FFFFFF' }}>
        <TotlText variant="muted" style={{ fontWeight: '700', color: '#64748B', textAlign: 'center' }}>
          {fixture.kickoffLabel}
        </TotlText>
        {gap != null ? (
          <TotlText
            style={{
              marginTop: 4,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: '700',
              color: '#94A3B8',
            }}
          >
            Gap {gap} · debug ranks
          </TotlText>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {homeBadge ? (
              <Image source={homeBadge} style={{ width: 88, height: 88 }} resizeMode="contain" />
            ) : (
              <Monogram code={home} color={homeColor} />
            )}
            <TotlText style={{ marginTop: 8, fontWeight: '900', color: t.color.text, textAlign: 'center' }} numberOfLines={2}>
              {fixture.homeName}
            </TotlText>
            <FinishLabel finish={fixture.homeFinish} />
          </View>

          <View style={{ width: 18 }} />

          <View style={{ flex: 1, alignItems: 'center' }}>
            {awayBadge ? (
              <Image source={awayBadge} style={{ width: 88, height: 88 }} resizeMode="contain" />
            ) : (
              <Monogram code={away} color={awayColor} />
            )}
            <TotlText style={{ marginTop: 8, fontWeight: '900', color: t.color.text, textAlign: 'center' }} numberOfLines={2}>
              {fixture.awayName}
            </TotlText>
            <FinishLabel finish={fixture.awayFinish} />
          </View>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 140, overflow: 'hidden' }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
          <Polygon points="0,0 0,100 100,100" fill={homeColor} />
          <Polygon points="0,0 100,0 100,100" fill={awayColor} />
        </Svg>
        <View
          style={{
            position: 'absolute',
            inset: STROKE,
            borderRadius: 18,
            backgroundColor: 'transparent',
          }}
        />
      </View>
    </Card>
  );
}

function FinishLabel({ finish }: { finish: number | null }) {
  if (finish == null) return null;
  return (
    <TotlText
      style={{
        marginTop: 2,
        fontSize: 12,
        fontWeight: '800',
        color: '#0F766E',
        textAlign: 'center',
      }}
    >
      {ordinal(finish)}
    </TotlText>
  );
}

function Monogram({ code, color }: { code: string; color: string }) {
  return (
    <View
      style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 22 }}>{(code || '?').slice(0, 3)}</TotlText>
    </View>
  );
}
