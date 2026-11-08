// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'coverage/*'],
  },
  {
    rules: {
      // Screens load SQLite/native data on mount and set loading/result state from async effects.
      // These are intentional one-shot loads, so this React Compiler advisory is a warning, not an error.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
