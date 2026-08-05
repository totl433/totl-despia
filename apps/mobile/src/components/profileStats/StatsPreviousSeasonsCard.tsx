/**
 * Previous Seasons — completed seasons only (OCP, overall rank, top %).
 * Live / in-progress seasons (e.g. 2026/27 early) are not listed here.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';
import Ionicons from '@expo/vector-icons/Ionicons';

export type SeasonArchiveStat = {
  seasonLabel: string;
  /** Seasonal OCP (correct predictions summed for that season). */
  ocp: number | null;
  /** 1-based rank among players with a season score, or null if not ranked. */
  rank: number | null;
  /** Total ranked players (denominator for rank display). */
  rankedPlayers: number | null;
  /**
   * “You’re in the top X%” (1–99), same shape as hero percentile copy.
   * null when season has no standings yet.
   */
  topPercent: number | null;
  /** Optional note under the metrics. */
  note?: string | null;
};

function topLine(topPercent: number | null): string {
  if (typeof topPercent !== 'number' || Number.isNaN(topPercent)) return '—';
  return `Top ${Math.max(1, Math.min(99, Math.round(topPercent)))}%`;
}

function rankLine(rank: number | null, total: number | null): string {
  if (rank == null) return '—';
  if (total != null && total > 0) return `${rank.toLocaleString()} of ${total.toLocaleString()}`;
  return String(rank);
}

/** Large metric value — explicit lineHeight so bold digits aren’t clipped. */
function MetricValue({
  children,
  color,
  fontSize = 24,
}: {
  children: string;
  color: string;
  fontSize?: number;
}) {
  return (
    <TotlText
      style={{
        marginTop: 8,
        fontSize,
        lineHeight: fontSize + 8,
        fontWeight: '900',
        color,
        // iOS sometimes clips heavy weights; pad a hair at the top.
        paddingTop: 2,
        includeFontPadding: true,
      }}
    >
      {children}
    </TotlText>
  );
}

/**
 * Completed seasons rollup. Season picker only when more than one completed season exists.
 */
export default function StatsPreviousSeasonsCard({
  seasons,
  selectedLabel,
  onSelectLabel,
}: {
  seasons: SeasonArchiveStat[];
  selectedLabel: string;
  onSelectLabel: (label: string) => void;
}) {
  const t = useTokens();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const selected = seasons.find((s) => s.seasonLabel === selectedLabel) ?? seasons[0] ?? null;
  if (!seasons.length || !selected) return null;

  const canPickSeason = seasons.length > 1;

  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: t.color.surface,
        padding: 20,
        shadowColor: '#0F172A',
        shadowOpacity: 0.07,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
    >
      <TotlText style={{ fontSize: 18, fontWeight: '900', color: t.color.text, lineHeight: 24 }}>
        Previous Seasons
      </TotlText>
      <TotlText variant="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>
        Your finish for each completed season — OCP, overall place, and percentage.
      </TotlText>

      {canPickSeason ? (
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Selected season ${selected.seasonLabel}. Change season.`}
          style={({ pressed }) => ({
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface2,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View>
            <TotlText variant="muted" style={{ fontSize: 11, fontWeight: '700' }}>
              Season
            </TotlText>
            <TotlText style={{ marginTop: 4, fontSize: 16, lineHeight: 22, fontWeight: '900', color: t.color.text }}>
              {selected.seasonLabel}
            </TotlText>
          </View>
          <Ionicons name="chevron-down" size={20} color={String(t.color.muted)} />
        </Pressable>
      ) : (
        <View
          style={{
            marginTop: 14,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface2,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <TotlText variant="muted" style={{ fontSize: 11, fontWeight: '700' }}>
            Season
          </TotlText>
          <TotlText style={{ marginTop: 4, fontSize: 16, lineHeight: 22, fontWeight: '900', color: t.color.text }}>
            {selected.seasonLabel}
          </TotlText>
        </View>
      )}

      <View style={{ marginTop: 16, flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, borderRadius: 12, backgroundColor: t.color.surface2, padding: 12, overflow: 'visible' }}>
          <TotlText variant="muted" style={{ fontSize: 11, fontWeight: '700', lineHeight: 14 }}>
            OCP
          </TotlText>
          <MetricValue color={String(t.color.text)} fontSize={24}>
            {selected.ocp == null ? '—' : String(Math.round(selected.ocp))}
          </MetricValue>
        </View>
        <View style={{ flex: 1, borderRadius: 12, backgroundColor: t.color.surface2, padding: 12, overflow: 'visible' }}>
          <TotlText variant="muted" style={{ fontSize: 11, fontWeight: '700', lineHeight: 14 }}>
            Overall rank
          </TotlText>
          <MetricValue color={String(t.color.text)} fontSize={18}>
            {rankLine(selected.rank, selected.rankedPlayers)}
          </MetricValue>
        </View>
      </View>

      <View style={{ marginTop: 10, borderRadius: 12, backgroundColor: t.color.surface2, padding: 12, overflow: 'visible' }}>
        <TotlText variant="muted" style={{ fontSize: 11, fontWeight: '700', lineHeight: 14 }}>
          Finish
        </TotlText>
        <MetricValue color={String(t.color.brand)} fontSize={22}>
          {topLine(selected.topPercent)}
        </MetricValue>
        {selected.note ? (
          <TotlText variant="muted" style={{ marginTop: 8, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>
            {selected.note}
          </TotlText>
        ) : null}
      </View>

      {canPickSeason ? (
        <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <Pressable
            onPress={() => setPickerOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: t.color.surface,
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                paddingTop: 12,
                paddingBottom: 28,
                maxHeight: '55%',
              }}
            >
              <TotlText style={{ textAlign: 'center', fontWeight: '900', fontSize: 16, marginBottom: 8 }}>
                Choose season
              </TotlText>
              <ScrollView>
                {seasons.map((s) => {
                  const active = s.seasonLabel === selected.seasonLabel;
                  return (
                    <Pressable
                      key={s.seasonLabel}
                      onPress={() => {
                        onSelectLabel(s.seasonLabel);
                        setPickerOpen(false);
                      }}
                      style={({ pressed }) => ({
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        backgroundColor: active
                          ? 'rgba(28,131,118,0.12)'
                          : pressed
                            ? t.color.surface2
                            : 'transparent',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      })}
                    >
                      <TotlText style={{ fontWeight: '800', fontSize: 16, color: t.color.text }}>
                        {s.seasonLabel}
                      </TotlText>
                      {active ? <Ionicons name="checkmark" size={20} color={String(t.color.brand)} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

/** Build previous-season rows — completed seasons only (currently 2025/26). */
export function buildSeasonArchiveStats(args: {
  closed2526: {
    ocp: number | null;
    rank: number | null;
    rankedPlayers: number | null;
    topPercent: number | null;
  } | null;
}): SeasonArchiveStat[] {
  const { closed2526 } = args;
  return [
    {
      seasonLabel: '2025/26',
      ocp: closed2526?.ocp ?? null,
      rank: closed2526?.rank ?? null,
      rankedPlayers: closed2526?.rankedPlayers ?? null,
      topPercent: closed2526?.topPercent ?? null,
      note:
        closed2526?.rank != null
          ? 'Final 2025/26 overall standing (season total correct predictions).'
          : 'No 2025/26 overall row found for your account yet.',
    },
  ];
}
