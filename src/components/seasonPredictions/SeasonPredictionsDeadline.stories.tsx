import type { Meta, StoryObj } from '@storybook/react';
import SeasonPredictionsDeadline from './SeasonPredictionsDeadline';

const meta: Meta<typeof SeasonPredictionsDeadline> = {
  title: 'Season Predictions/Deadline',
  component: SeasonPredictionsDeadline,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SeasonPredictionsDeadline>;

export const Open: Story = {
  render: () => (
    <div className="max-w-lg mx-auto p-4 bg-slate-50">
      <SeasonPredictionsDeadline variant="open" />
    </div>
  ),
};

export const Locked: Story = {
  render: () => (
    <div className="max-w-lg mx-auto p-4 bg-slate-50">
      <SeasonPredictionsDeadline variant="locked" />
    </div>
  ),
};

export const Passed: Story = {
  render: () => (
    <div className="max-w-lg mx-auto p-4 bg-slate-50">
      <SeasonPredictionsDeadline variant="passed" />
    </div>
  ),
};
