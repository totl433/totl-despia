import type { Meta, StoryObj } from '@storybook/react'
import ScrollLogo from './ScrollLogo'

const meta: Meta<typeof ScrollLogo> = {
  title: 'Components/ScrollLogo',
  component: ScrollLogo,
}

export default meta

type Story = StoryObj<typeof ScrollLogo>

export const Default: Story = {
  render: () => (
    <div style={{ minHeight: '200vh', background: '#f8fafc' }}>
      <ScrollLogo />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem', color: '#475569' }}>
        <p>
          Scroll down to see the logo flip, fade, and scale away. This reproduces the on-page animation logic
          so designers can review the easing and positioning without loading the whole homepage.
        </p>
      </div>
    </div>
  ),
}
