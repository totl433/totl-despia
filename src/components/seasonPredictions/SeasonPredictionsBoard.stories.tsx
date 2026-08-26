import type { Meta, StoryObj } from '@storybook/react';
import SeasonPredictionsBoard from './SeasonPredictionsBoard';
import { mockSeasonPredictionReveal, scoreSeasonPredictions } from '../../lib/seasonPredictions';

const meta: Meta<typeof SeasonPredictionsBoard> = {
  title: 'Season Predictions/Board',
  component: SeasonPredictionsBoard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SeasonPredictionsBoard>;

const mock = mockSeasonPredictionReveal();
const scores = scoreSeasonPredictions(mock.entries, mock.results);

export const AfterDeadlinePicksOnly: Story = {
  render: () => (
    <div className="max-w-lg mx-auto p-4 bg-slate-50 min-h-screen">
      <SeasonPredictionsBoard
        entries={mock.entries}
        results={null}
        scores={scoreSeasonPredictions(mock.entries, null)}
      />
    </div>
  ),
};

export const EndOfSeasonScored: Story = {
  render: () => (
    <div className="max-w-lg mx-auto p-4 bg-slate-50 min-h-screen">
      <SeasonPredictionsBoard entries={mock.entries} results={mock.results} scores={scores} />
    </div>
  ),
};
