import AppRoot from './src/AppRoot';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export default function App() {
  const storybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';

  if (storybookEnabled) {
    // Avoid bundling Storybook into the normal app path unless enabled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StorybookUIRoot = require('./storybook').default;
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <KeyboardProvider>
            <StorybookUIRoot />
          </KeyboardProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <KeyboardProvider>
          <AppRoot />
        </KeyboardProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
