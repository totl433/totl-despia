import type { Meta, StoryObj } from '@storybook/react'
import { ErrorBoundary } from './ErrorBoundary'

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Components/ErrorBoundary',
  component: ErrorBoundary,
}

export default meta

type Story = StoryObj<typeof ErrorBoundary>

const BuggyComponent = () => {
  throw new Error('Storybook demo error')
}

export const HealthyChildren: Story = {
  args: {
    children: <div className="p-6 border rounded-lg">Everything is fine ✅</div>,
  },
}

export const WithCaughtError: Story = {
  args: {
    children: <BuggyComponent />,
  },
}
