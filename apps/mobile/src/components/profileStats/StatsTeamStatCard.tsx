import React from 'react';
import { Image, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';

export default function StatsTeamStatCard({
  eyebrow,
  teamCode,
  teamName,
  percentage,
  valueTone,
}: {
  eyebrow: string;
  teamCode: string | null | undefined;
  teamName: string;
  percentage: number | null | undefined;
  valueTone: 'success' | 'danger';
}) {
  const t = useTokens();
  const code = normalizeTeamCode(teamCode);
  const badge = code && TEAM_BADGES[code] ? TEAM_BADGES[code] : null;

  const pctColor = valueTone === 'success' ? '#059669' : '#DC2626';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 4,
      }}
    >
      {badge ? (
        <Image source={badge} style={{ width: 44, height: 44 }} resizeMode="contain" />
      ) : (
        <View style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <TotlText variant="muted" style={{ fontWeight: '900', fontSize: 12 }}>
            {(teamName ?? '?').slice(0, 3).toUpperCase()}
          </TotlText>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <TotlText variant="muted" style={{ fontSize: 13, fontWeight: '600' }}>
          {eyebrow}
        </TotlText>
        <View
          style={{
            marginTop: 4,
            flexDirection: 'row',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <TotlText style={{ fontSize: 19, fontWeight: '900', color: t.color.text, flexShrink: 1 }} numberOfLines={2}>
            {teamName || '—'}
          </TotlText>
          {typeof percentage === 'number' ? (
            <TotlText style={{ fontSize: 18, fontWeight: '900', color: pctColor }}>
              {`${percentage.toFixed(0)}%`}
            </TotlText>
          ) : null}
        </View>
      </View>
    </View>
  );
}
