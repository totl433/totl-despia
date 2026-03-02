import AppRoot from './src/AppRoot';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardController, KeyboardProvider } from 'react-native-keyboard-controller';

export default function App() {
  const storybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';
  React.useEffect(() => {
    // Preload keyboard once at app startup to avoid first-focus lag.
    // GiftedChat can then opt out of its internal preload.
    KeyboardController.preload();
  }, []);

  if (storybookEnabled) {
    // Avoid bundling Storybook into the normal app path unless enabled.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const StorybookUIRoot = require('./storybook').default;
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider preload={false}>
          <BottomSheetModalProvider>
            <StorybookUIRoot />
          </BottomSheetModalProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider preload={false}>
        <BottomSheetModalProvider>
          <AppRoot />
        </BottomSheetModalProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
