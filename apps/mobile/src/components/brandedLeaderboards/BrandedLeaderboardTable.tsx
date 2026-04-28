import React from 'react';
import type { ViewStyle } from 'react-native';
import type { BrandedLeaderboardStandingsRow } from '@totl/domain';
import LeaderboardTable, { type LeaderboardRow } from '../leaderboards/LeaderboardTable';

type Props = {
  rows: BrandedLeaderboardStandingsRow[];
  highlightUserId?: string | null;
  valueLabel?: string;
  secondaryValueLabel?: string;
  compactValueLabels?: string[];
  compactLiveValueLabel?: string;
  winnerUserIds?: string[];
  style?: ViewStyle;
};

export default function BrandedLeaderboardTable({
  rows,
  highlightUserId,
  valueLabel = 'Pts',
  secondaryValueLabel,
  compactValueLabels,
  compactLiveValueLabel,
  winnerUserIds,
  style,
}: Props) {
  const mappedRows = React.useMemo<LeaderboardRow[]>(
    () =>
      rows.map((row) => ({
        user_id: row.user_id,
        name: row.name,
        value: row.value,
        avatar_url: row.avatar_url,
        compactValues: compactValueLabels?.length ? row.compact_values : undefined,
        secondaryValue: secondaryValueLabel ? row.compact_values?.[0] ?? null : undefined,
      })),
    [compactValueLabels?.length, rows, secondaryValueLabel]
  );

  return (
    <LeaderboardTable
      rows={mappedRows}
      highlightUserId={highlightUserId}
      valueLabel={valueLabel}
      compactValueLabels={compactValueLabels}
      compactLiveValueLabel={compactLiveValueLabel}
      secondaryValueLabel={secondaryValueLabel}
      winnerUserIds={winnerUserIds}
      style={style}
    />
  );
}
