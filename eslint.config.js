// https://docs.expo.dev/guides/using-eslint/
const path = require('path');
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'coverage/*', 'node_modules/*'],
  },
  {
    // Config files and scripts run in Node, not in the app.
    files: ['*.config.js', '*.config.ts', 'metro.config.js', 'scripts/**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    settings: {
      // Resolve the @/ and @assets/ aliases without a native resolver (see the file for why).
      // (An array replaces eslint-config-expo's resolver map instead of merging into it.)
      'import/resolver': [path.resolve(__dirname, 'scripts/eslint-alias-resolver.js')],
    },
    rules: {
      // The app must stay independent of the website it sits next to.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../*', '../../../*', '../../../../*'],
              message: 'Use the @/ alias. mapping_app must not import files outside its own folder.',
            },
          ],
        },
      ],
    },
  },
]);
