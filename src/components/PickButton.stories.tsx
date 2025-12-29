import type { Meta, StoryObj } from '@storybook/react';
import PickButton from './PickButton';

const meta: Meta<typeof PickButton> = {
  title: 'Components/PickButton',
  component: PickButton,
};

export default meta;

type Story = StoryObj<typeof PickButton>;

export const Home: Story = {
  args: {
    label: 'Home',
    active: true,
    onClick: () => {},
  },
};

export const Draw: Story = {
  args: {
    label: 'Draw',
    active: false,
    onClick: () => {},
  },
};

export const Away: Story = {
  args: {
    label: 'Away',
    active: true,
    onClick: () => {},
  },
};

export const Disabled: Story = {
  args: {
    label: 'Home',
    active: false,
    disabled: true,
    onClick: () => {},
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 max-w-md">
      <PickButton label="Home" active={true} onClick={() => {}} />
      <PickButton label="Draw" active={false} onClick={() => {}} />
      <PickButton label="Away" active={false} onClick={() => {}} />
    </div>
  ),
};

































