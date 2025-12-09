import type { Meta, StoryObj } from '@storybook/react';
import RulesButton from './RulesButton';

const meta: Meta<typeof RulesButton> = {
  title: 'League/RulesButton',
  component: RulesButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RulesButton>;

export const Default: Story = {
  args: {
    onClick: () => alert('Rules clicked!'),
  },
};

