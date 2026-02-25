import React from 'react';
import { View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

import LeagueFormDisplay, { type LeagueFormLetter } from './LeagueFormDisplay';

export type LeagueSeasonRow = {
  user_id: string;
  name: string;
  mltPts: number;
  ocp: number;
  unicorns: number;
  wins: number;
  draws: number;
  form: LeagueFormLetter[];
};

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
        {/* Header */}
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
          <TotlText variant="caption" style={{ flex: 1, color: t.color.muted, fontFamily: t.font.medium }}>
            Player
          </TotlText>

          {showForm ? (
            <TotlText variant="caption" style={{ width: 150, color: t.color.muted, fontFamily: t.font.medium }}>
              Form
            </TotlText>
          ) : (
            <>
              <TotlText variant="caption" style={{ width: 28, textAlign: 'center', color: t.color.muted, fontFamily: t.font.medium }}>
                W
              </TotlText>
              <TotlText variant="caption" style={{ width: 28, textAlign: 'center', color: t.color.muted, fontFamily: t.font.medium }}>
                D
              </TotlText>
              <TotlText variant="caption" style={{ width: 36, textAlign: 'center', color: t.color.muted, fontFamily: t.font.medium }}>
                {isLateStartingLeague ? 'CP' : 'OCP'}
              </TotlText>
              {showUnicorns ? (
                <TotlText variant="caption" style={{ width: 32, textAlign: 'center', color: t.color.muted, fontFamily: t.font.medium }}>
                  🦄
                </TotlText>
              ) : null}
              <TotlText variant="caption" style={{ width: 40, textAlign: 'right', color: t.color.muted, fontFamily: t.font.medium }}>
                PTS
              </TotlText>
            </>
          )}
        </View>

        {/* Rows */}
        {rows.map((r, idx) => (
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
            <TotlText variant="caption" style={{ width: 24, fontFamily: t.font.medium, color: t.color.muted }}>
              {idx + 1}
            </TotlText>
            <TotlText variant="caption" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
              {r.name}
            </TotlText>

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
                  style={{ width: 40, textAlign: 'right', color: t.color.brand, fontFamily: t.font.medium }}
                >
                  {r.mltPts}
                </TotlText>
              </>
            )}
          </View>
        ))}

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

