import type { Meta, StoryObj } from '@storybook/react';
import Section from './Section';

const meta: Meta<typeof Section> = {
  title: 'Components/Section',
  component: Section,
};

export default meta;

type Story = StoryObj<typeof Section>;

export const Default: Story = {
  render: (args) => (
    <Section {...args}>
      <div className="p-4">
        <p>This is the default section.</p>
      </div>
    </Section>
  ),
  args: {
    title: 'Leaderboards',
  },
};

export const WithSubtitle: Story = {
  render: (args) => (
    <Section {...args}>
      <div className="p-4">
        <p>Section with subtitle.</p>
      </div>
    </Section>
  ),
  args: {
    title: 'Leaderboards',
    subtitle: 'View your rankings across different leaderboards',
  },
};

export const Collapsible: Story = {
  render: (args) => (
    <Section {...args}>
      <div>
        <p>This is a collapsible section. Click the header to toggle.</p>
        <p>It can contain any content.</p>
      </div>
    </Section>
  ),
  args: {
    id: 'predictions',
    title: 'Predictions Centre',
    icon: '🎯',
    collapsible: true,
    defaultOpen: true,
  },
};

export const CollapsibleClosed: Story = {
  render: (args) => (
    <Section {...args}>
      <div>
        <p>This section starts closed.</p>
      </div>
    </Section>
  ),
  args: {
    id: 'leaderboard',
    title: 'Leaderboard',
    icon: '📈',
    collapsible: true,
    defaultOpen: false,
  },
};

