import React from 'react';
import UnderlineTabs from '../UnderlineTabs';

export type LeaderboardsTab = 'gw' | 'monthly' | 'overall';

export type FormScope = 'none' | 'last5' | 'last10' | 'sinceStarted';

export default function LeaderboardsTabs({
  value,
  onChange,
  currentGw,
  currentMonthLabel,
}: {
  value: LeaderboardsTab;
  onChange: (next: LeaderboardsTab) => void;
  currentGw?: number | null;
  currentMonthLabel?: string | null;
}) {
  const items: Array<{ key: LeaderboardsTab; label: string }> = [
    { key: 'gw', label: currentGw != null ? `GW${currentGw}` : 'GW' },
    { key: 'monthly', label: currentMonthLabel ?? 'Month' },
    { key: 'overall', label: 'Overall' },
  ];
  return <UnderlineTabs items={items} value={value} onChange={onChange} />;
}

