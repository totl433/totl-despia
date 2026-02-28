import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';
import MiniFixtureCard from '../../components/home/MiniFixtureCard';
import type { MiniFixtureCardProps } from '../../components/home/fixtureCardTypes';
import type { GameweekState } from '../../lib/gameweekState';
import { TEAM_BADGES } from '../../lib/teamBadges';

const baseProps: MiniFixtureCardProps = {
  fixtureId: 'fx-1',
  isExpanded: false,
  onToggleExpand: () => {},
  homeCode: 'ARS',
  awayCode: 'CHE',
  headerHome: 'Arsenal',
  headerAway: 'Chelsea',
  homeBadge: TEAM_BADGES['ARS'] ?? null,
  awayBadge: TEAM_BADGES['CHE'] ?? null,
  primaryLabel: '15:00',
  primaryExpandedLabel: '15:00',
  secondaryLabel: '',
  gwState: 'GW_OPEN',
  pick: undefined,
  derivedOutcome: null,
  hasScore: false,
  percentBySide: { H: 45, D: 25, A: 30 },
  showExpandedPercentages: false,
  homeFormColors: ['#10B981', '#10B981', '#DC2626', '#10B981', '#CBD5E1'],
  awayFormColors: ['#DC2626', '#10B981', '#CBD5E1', '#10B981', '#10B981'],
  homePositionLabel: '3rd',
  awayPositionLabel: '7th',
  homeScorers: [],
  awayScorers: [],
  fixtureDateLabel: 'Sat 22 Feb',
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <View style={{ width: '50%', paddingHorizontal: 6 }}>{children}</View>
    </Screen>
  );
}

function ExpandedWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Screen>
      <View style={{ width: '100%', paddingHorizontal: 6 }}>{children}</View>
    </Screen>
  );
}

const meta: Meta<typeof MiniFixtureCard> = {
  title: 'Home/MiniFixtureCard',
  component: MiniFixtureCard,
};

export default meta;
type Story = StoryObj<typeof MiniFixtureCard>;

export const GwOpen: Story = {
  render: () => <Wrapper><MiniFixtureCard {...baseProps} /></Wrapper>,
};

export const GwOpenWithPick: Story = {
  render: () => <Wrapper><MiniFixtureCard {...baseProps} gwState="GW_OPEN" pick="H" /></Wrapper>,
};

export const GwPredicted: Story = {
  render: () => <Wrapper><MiniFixtureCard {...baseProps} gwState="GW_PREDICTED" pick="H" /></Wrapper>,
};

export const LiveNoPick: Story = {
  render: () => (
    <Wrapper>
      <MiniFixtureCard
        {...baseProps}
        gwState="LIVE"
        hasScore={true}
        primaryLabel="2-1"
        primaryExpandedLabel="2-1"
        secondaryLabel="72'"
        derivedOutcome="H"
      />
    </Wrapper>
  ),
};

export const LivePickCorrect: Story = {
  render: () => (
    <Wrapper>
      <MiniFixtureCard
        {...baseProps}
        gwState="LIVE"
        pick="H"
        hasScore={true}
        primaryLabel="2-1"
        primaryExpandedLabel="2-1"
        secondaryLabel="72'"
        derivedOutcome="H"
      />
    </Wrapper>
  ),
};

export const LivePickWrong: Story = {
  render: () => (
    <Wrapper>
      <MiniFixtureCard
        {...baseProps}
        gwState="LIVE"
        pick="A"
        hasScore={true}
        primaryLabel="2-1"
        primaryExpandedLabel="2-1"
        secondaryLabel="72'"
        derivedOutcome="H"
      />
    </Wrapper>
  ),
};

export const FinishedPickCorrect: Story = {
  render: () => (
    <Wrapper>
      <MiniFixtureCard
        {...baseProps}
        gwState="RESULTS_PRE_GW"
        pick="H"
        hasScore={true}
        primaryLabel="2-1"
        primaryExpandedLabel="2-1"
        secondaryLabel="FT"
        derivedOutcome="H"
      />
    </Wrapper>
  ),
};

export const FinishedPickWrong: Story = {
  render: () => (
    <Wrapper>
      <MiniFixtureCard
        {...baseProps}
        gwState="RESULTS_PRE_GW"
        pick="A"
        hasScore={true}
        primaryLabel="2-1"
        primaryExpandedLabel="2-1"
        secondaryLabel="FT"
        derivedOutcome="H"
      />
    </Wrapper>
  ),
};

export const ExpandedGwOpen: Story = {
  render: () => (
    <ExpandedWrapper>
      <MiniFixtureCard {...baseProps} isExpanded={true} gwState="GW_OPEN" />
    </ExpandedWrapper>
  ),
};

export const ExpandedLiveCorrect: Story = {
  render: () => (
    <ExpandedWrapper>
      <MiniFixtureCard
        {...baseProps}
        isExpanded={true}
        gwState="LIVE"
        pick="H"
        hasScore={true}
        primaryLabel="2-1"
        primaryExpandedLabel="2 - 1"
        secondaryLabel="72'"
        derivedOutcome="H"
        showExpandedPercentages={true}
        homeScorers={["Saka 34'", "Havertz 67'"]}
        awayScorers={["Palmer 45'"]}
      />
    </ExpandedWrapper>
  ),
};

export const ExpandedResultsCorrect: Story = {
  render: () => (
    <ExpandedWrapper>
      <MiniFixtureCard
        {...baseProps}
        isExpanded={true}
        gwState="RESULTS_PRE_GW"
        pick="H"
        hasScore={true}
        primaryLabel="2-1"
        primaryExpandedLabel="2 - 1"
        secondaryLabel="FT"
        derivedOutcome="H"
        showExpandedPercentages={true}
        homeScorers={["Saka 34'", "Havertz 67'"]}
        awayScorers={["Palmer 45'"]}
      />
    </ExpandedWrapper>
  ),
};

export const ExpandedResultsWrong: Story = {
  render: () => (
    <ExpandedWrapper>
      <MiniFixtureCard
        {...baseProps}
        isExpanded={true}
        gwState="RESULTS_PRE_GW"
        pick="A"
        hasScore={true}
        primaryLabel="2-1"
        primaryExpandedLabel="2 - 1"
        secondaryLabel="FT"
        derivedOutcome="H"
        showExpandedPercentages={true}
        homeScorers={["Saka 34'", "Havertz 67'"]}
        awayScorers={["Palmer 45'"]}
      />
    </ExpandedWrapper>
  ),
};

export const HalfTime: Story = {
  render: () => (
    <Wrapper>
      <MiniFixtureCard
        {...baseProps}
        gwState="LIVE"
        pick="D"
        hasScore={true}
        primaryLabel="1-1"
        primaryExpandedLabel="1-1"
        secondaryLabel="HT"
        derivedOutcome="D"
      />
    </Wrapper>
  ),
};
