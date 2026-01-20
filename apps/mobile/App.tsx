import AppRoot from './src/AppRoot';
import React from 'react';

export default function App() {
  const storybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';

  if (storybookEnabled) {
    // Avoid bundling Storybook into the normal app path unless enabled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StorybookUIRoot = require('./storybook').default;
    return <StorybookUIRoot />;
  }

  return <AppRoot />;
}
