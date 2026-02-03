import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { GwResults } from '@totl/domain';

import GameweekResultsModalScreen from '../screens/GameweekResultsModalScreen';

type StoryStackParamList = {
  GameweekResults: { gw: number };
};

const Stack = createNativeStackNavigator<StoryStackParamList>();

function makeClientWithResults(gw: number, results: GwResults) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
      },
    },
  });
  client.setQueryData(['gwResults', gw], results);
  return client;
}

function Host({ gw, results }: { gw: number; results: GwResults }) {
  const queryClient = React.useMemo(() => makeClientWithResults(gw, results), [gw, results]);
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="GameweekResults" component={GameweekResultsModalScreen as any} initialParams={{ gw }} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}

const mockGw24: GwResults = {
  score: 5,
  totalFixtures: 10,
  gwRank: 15,
  gwRankTotal: 38,
  trophies: { gw: false, form5: false, form10: true, overall: false },
  mlVictories: 4,
  mlVictoryNames: ['Carl exp…', 'AGI UNIT…', 'Heart of…', 'carlVjof…'],
  mlVictoryData: [
    { id: '1', name: 'Carl exp…', avatar: 'ML-avatar-1.png' },
    { id: '2', name: 'AGI UNIT…', avatar: 'ML-avatar-2.png' },
    { id: '3', name: 'Heart of…', avatar: 'ML-avatar-3.png' },
    { id: '4', name: 'carlVjof…', avatar: 'ML-avatar-4.png' },
  ],
  leaderboardChanges: {
    overall: { before: 7, after: 6, change: 1 },
    form5: { before: 6, after: 5, change: 1 },
    form10: { before: 2, after: 1, change: 1 },
  },
};

const meta: Meta<typeof Host> = {
  title: 'results/GameweekResultsModalScreen',
  component: Host,
};

export default meta;

type Story = StoryObj<typeof Host>;

export const Gw24: Story = {
  args: { gw: 24, results: mockGw24 },
};

export const NoTrophies: Story = {
  args: {
    gw: 24,
    results: {
      ...mockGw24,
      trophies: { gw: false, form5: false, form10: false, overall: false },
      mlVictories: 0,
      mlVictoryNames: [],
      mlVictoryData: [],
    },
  },
};

