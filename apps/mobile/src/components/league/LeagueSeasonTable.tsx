import React from 'react';
import { Image, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

import { assignCompetitionRanks, formatCompetitionRank } from '../../lib/competitionRanks';
import LeagueFormDisplay, { type LeagueFormLetter } from './LeagueFormDisplay';
import UnicornIcon from '../icons/UnicornIcon';

export type LeagueSeasonRow = {
  user_id: string;
  name: string;
  mltPts: number;
  ocp: number;
  unicorns: number;
  wins: number;
  draws: number;
  form: LeagueFormLetter[];
  avatar_url?: string | null;
  avatar_bg_color?: string | null;
};

const AVATAR_SIZE = 20;

function initial1(name: string): string {
  const s = name.trim();
  if (!s) return '?';
  return s.slice(0, 1).toUpperCase();
}

export default function LeagueSeasonTable({
  rows,
  loading,
  showForm,
  showUnicorns,
  isLateStartingLeague,
}: {
  rows: LeagueSeasonRow[];
  loading: boolean;
  showForm: boolean;
  showUnicorns: boolean;
  isLateStartingLeague: boolean;
}) {
  const t = useTokens();
  const ROW_HEIGHT = 42;
  const MIN_TABLE_HEIGHT = 12 + 8 + 8 + 12 + (4 * ROW_HEIGHT) + 12; // header + rows placeholder + padding

  const ranked = React.useMemo(
    () =>
      assignCompetitionRanks(
        rows,
        (a, b) => a.mltPts === b.mltPts && a.unicorns === b.unicorns && a.ocp === b.ocp
      ),
    [rows]
  );

  return (
    <Card
      style={{
        padding: 0,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
        minHeight: loading || rows.length === 0 ? MIN_TABLE_HEIGHT : undefined,
      }}
    >
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 }}>
        {/* Header */}
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

          {showForm ? (
            <TotlText variant="caption" style={{ width: 150, color: t.color.muted, fontWeight: '700' }}>
              Form
            </TotlText>
          ) : (
            <>
              <TotlText variant="caption" style={{ width: 28, textAlign: 'center', color: t.color.muted, fontWeight: '700' }}>
                W
              </TotlText>
              <TotlText variant="caption" style={{ width: 28, textAlign: 'center', color: t.color.muted, fontWeight: '700' }}>
                D
              </TotlText>
              <TotlText variant="caption" style={{ width: 36, textAlign: 'center', color: t.color.muted, fontWeight: '700' }}>
                {isLateStartingLeague ? 'CP' : 'OCP'}
              </TotlText>
              {showUnicorns ? (
                <View style={{ width: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <UnicornIcon size={17} color={t.color.muted} />
                </View>
              ) : null}
              <TotlText variant="caption" style={{ width: 40, textAlign: 'right', color: t.color.muted, fontWeight: '700' }}>
                PTS
              </TotlText>
            </>
          )}
        </View>

        {/* Rows */}
        {rows.map((r, idx) => {
          const standing = ranked[idx] ?? { rank: null, tied: false };
          return (
            <View
              key={`${r.user_id}-${idx}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: ROW_HEIGHT,
                borderBottomWidth: idx === rows.length - 1 ? 0 : 1,
                borderBottomColor: 'rgba(148,163,184,0.12)',
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

              {showForm ? (
                <View style={{ width: 150, height: ROW_HEIGHT, alignItems: 'flex-start', justifyContent: 'center' }}>
                  <LeagueFormDisplay form={r.form} />
                </View>
              ) : (
                <>
                  <TotlText variant="caption" style={{ width: 28, textAlign: 'center' }}>
                    {r.wins}
                  </TotlText>
                  <TotlText variant="caption" style={{ width: 28, textAlign: 'center' }}>
                    {r.draws}
                  </TotlText>
                  <TotlText variant="caption" style={{ width: 36, textAlign: 'center' }}>
                    {r.ocp}
                  </TotlText>
                  {showUnicorns ? (
                    <TotlText variant="caption" style={{ width: 32, textAlign: 'center' }}>
                      {r.unicorns}
                    </TotlText>
                  ) : null}
                  <TotlText
                    variant="caption"
                    style={{ width: 40, textAlign: 'right', color: t.color.brand, fontWeight: '900' }}
                  >
                    {r.mltPts}
                  </TotlText>
                </>
              )}
            </View>
          );
        })}

        {loading ? (
          <View style={{ paddingVertical: 12 }}>
            <TotlText variant="muted">Calculating…</TotlText>
          </View>
        ) : null}

        {!loading && rows.length === 0 ? (
          <View style={{ paddingVertical: 12 }}>
            <TotlText variant="muted">No gameweeks completed yet — this will populate after the first results are saved.</TotlText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
