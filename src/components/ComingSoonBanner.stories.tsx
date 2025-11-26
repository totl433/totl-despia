import type { Meta, StoryObj } from '@storybook/react';
import ComingSoonBanner from './ComingSoonBanner';

const meta: Meta<typeof ComingSoonBanner> = {
  title: 'Components/ComingSoonBanner',
  component: ComingSoonBanner,
};

export default meta;

type Story = StoryObj<typeof ComingSoonBanner>;

export const Default: Story = {
  args: {
    gameweek: 15,
    message: 'Fixtures will be published soon.',
  },
};

export const CustomMessage: Story = {
  args: {
    gameweek: 20,
    message: 'The next gameweek fixtures are being prepared.',
  },
};

