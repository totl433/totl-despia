import type { Meta, StoryObj } from '@storybook/react';
import GwSelector from './GwSelector';

const meta: Meta<typeof GwSelector> = {
  title: 'League/GwSelector',
  component: GwSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GwSelector>;

export const Default: Story = {
  args: {
    availableGws: [13, 14, 15, 16],
    selectedGw: 15,
    onChange: (gw) => console.log('Selected GW:', gw),
  },
};

export const SingleGw: Story = {
  args: {
    availableGws: [15],
    selectedGw: 15,
    onChange: (gw) => console.log('Selected GW:', gw),
  },
};

