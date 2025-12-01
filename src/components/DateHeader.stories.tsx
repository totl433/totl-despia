import type { Meta, StoryObj } from '@storybook/react';
import DateHeader from './DateHeader';

const meta: Meta<typeof DateHeader> = {
  title: 'Components/DateHeader',
  component: DateHeader,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof DateHeader>;

export const Default: Story = {
  args: {
    date: 'Mon, 2 Dec',
  },
};

export const Today: Story = {
  args: {
    date: new Date().toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }),
  },
};

export const WithCustomClass: Story = {
  args: {
    date: 'Sat, 15 Dec',
    className: 'text-lg',
  },
};

