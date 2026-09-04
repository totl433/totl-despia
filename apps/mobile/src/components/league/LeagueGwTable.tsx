import React from 'react';
import { Image, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';
import { assignCompetitionRanks, formatCompetitionRank } from '../../lib/competitionRanks';
import UnicornIcon from '../icons/UnicornIcon';

export type LeagueGwTableRow = {
  user_id: string;
  name: string;
  score: number;
  unicorns: number;
  avatar_url?: string | null;
  avatar_bg_color?: string | null;
};

const AVATAR_SIZE = 20;
const ROW_HEIGHT = 42;

function initial1(name: string): string {
  const s = name.trim();
  if (!s) return '?';
  return s.slice(0, 1).toUpperCase();
}

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
  const submittedSet = React.useMemo(() => new Set(submittedUserIds.map(String)), [submittedUserIds]);

  const ranked = React.useMemo(
    () =>
      assignCompetitionRanks(
        rows,
        (a, b) => a.score === b.score && a.unicorns === b.unicorns,
        (r) => submittedSet.size === 0 || submittedSet.has(String(r.user_id))
      ),
    [rows, submittedSet]
  );

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
          <View style={{ width: 32 }} />
          <TotlText variant="caption" style={{ flex: 1, color: t.color.muted, fontWeight: '700' }}>
            Player
          </TotlText>
          <TotlText variant="caption" style={{ width: 56, textAlign: 'right', color: t.color.muted, fontWeight: '700' }}>
            Score
          </TotlText>
          {showUnicorns ? (
            <View style={{ width: 36, alignItems: 'flex-end', justifyContent: 'center' }}>
              <UnicornIcon size={17} color={t.color.muted} />
            </View>
          ) : null}
        </View>

        {rows.length ? (
          rows.map((r, rowIdx) => {
            const submitted = submittedSet.size === 0 || submittedSet.has(String(r.user_id));
            const greyedOut = !submitted;
            const standing = ranked[rowIdx] ?? { rank: null, tied: false };
            return (
              <View
                key={`${r.user_id}-${rowIdx}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: ROW_HEIGHT,
                  borderBottomWidth: rowIdx === rows.length - 1 ? 0 : 1,
                  borderBottomColor: 'rgba(148,163,184,0.12)',
                  opacity: greyedOut ? 0.5 : 1,
                }}
              >
                <TotlText variant="caption" style={{ width: 32, fontWeight: '700', color: t.color.muted }}>
                  {formatCompetitionRank(standing.rank, standing.tied)}
                </TotlText>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                  <View
                    style={{
                      width: AVATAR_SIZE,
                      height: AVATAR_SIZE,
                      borderRadius: 999,
                      backgroundColor: r.avatar_url ? t.color.surface2 : (r.avatar_bg_color ?? t.color.surface2),
                      borderWidth: 1,
                      borderColor: t.color.border,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 6,
                    }}
                  >
                    {r.avatar_url ? (
                      <Image source={{ uri: r.avatar_url }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }} />
                    ) : (
                      <TotlText variant="caption" style={{ fontFamily: t.font.medium, fontSize: 10 }}>
                        {initial1(r.name)}
                      </TotlText>
                    )}
                  </View>
                  <TotlText variant="caption" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>
                    {r.name}
                  </TotlText>
                </View>
                <TotlText
                  variant="caption"
                  style={{ width: 56, textAlign: 'right', color: t.color.brand, fontWeight: '900' }}
                >
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
