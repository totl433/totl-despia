import React from 'react';
import { View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

export type LeagueGwTableRow = { user_id: string; name: string; score: number; unicorns: number };

export default function LeagueGwTable({
  rows,
  showUnicorns,
  submittedCount,
  totalMembers,
}: {
  rows: LeagueGwTableRow[];
  showUnicorns: boolean;
  submittedCount: number | null;
  totalMembers: number | null;
}) {
  const t = useTokens();

  const allSubmitted =
    typeof submittedCount === 'number' &&
    typeof totalMembers === 'number' &&
    totalMembers > 0 &&
    submittedCount === totalMembers;

  const submittedLabel =
    typeof submittedCount === 'number' && typeof totalMembers === 'number' && totalMembers > 0
      ? allSubmitted
        ? 'All Submitted'
        : `Submitted ${submittedCount}/${totalMembers}`
      : null;

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
      {submittedLabel ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
          <TotlText variant="caption" style={{ color: allSubmitted ? t.color.brand : t.color.muted, fontWeight: '900' }}>
            {submittedLabel}
          </TotlText>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 14, paddingTop: submittedLabel ? 8 : 12, paddingBottom: 12 }}>
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
          rows.map((r, rowIdx) => {
            return (
              <View
                key={`${r.user_id}-${rowIdx}`}
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
            );
          })
        ) : (
          <View style={{ paddingVertical: 12 }}>
            <TotlText variant="muted">No table yet.</TotlText>
          </View>
        )}
      </View>
    </Card>
  );
}

