import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { Screen } from '@totl/ui';
import ExpandedFixtureCard from '../components/home/ExpandedFixtureCard';
import type { ExpandedFixtureCardProps } from '../components/home/fixtureCardTypes';
import { TEAM_BADGES } from '../lib/teamBadges';

const baseProps: ExpandedFixtureCardProps = {
  fixtureId: 'fx-1',
  isExpandedVisual: true,
  isDetailsViewActive: true,
  isCompactStack: false,
  isCompactCard: false,
  fixtureMarginTop: 0,
  stackZIndex: 0,
  stackElevation: 0,
  onPress: () => {},
  homeCode: 'ARS',
  awayCode: 'CHE',
  headerPrimary: '15:00',
  headerSecondary: '',
  headerHome: 'Arsenal',
  headerAway: 'Chelsea',
  homeBadge: TEAM_BADGES['ARS'] ?? null,
  awayBadge: TEAM_BADGES['CHE'] ?? null,
  homeTeamFontWeight: '800',
  awayTeamFontWeight: '800',
  gwState: 'GW_OPEN',
  pick: undefined,
  derivedOutcome: null,
  hasScore: false,
  isFinished: false,
  isLiveOrResultsCard: false,
  percentBySide: { H: 45, D: 25, A: 30 },
  showTabsRow: false,
  showTabPercentages: false,
  showPercentagesOnTabs: false,
  tabsAboveScorers: false,
  homeScorers: [],
  awayScorers: [],
  kickoffDetail: 'Sat 22 Feb • 15:00',
  hideStatusRowCompletely: true,
  hideRepeatedKickoffInDetails: false,
  hideRepeatedKickoffInCompact: false,
  hideRepeatedKickoffInLiveScheduled: false,
};

const meta: Meta<typeof ExpandedFixtureCard> = {
  title: 'Home/ExpandedFixtureCard',
  component: ExpandedFixtureCard,
};

export default meta;
type Story = StoryObj<typeof ExpandedFixtureCard>;

export const GwOpen: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard {...baseProps} />
    </Screen>
  ),
};

export const GwOpenWithPick: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        pick="H"
        homeTeamFontWeight="800"
        awayTeamFontWeight="600"
        showTabsRow={false}
      />
    </Screen>
  ),
};

export const GwPredictedWithPick: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        gwState="GW_PREDICTED"
        pick="H"
        homeTeamFontWeight="800"
        awayTeamFontWeight="600"
        showTabsRow={true}
        hideStatusRowCompletely={false}
      />
    </Screen>
  ),
};

export const DeadlinePassed: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        gwState="DEADLINE_PASSED"
        pick="H"
        homeTeamFontWeight="800"
        awayTeamFontWeight="600"
        showTabsRow={true}
        showTabPercentages={true}
        showPercentagesOnTabs={true}
        hideStatusRowCompletely={false}
      />
    </Screen>
  ),
};

export const LivePickCorrect: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        gwState="LIVE"
        pick="H"
        homeTeamFontWeight="800"
        awayTeamFontWeight="600"
        headerPrimary="2 - 1"
        headerSecondary="72'"
        hasScore={true}
        derivedOutcome="H"
        isLiveOrResultsCard={true}
        showTabsRow={true}
        showTabPercentages={true}
        showPercentagesOnTabs={true}
        tabsAboveScorers={true}
        hideStatusRowCompletely={false}
        homeScorers={["Saka 34'", "Havertz 67'"]}
        awayScorers={["Palmer 45'"]}
      />
    </Screen>
  ),
};

export const LivePickWrong: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        gwState="LIVE"
        pick="A"
        homeTeamFontWeight="600"
        awayTeamFontWeight="800"
        headerPrimary="2 - 1"
        headerSecondary="72'"
        hasScore={true}
        derivedOutcome="H"
        isLiveOrResultsCard={true}
        showTabsRow={true}
        showTabPercentages={true}
        showPercentagesOnTabs={true}
        tabsAboveScorers={true}
        hideStatusRowCompletely={false}
        homeScorers={["Saka 34'", "Havertz 67'"]}
        awayScorers={["Palmer 45'"]}
      />
    </Screen>
  ),
};

export const FinishedCorrect: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        gwState="RESULTS_PRE_GW"
        pick="H"
        homeTeamFontWeight="800"
        awayTeamFontWeight="600"
        headerPrimary="2 - 1"
        headerSecondary="FT"
        hasScore={true}
        isFinished={true}
        derivedOutcome="H"
        isLiveOrResultsCard={true}
        showTabsRow={true}
        showTabPercentages={true}
        showPercentagesOnTabs={true}
        tabsAboveScorers={true}
        hideStatusRowCompletely={false}
        homeScorers={["Saka 34'", "Havertz 67'"]}
        awayScorers={["Palmer 45'"]}
        kickoffDetail="Sat 22 Feb • 15:00"
      />
    </Screen>
  ),
};

export const FinishedWrong: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        gwState="RESULTS_PRE_GW"
        pick="A"
        homeTeamFontWeight="600"
        awayTeamFontWeight="800"
        headerPrimary="2 - 1"
        headerSecondary="FT"
        hasScore={true}
        isFinished={true}
        derivedOutcome="H"
        isLiveOrResultsCard={true}
        showTabsRow={true}
        showTabPercentages={true}
        showPercentagesOnTabs={true}
        tabsAboveScorers={true}
        hideStatusRowCompletely={false}
        homeScorers={["Saka 34'", "Havertz 67'"]}
        awayScorers={["Palmer 45'"]}
        kickoffDetail="Sat 22 Feb • 15:00"
      />
    </Screen>
  ),
};

export const HalfTime: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        gwState="LIVE"
        pick="D"
        homeTeamFontWeight="600"
        awayTeamFontWeight="600"
        headerPrimary="1 - 1"
        headerSecondary="HT"
        hasScore={true}
        derivedOutcome="D"
        isLiveOrResultsCard={true}
        showTabsRow={true}
        showTabPercentages={true}
        showPercentagesOnTabs={true}
        tabsAboveScorers={true}
        hideStatusRowCompletely={false}
        homeScorers={["Saka 34'"]}
        awayScorers={["Palmer 45'"]}
      />
    </Screen>
  ),
};

export const CompactStack: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        isExpandedVisual={false}
        isDetailsViewActive={false}
        isCompactStack={true}
        isCompactCard={true}
        gwState="LIVE"
        pick="H"
        headerPrimary="2 - 1"
        headerSecondary="72'"
        hasScore={true}
        derivedOutcome="H"
        isLiveOrResultsCard={true}
        showTabsRow={true}
        showTabPercentages={true}
        showPercentagesOnTabs={true}
        hideStatusRowCompletely={false}
      />
    </Screen>
  ),
};

export const NoPick: Story = {
  render: () => (
    <Screen>
      <ExpandedFixtureCard
        {...baseProps}
        gwState="LIVE"
        headerPrimary="0 - 0"
        headerSecondary="32'"
        hasScore={true}
        derivedOutcome="D"
        isLiveOrResultsCard={true}
        showTabsRow={true}
        showTabPercentages={true}
        showPercentagesOnTabs={true}
        tabsAboveScorers={true}
        hideStatusRowCompletely={false}
      />
    </Screen>
  ),
};
