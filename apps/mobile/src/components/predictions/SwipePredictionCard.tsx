import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Card, TotlText, useTokens } from '@totl/ui';
import type { Fixture } from '@totl/domain';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { getMediumName } from '../../../../../src/lib/teamNames';
import { getTeamColor, normalizeTeamCode } from '../../lib/teamColors';

function formatKickoffLabel(kickoff: string | null | undefined): string | null {
  if (!kickoff) return null;
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return null;

  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} • ${time}`;
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

export default function SwipePredictionCard({
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TotlText variant="muted" style={{ fontWeight: '700', color: '#64748B' }}>
            {kickoffLabel ?? 'TBD'}
          </TotlText>

          {showSwipeHint ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: 'rgba(28,131,118,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(28,131,118,0.18)',
              }}
            >
              <TotlText style={{ color: '#1C8376', fontWeight: '800', fontSize: 12 }}>Swipe</TotlText>
            </View>
          ) : null}
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
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Polygon points="0,0 0,100 100,100" fill={homeColor} />
          <Polygon points="0,0 100,0 100,100" fill={awayColor} />
        </Svg>
      </View>
    </Card>
  );
}

