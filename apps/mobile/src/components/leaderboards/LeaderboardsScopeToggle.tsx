import React from 'react';
import SegmentedPillControl from '../SegmentedPillControl';

export type LeaderboardsScope = 'all' | 'friends';

export default function LeaderboardsScopeToggle({
  value,
  onChange,
}: {
  value: LeaderboardsScope;
  onChange: (next: LeaderboardsScope) => void;
}) {
  const items: Array<{ key: LeaderboardsScope; label: string }> = [
    { key: 'all', label: 'All Players' },
    { key: 'friends', label: 'Mini League Friends' },
  ];

  return <SegmentedPillControl items={items} value={value} onChange={onChange} height={40} />;
}

