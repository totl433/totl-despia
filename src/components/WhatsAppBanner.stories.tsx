import type { Meta, StoryObj } from '@storybook/react'
import WhatsAppBanner from './WhatsAppBanner'

const meta: Meta<typeof WhatsAppBanner> = {
  title: 'Components/WhatsAppBanner',
  component: WhatsAppBanner,
}

export default meta

type Story = StoryObj<typeof WhatsAppBanner>

export const Default: Story = {
  render: () => {
    localStorage.removeItem('whatsappBannerSeen')
    return (
      <div className="max-w-2xl">
        <WhatsAppBanner />
      </div>
    )
  },
}
