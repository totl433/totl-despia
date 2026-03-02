/**
 * Expo entrypoint for the monorepo root.
 *
 * EAS (and `expo/AppEntry`) expects an `App` module at the project root.
 * Our actual native app lives under `apps/mobile`, so we re-export it here.
 */
export { default } from './apps/mobile/App';

