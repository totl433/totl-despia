import AppRoot from './src/AppRoot';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

export default function App() {
  const storybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';

  if (storybookEnabled) {
    // Avoid bundling Storybook into the normal app path unless enabled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StorybookUIRoot = require('./storybook').default;
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <StorybookUIRoot />
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <AppRoot />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
