import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import PointsFormToggle from './PointsFormToggle';

const meta: Meta<typeof PointsFormToggle> = {
  title: 'League/PointsFormToggle',
  component: PointsFormToggle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PointsFormToggle>;

const InteractiveWrapper = (args: any) => {
  const [showForm, setShowForm] = useState(false);
  return <PointsFormToggle {...args} showForm={showForm} onToggle={setShowForm} />;
};

export const Default: Story = {
  render: InteractiveWrapper,
};

