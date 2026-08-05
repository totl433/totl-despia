import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import NewSeasonBanner from './NewSeasonBanner';

const meta: Meta<typeof NewSeasonBanner> = {
  title: 'Components/NewSeasonBanner',
  component: NewSeasonBanner,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="max-w-lg p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof NewSeasonBanner>;

export const Default: Story = {
  args: {
    seasonLabel: '2026/27',
    forceVisible: true,
  },
};

export const ShortLabel: Story = {
  args: {
    seasonLabel: '26/27',
    forceVisible: true,
  },
};
