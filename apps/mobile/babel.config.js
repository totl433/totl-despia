module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Avoid Hermes bytecode/stable-profile transforms during dev.
          // This has helped resolve "[runtime not ready]" crashes in Expo Go.
          unstable_transformProfile: 'default',
        },
      ],
    ],
    plugins: [
      // Required by react-native-reanimated (and libraries like @gorhom/bottom-sheet).
      'react-native-reanimated/plugin',
    ],
  };
};

