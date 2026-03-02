import React from 'react';
import { View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';
import { useThemePreference } from '../../context/ThemePreferenceContext';

export type LeagueGwTableRow = { user_id: string; name: string; score: number; unicorns: number };

export default function LeagueGwTable({
  rows,
  showUnicorns,
  submittedUserIds = [],
}: {
  rows: LeagueGwTableRow[];
  showUnicorns: boolean;
  submittedUserIds?: string[];
}) {
  const t = useTokens();
  const { isDark } = useThemePreference();
  const textColor = isDark ? '#F8FAFC' : t.color.text;
  const mutedColor = isDark ? '#94A3B8' : t.color.muted;
  const submittedSet = React.useMemo(() => new Set(submittedUserIds.map(String)), [submittedUserIds]);

  return (
    <Card
      style={{
        padding: 0,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      }}
    >
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(148,163,184,0.14)',
          }}
        >
          <View style={{ width: 24 }} />
          <TotlText variant="caption" style={{ flex: 1, color: textColor, fontFamily: t.font.medium }}>
            Player
          </TotlText>
          <TotlText variant="caption" style={{ width: 56, textAlign: 'right', color: textColor, fontFamily: t.font.medium }}>
            Score
          </TotlText>
          {showUnicorns ? (
            <TotlText variant="caption" style={{ width: 36, textAlign: 'right', color: textColor, fontFamily: t.font.medium }}>
              🦄
            </TotlText>
          ) : null}
        </View>

        {rows.length ? (
          rows.map((r, rowIdx) => {
            const submitted = submittedSet.has(String(r.user_id));
            const greyedOut = !submitted;
            return (
              <View
                key={`${r.user_id}-${rowIdx}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderBottomWidth: rowIdx === rows.length - 1 ? 0 : 1,
                  borderBottomColor: 'rgba(148,163,184,0.12)',
                  opacity: greyedOut ? 0.5 : 1,
                }}
              >
                <TotlText variant="caption" style={{ width: 24, fontFamily: t.font.medium, color: greyedOut ? mutedColor : textColor }}>
                  {rowIdx + 1}
                </TotlText>
                <TotlText variant="caption" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, color: greyedOut ? mutedColor : textColor }}>
                  {r.name}
                </TotlText>
                <TotlText variant="caption" style={{ width: 56, textAlign: 'right', color: greyedOut ? mutedColor : t.color.brand, fontFamily: t.font.medium }}>
                  {r.score}
                </TotlText>
                {showUnicorns ? (
                  <TotlText variant="caption" style={{ width: 36, textAlign: 'right', color: greyedOut ? mutedColor : textColor, fontFamily: t.font.medium }}>
                    {r.unicorns}
                  </TotlText>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={{ paddingVertical: 12 }}>
            <TotlText variant="caption" style={{ color: textColor }}>No table yet.</TotlText>
          </View>
        )}
      </View>
    </Card>
  );
}

