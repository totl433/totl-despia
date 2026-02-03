import React from 'react';
import SegmentedPillControl from '../SegmentedPillControl';

export type LeaderboardsTab = 'gw' | 'form5' | 'form10' | 'overall';

export default function LeaderboardsTabs({
  value,
  onChange,
}: {
  value: LeaderboardsTab;
  onChange: (next: LeaderboardsTab) => void;
}) {
  const items: Array<{ key: LeaderboardsTab; label: string }> = [
    { key: 'gw', label: 'GW' },
    { key: 'form5', label: '5' },
    { key: 'form10', label: '10' },
    { key: 'overall', label: '🏆' },
  ];

  return <SegmentedPillControl items={items} value={value} onChange={onChange} height={46} />;
}

