module.exports = {
  env: {
    browser: false, // Since it's backend, we don't need browser-specific settings
    es2021: true, // ECMAScript 2021 syntax
    node: true, // Enable Node.js globals and features
  },

  parserOptions: {
    ecmaVersion: 2022, // Ensure ES2020 is supported
    sourceType: 'module', // Optional, if you're using ES modules
  },
  plugins: [
    'unused-imports', // For managing unused imports
    'node', // For Node.js specific linting rules
    'import',
  ],
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'prettier',
    'plugin:import/recommended',
  ],
  settings: {
    'import/resolver': {
      alias: {
        map: [
          ['@', './src'],
          ['@utils', './src/utils'],
        ],
        extensions: ['.js', '.ts', '.json'],
      },
      node: {
        extensions: ['.js', '.ts', '.json'],
      },
    },
  },
  rules: {
    'no-undef': 'error',
    'import/no-unresolved': 'error',

    'class-methods-use-this': 'off', // This allows arrow functions in classes
    'no-useless-constructor': 'off', // Optionally turn off useless constructor warnings
    'no-method-assign': 'off',

    'no-unused-vars': 'off', // Disable unused vars rule (we're using unused-imports plugin)
    'no-console': ['warn', { allow: ['warn', 'error'] }], // Allow console.warn and console.error, but warn about others
    'node/no-unsupported-features/es-syntax': 'off', // Allow ES syntax (e.g., import/export if needed)

    //#region  //*=========== Unused Import ===========
    'unused-imports/no-unused-imports': 'warn', // Warn about unused imports
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_', // Ignore unused variables starting with an underscore
        args: 'after-used',
        argsIgnorePattern: '^_', // Ignore unused arguments starting with an underscore
      },
    ],
    //#endregion  //*======== Unused Import ===========

    // Suppress warning for using named export as default import
    'import/no-named-as-default': 'off',

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

    'node/no-deprecated-api': 'warn', // Warn if deprecated Node.js APIs are used
  },
  overrides: [
    {
      files: ['src/tests/**/*.js'],
      rules: {
        'unused-imports/no-unused-vars': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['*.cjs'],
      parser: 'espree',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
      },
    },
  ],
  globals: {
    require: true, // Node.js global
    module: true, // Node.js global
    process: true, // Node.js global
    __dirname: true, // Node.js global
  },
};
