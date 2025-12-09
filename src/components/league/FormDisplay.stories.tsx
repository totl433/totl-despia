import type { Meta, StoryObj } from '@storybook/react';
import FormDisplay from './FormDisplay';

const meta: Meta<typeof FormDisplay> = {
  title: 'League/FormDisplay',
  component: FormDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FormDisplay>;

export const FullForm: Story = {
  args: {
    form: ['W', 'W', 'D', 'L', 'W'],
  },
};

export const PartialForm: Story = {
  args: {
    form: ['W', 'D'],
  },
};

export const EmptyForm: Story = {
  args: {
    form: [],
  },
};

