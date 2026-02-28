import type { Meta, StoryObj } from '@storybook/react-native';
import React, { useState } from 'react';
import { Screen } from '@totl/ui';
import SegmentedPillControl, { type SegmentedItem } from '../components/SegmentedPillControl';

type ScopeKey = 'gw' | 'five' | 'ten' | 'season';

const items: SegmentedItem<ScopeKey>[] = [
  { key: 'gw', label: 'GW' },
  { key: 'five', label: '5' },
  { key: 'ten', label: '10' },
  { key: 'season', label: 'Season' },
];

function SegmentedPillDemo() {
  const [active, setActive] = useState<ScopeKey>('gw');
  return (
    <Screen>
      <SegmentedPillControl items={items} activeKey={active} onSelect={setActive} />
    </Screen>
  );
}

type TwoKey = 'all' | 'friends';

const twoItems: SegmentedItem<TwoKey>[] = [
  { key: 'all', label: 'All Players' },
  { key: 'friends', label: 'Mini League' },
];

function TwoSegmentDemo() {
  const [active, setActive] = useState<TwoKey>('all');
  return (
    <Screen>
      <SegmentedPillControl items={twoItems} activeKey={active} onSelect={setActive} />
    </Screen>
  );
}

const meta: Meta<typeof SegmentedPillControl> = {
  title: 'App/SegmentedPillControl',
  component: SegmentedPillControl as any,
};

export default meta;
type Story = StoryObj<typeof SegmentedPillControl>;

export const FourSegments: Story = {
  render: () => <SegmentedPillDemo />,
};

export const TwoSegments: Story = {
  render: () => <TwoSegmentDemo />,
};
