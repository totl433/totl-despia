import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';
import MiniFixtureCard from '../components/home/MiniFixtureCard';
import type { MiniFixtureCardProps } from '../components/home/fixtureCardTypes';
import { TEAM_BADGES } from '../lib/teamBadges';

const baseProps: MiniFixtureCardProps = {
  fixtureId: 'fx-1',
  isExpanded: false,
  onToggleExpand: () => {},
  homeCode: 'ARS',
  awayCode: 'EVE',
  headerHome: 'Arsenal',
  headerAway: 'Everton',
  homeBadge: TEAM_BADGES['ARS'] ?? null,
  awayBadge: TEAM_BADGES['EVE'] ?? null,
  primaryLabel: '15:00',
  primaryExpandedLabel: '15:00',
  secondaryLabel: '',
  gwState: 'GW_OPEN',
  pick: undefined,
  derivedOutcome: null,
  hasScore: false,
  percentBySide: { H: 45, D: 25, A: 30 },
  showExpandedPercentages: false,
  homeFormColors: [],
  awayFormColors: [],
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
  render: () => (
    <Wrapper>
      <MiniFixtureCard {...baseProps} />
    </Wrapper>
  ),
};

export const GwPredicted: Story = {
  render: () => (
    <Wrapper>
      <MiniFixtureCard {...baseProps} gwState="GW_PREDICTED" pick="H" />
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

/** Arsenal 2-0 Everton, user picked Home (correct) - matches the reference design */
export const FinishedPickCorrect: Story = {
  render: () => (
    <Wrapper>
      <MiniFixtureCard
        {...baseProps}
        homeCode="ARS"
        awayCode="EVE"
        headerHome="Arsenal"
        headerAway="Everton"
        homeBadge={TEAM_BADGES['ARS'] ?? null}
        awayBadge={TEAM_BADGES['EVE'] ?? null}
        gwState="RESULTS_PRE_GW"
        pick="H"
        hasScore={true}
        primaryLabel="2-0"
        primaryExpandedLabel="2 - 0"
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
