import React from 'react';
import UnderlineTabs, { type UnderlineTabItem } from '../UnderlineTabs';

export type LeaderboardsTab = 'gw' | 'monthly' | 'overall';

export type FormScope = 'none' | 'last5' | 'last10' | 'sinceStarted';

export default function LeaderboardsTabs({
  value,
  onChange,
  currentGw,
  currentMonthLabel,
  currentGwIsLive = false,
}: {
  value: LeaderboardsTab;
  onChange: (next: LeaderboardsTab) => void;
  currentGw?: number | null;
  currentMonthLabel?: string | null;
  currentGwIsLive?: boolean;
}) {
  const items: Array<UnderlineTabItem<LeaderboardsTab>> = [
    { key: 'gw', label: currentGw != null ? `GW${currentGw}` : 'GW', showLiveDot: currentGwIsLive },
    { key: 'monthly', label: currentMonthLabel ?? 'Month' },
    { key: 'overall', label: 'Overall' },
  ];
  return <UnderlineTabs items={items} value={value} onChange={onChange} />;
}

