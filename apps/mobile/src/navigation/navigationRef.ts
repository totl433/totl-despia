import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './AppNavigator';

/** Kept in its own module so popup code can read the route without importing the navigator. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
