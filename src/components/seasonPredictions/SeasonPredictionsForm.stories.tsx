import type { Meta, StoryObj } from '@storybook/react';
import SeasonPredictionsForm from './SeasonPredictionsForm';
import { emptySeasonPredictionPicks } from '../../lib/seasonPredictions';
import { useState } from 'react';

const meta: Meta<typeof SeasonPredictionsForm> = {
  title: 'Season Predictions/Form',
  component: SeasonPredictionsForm,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SeasonPredictionsForm>;

function FormPreview({ locked }: { locked: boolean }) {
  const [picks, setPicks] = useState(emptySeasonPredictionPicks());
  return (
    <div className="max-w-lg mx-auto p-4 bg-slate-50 min-h-screen">
      <SeasonPredictionsForm picks={picks} locked={locked} onChange={setPicks} />
    </div>
  );
}

export const Draft: Story = {
  render: () => <FormPreview locked={false} />,
};

export const Locked: Story = {
  render: () => <FormPreview locked={true} />,
};
