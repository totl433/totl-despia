import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { TotlText } from '@totl/ui';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { getTeamColor, normalizeTeamCode } from '../../lib/teamColors';
import { formatLocalDateTimeLabel } from '../../lib/dateTime';
import {
  betterSide,
  buildStatRows,
  type MatchPreviewStats,
} from '../../lib/matchPreviewStats';

const TEAL = '#1C8376';
const VALUE_COL_WIDTH = 64;
const STROKE_WIDTH = 10;

function StatPill({ value, highlight }: { value: string; highlight: boolean }) {
  return (
    <View
      style={{
        minWidth: 44,
        minHeight: 26,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: highlight ? TEAL : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TotlText
        style={{
          color: highlight ? '#FFFFFF' : '#0F172A',
          fontWeight: '700',
          fontSize: 13,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </TotlText>
    </View>
  );
}

/** Fixed-width column so values sit on one vertical centre line. */
function ValueColumn({
  value,
  highlight,
  label,
}: {
  value: string;
  highlight: boolean;
  label?: string;
}) {
  return (
    <View style={{ width: VALUE_COL_WIDTH, alignItems: 'center' }}>
      <StatPill value={value} highlight={highlight} />
      {label ? (
        <TotlText style={{ marginTop: 2, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
          {label}
        </TotlText>
      ) : null}
    </View>
  );
}

/**
 * Stats back face for prediction swipe cards (test/admin flip UX).
 */
export default function SwipePredictionStatsBack({
  stats,
  homeCode,
  awayCode,
  kickoffTime,
}: {
  stats: MatchPreviewStats;
  homeCode?: string | null;
  awayCode?: string | null;
  kickoffTime?: string | null;
}) {
  const rows = buildStatRows(stats);
  const home = normalizeTeamCode(homeCode || stats.home.teamCode);
  const away = normalizeTeamCode(awayCode || stats.away.teamCode);
  const homeBadge = TEAM_BADGES[home] ?? null;
  const awayBadge = TEAM_BADGES[away] ?? null;
  const homeColor = getTeamColor(home, stats.home.teamCode);
  const awayColor = getTeamColor(away, stats.away.teamCode);
  const kickoffLabel = formatLocalDateTimeLabel(kickoffTime);
  const h2h = stats.h2h;
  const h2hHighlight = h2h ? betterSide(h2h.homeWins, h2h.awayWins) : 'neither';

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      }}
    >
      {/* Diagonal team-colour frame (matches front-card split) */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {/* Home — bottom-left triangle */}
        <Polygon points="0,0 0,100 100,100" fill={homeColor} />
        {/* Away — top-right triangle */}
        <Polygon points="0,0 100,0 100,100" fill={awayColor} />
      </Svg>

      {/* Inner white panel = 10px internal stroke */}
      <View
        style={{
          flex: 1,
          margin: STROKE_WIDTH,
          borderRadius: 20,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 12,
          }}
        >
          <View style={{ width: VALUE_COL_WIDTH, alignItems: 'center' }}>
            {homeBadge ? (
              <Image source={homeBadge} style={{ width: 47, height: 47 }} />
            ) : (
              <View style={{ width: 47, height: 47 }} />
            )}
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 4, paddingHorizontal: 6 }}>
            {kickoffLabel ? (
              <TotlText
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: '#64748B',
                  textAlign: 'center',
                }}
              >
                {kickoffLabel}
              </TotlText>
            ) : null}
            <TotlText
              style={{
                marginTop: kickoffLabel ? 2 : 0,
                fontSize: 12,
                fontWeight: '600',
                color: '#64748B',
                textAlign: 'center',
              }}
            >
              {stats.subtitle}
            </TotlText>
          </View>
          <View style={{ width: VALUE_COL_WIDTH, alignItems: 'center' }}>
            {awayBadge ? (
              <Image source={awayBadge} style={{ width: 47, height: 47 }} />
            ) : (
              <View style={{ width: 47, height: 47 }} />
            )}
          </View>
        </View>

        {h2h ? (
          <View
            style={{
              marginHorizontal: 12,
              marginBottom: 2,
              paddingTop: 8,
              paddingBottom: 8,
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <View
              style={{
                marginBottom: h2h.numberOfMatches > 0 ? 4 : 0,
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              <TotlText
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  letterSpacing: 0.4,
                  color: '#0F172A',
                }}
              >
                Head to head
              </TotlText>
              {h2h.numberOfMatches > 0 ? (
                <TotlText
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: '#94A3B8',
                  }}
                >
                  Premier League since 2020
                </TotlText>
              ) : null}
            </View>
            {h2h.numberOfMatches > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <ValueColumn
                  value={String(h2h.homeWins)}
                  highlight={h2hHighlight === 'home'}
                  label="Won"
                />
                <View style={{ width: VALUE_COL_WIDTH, alignItems: 'center' }}>
                  <View
                    style={{
                      minWidth: 44,
                      minHeight: 26,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TotlText
                      style={{
                        fontWeight: '700',
                        fontSize: 13,
                        color: '#0F172A',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {h2h.draws}
                    </TotlText>
                  </View>
                  <TotlText style={{ marginTop: 2, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                    Drawn
                  </TotlText>
                </View>
                <ValueColumn
                  value={String(h2h.awayWins)}
                  highlight={h2hHighlight === 'away'}
                  label="Won"
                />
              </View>
            ) : (
              <TotlText
                style={{
                  marginTop: 2,
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: '600',
                  color: '#64748B',
                }}
              >
                First Premier League meeting since 2020
              </TotlText>
            )}
          </View>
        ) : (
          <View
            style={{
              marginHorizontal: 12,
              marginBottom: 6,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#F1F5F9',
            }}
          >
            <TotlText style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8' }}>
              Head-to-head not available yet
            </TotlText>
          </View>
        )}

        <View
          style={{
            flex: 1,
            paddingHorizontal: 12,
            paddingTop: 4,
            paddingBottom: 14,
            justifyContent: 'space-evenly',
          }}
        >
          {rows.map((row, i) => (
            <View
              key={row.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 32,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: '#F8FAFC',
              }}
            >
              <ValueColumn value={row.homeDisplay} highlight={row.highlight === 'home'} />
              <TotlText
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 13,
                  color: '#64748B',
                  paddingHorizontal: 6,
                }}
              >
                {row.label}
              </TotlText>
              <ValueColumn value={row.awayDisplay} highlight={row.highlight === 'away'} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
