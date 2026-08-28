import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import GetAppPage from '../pages/GetApp';
import { AuthContext } from '../context/AuthContext';

const meta: Meta<typeof GetAppPage> = {
  title: 'Pages/GetApp',
  component: GetAppPage,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: null,
            session: null,
            loading: false,
            signOut: async () => {},
            showWelcome: false,
            dismissWelcome: () => {},
          }}
        >
          <Story />
        </AuthContext.Provider>
      </MemoryRouter>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof GetAppPage>;

export const Default: Story = {};
