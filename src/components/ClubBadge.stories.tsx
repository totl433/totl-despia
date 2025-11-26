import type { Meta, StoryObj } from '@storybook/react'
import ClubBadge from './ClubBadge'

const meta: Meta<typeof ClubBadge> = {
  title: 'Components/ClubBadge',
  component: ClubBadge,
  args: {
    code: 'ARS',
    size: 48,
  },
}

export default meta

type Story = StoryObj<typeof ClubBadge>

export const Default: Story = {}

export const Rounded: Story = {
  args: {
    code: 'TOT',
    size: 40,
    rounded: true,
  },
}

export const MissingBadgeFallback: Story = {
  args: {
    code: 'XYZ',
  },
}
