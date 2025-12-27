import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import SegmentedToggle from './SegmentedToggle';

const meta: Meta<typeof SegmentedToggle> = {
  title: 'Components/SegmentedToggle',
  component: SegmentedToggle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SegmentedToggle>;

const InteractiveWrapper = (args: any) => {
  const [value, setValue] = useState(false);
  return <SegmentedToggle {...args} value={value} onToggle={setValue} />;
};

export const AllPlayersToggle: Story = {
  render: InteractiveWrapper,
  args: {
    labels: { left: "All Players", right: "Mini League Friends" },
  },
};

export const PointsFormToggle: Story = {
  render: InteractiveWrapper,
  args: {
    labels: { left: "Points", right: "Form" },
  },
};


