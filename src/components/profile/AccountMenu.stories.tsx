import type { Meta, StoryObj } from '@storybook/react';
import { AccountMenu } from './AccountMenu';

const meta: Meta<typeof AccountMenu> = {
  title: 'Components/Profile/AccountMenu',
  component: AccountMenu,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AccountMenu>;

const BellIcon = (
  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const EmailIcon = (
  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const HelpIcon = (
  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const Default: Story = {
  args: {
    email: 'jof.middleton@gmail.com',
    menuItems: [
      {
        to: '/profile/notifications',
        icon: BellIcon,
        label: 'Notification Centre',
      },
      {
        to: '/profile/email-preferences',
        icon: EmailIcon,
        label: 'Email Preferences',
      },
      {
        to: '/how-to-play',
        icon: HelpIcon,
        label: 'Help',
      },
    ],
    onLogout: () => console.log('Logout clicked'),
  },
};

export const LongEmail: Story = {
  args: {
    email: 'very.long.email.address@example.com',
    menuItems: [
      {
        to: '/profile/notifications',
        icon: BellIcon,
        label: 'Notification Centre',
      },
      {
        to: '/profile/email-preferences',
        icon: EmailIcon,
        label: 'Email Preferences',
      },
      {
        to: '/how-to-play',
        icon: HelpIcon,
        label: 'Help',
      },
    ],
    onLogout: () => console.log('Logout clicked'),
  },
};

