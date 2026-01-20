const { getDefaultConfig } = require('expo/metro-config');
const { withStorybook } = require('@storybook/react-native/metro/withStorybook');
const path = require('path');

/** @type {import('metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Monorepo: include the workspace root so Metro can resolve root entry files
// like `/index.ts` and `/App.tsx` (used by Expo in some dev-client flows).
const workspaceRoot = path.resolve(__dirname, '..', '..');
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), workspaceRoot]));

// Expo SDK 53+ / RN 0.7x+ introduced package "exports" resolution changes.
// Disabling this has fixed "runtime not ready" crashes for some setups.
config.resolver.unstable_enablePackageExports = false;

// Monorepo/workspaces: ensure Metro always resolves React from THIS app.
// Having multiple React versions installed (e.g. root web React 18 + mobile React 19)
// can cause opaque runtime crashes like "Cannot read property 'S' of undefined".
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

// Ensure ALL modules (including ones coming from the workspace root node_modules)
// resolve dependencies from the mobile app's node_modules first.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '..', '..', 'node_modules'),
];

module.exports = withStorybook(config, {
  enabled: process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true',
  configPath: './storybook',
  websocketServerOptions: { port: 7007 },
});

