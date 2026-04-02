module.exports = {
  env: {
    browser: false,
    es2021: true,
    node: true,
  },
  plugins: ['@typescript-eslint', 'import', 'unused-imports'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    'no-unused-vars': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    //#region  //*=========== Unused Import ===========
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_|^T$',
      },
    ],
    //#endregion  //*======== Unused Import ===========

    //#region  //*=========== Import Sort ===========
    'import/order': [
      'warn',
      {
        groups: [
          ['builtin'], // Node.js core modules (fs, path)
          ['external'], // Third-party dependencies (express, cors)
          ['internal'], // Internal project modules

          // Parent and sibling imports
          ['parent'],
          ['sibling'],
          ['index'],
        ],
        pathGroups: [
          { pattern: 'config/**', group: 'internal', position: 'before' },
          { pattern: 'constants/**', group: 'internal', position: 'before' },
          { pattern: 'middleware/**', group: 'internal', position: 'before' },
          { pattern: 'servers/**', group: 'internal', position: 'before' },
          { pattern: 'routes/**', group: 'internal', position: 'before' },
          { pattern: 'controllers/**', group: 'internal', position: 'before' },
          { pattern: 'models/**', group: 'internal', position: 'before' },
          { pattern: 'services/**', group: 'internal', position: 'before' },
          { pattern: 'helpers/**', group: 'internal', position: 'before' },
          { pattern: 'utils/**', group: 'internal', position: 'before' },
        ],
        'newlines-between': 'always', // Ensure blank lines between import groups
        alphabetize: { order: 'asc', caseInsensitive: true }, // Sort imports alphabetically within groups
      },
    ],
    //#endregion  //*======== Import Sort ===========
  },
  overrides: [
    {
      files: ['src/types/**/*.ts', 'src/types/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        'unused-imports/no-unused-vars': 'off',
      },
    },
    {
      files: ['src/tests/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
  globals: {
    JSX: false,
  },
};
