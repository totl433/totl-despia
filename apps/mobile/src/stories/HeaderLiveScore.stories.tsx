import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';
import { View } from 'react-native';

import HeaderLiveScore from '../components/HeaderLiveScore';
import { TEAM_BADGES } from '../lib/teamBadges';

const meta: Meta<typeof HeaderLiveScore> = {
  title: 'App/HeaderLiveScore',
  component: HeaderLiveScore,
  decorators: [
    (Story) => (
      <Screen fullBleed>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingTop: 24,
            backgroundColor: '#0F172A',
          }}
        >
          <View style={{ width: '100%' }}>
            <Story />
          </View>
        </View>
      </Screen>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof HeaderLiveScore>;

const sampleTickerEvent = {
  scorerName: 'Stratton',
  minuteLabel: "(58')",
  homeCode: 'TOT',
  awayCode: 'NFO',
  homeBadge: TEAM_BADGES.TOT,
  awayBadge: TEAM_BADGES.NFO,
  homeScore: '2',
  awayScore: '1',
  scoringSide: 'home' as const,
};

export const Live: Story = {
  args: {
    scoreLabel: '1/10',
    fill: true,
    expandedStats: [
      { value: '#3', icon: 'people-outline', trailingValue: '46' },
      { value: 'Top 7%' },
    ],
  },
};

export const LiveWithTicker: Story = {
  args: {
    scoreLabel: '1/10',
    fill: true,
    tickerEvent: sampleTickerEvent,
    tickerEventKey: 'storybook-preview-goal',
    tickerIntervalMs: 2500,
    previewTickerLoop: true,
    expandedStats: [
      { value: '#3', icon: 'people-outline', trailingValue: '46' },
      { value: 'Top 7%' },
    ],
  },
};

export const ResultsPreGw: Story = {
  args: {
    scoreLabel: '6/10',
    fill: true,
    live: false,
    expandedStats: [
      { value: '#3', icon: 'people-outline', trailingValue: '46' },
      { value: 'Top 7%' },
    ],
  },
};
