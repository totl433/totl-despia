import type { Meta, StoryObj } from '@storybook/react';
import SeasonPredictionsLobby from './SeasonPredictionsLobby';
import { mockSeasonPredictionLobby } from '../../lib/seasonPredictions';

const meta: Meta<typeof SeasonPredictionsLobby> = {
  title: 'Season Predictions/Lobby',
  component: SeasonPredictionsLobby,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SeasonPredictionsLobby>;

export const WaitingForOthers: Story = {
  render: () => (
    <div className="max-w-lg mx-auto p-4 bg-slate-50 min-h-screen">
      <SeasonPredictionsLobby players={mockSeasonPredictionLobby()} />
    </div>
  ),
};

export const AllSubmitted: Story = {
  render: () => (
    <div className="max-w-lg mx-auto p-4 bg-slate-50 min-h-screen">
      <SeasonPredictionsLobby
        players={mockSeasonPredictionLobby().map((player) => ({ ...player, submitted: true }))}
      />
    </div>
  ),
};
