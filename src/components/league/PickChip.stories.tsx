import type { Meta, StoryObj } from '@storybook/react';
import PickChip from './PickChip';

const meta: Meta<typeof PickChip> = {
  title: 'League/PickChip',
  component: PickChip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PickChip>;

export const Submitted: Story = {
  args: {
    letter: 'J',
    correct: null,
    unicorn: false,
    hasSubmitted: true,
  },
};

export const NotSubmitted: Story = {
  args: {
    letter: 'C',
    correct: null,
    unicorn: false,
    hasSubmitted: false,
  },
};

export const CorrectLive: Story = {
  args: {
    letter: 'T',
    correct: true,
    unicorn: true,
    hasSubmitted: true,
    isLive: true,
    isOngoing: true,
  },
};

export const CorrectFinished: Story = {
  args: {
    letter: 'S',
    correct: true,
    unicorn: true,
    hasSubmitted: true,
    isFinished: true,
  },
};

export const CorrectNotStarted: Story = {
  args: {
    letter: 'C',
    correct: true,
    unicorn: false,
    hasSubmitted: true,
  },
};

