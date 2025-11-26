import type { Meta, StoryObj } from '@storybook/react'
import ShareControls from './ShareControls'

const ensureMocks = () => {
  if (!(navigator as any).clipboard) {
    ;(navigator as any).clipboard = {
      writeText: async (text: string) => {
        console.log('[storybook] clipboard.writeText', text)
      },
    }
  }
  if (!(navigator as any).share) {
    ;(navigator as any).share = async (payload: { title?: string; text?: string; url?: string }) => {
      console.log('[storybook] navigator.share', payload)
    }
  }
}

const meta: Meta<typeof ShareControls> = {
  title: 'Components/ShareControls',
  component: ShareControls,
  args: {
    name: 'TOTL Mini League',
    code: 'TOTL123',
    url: '/league/totl123',
  },
  parameters: {
    docs: {
      description: {
        component: 'Copy/share controls that rely on Clipboard + Web Share APIs. The story stubs those browser APIs for review.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof ShareControls>

export const Default: Story = {
  render: (args) => {
    ensureMocks()
    return <ShareControls {...args} />
  },
}

export const Compact: Story = {
  args: {
    compact: true,
  },
  render: (args) => {
    ensureMocks()
    return <ShareControls {...args} />
  },
}
