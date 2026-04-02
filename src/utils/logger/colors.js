// utils/colors.js
import colors from 'colors';

// Configure colors theme
colors.setTheme({
  // Log Levels
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'cyan',
  trace: 'magenta',

  // Status Colors
  success: 'green',
  fail: 'red',
  pending: 'yellow',
  processing: 'cyan',

  // Emphasis Colors
  highlight: 'cyan',
  important: 'magenta',
  special: 'rainbow',

  // Data Types
  number: 'yellow',
  string: 'green',
  boolean: 'blue',
  null: 'grey',

  // Components
  server: 'cyan',
  database: 'magenta',
  cache: 'blue',
  api: 'green',

  // Features
  game: 'magenta',
  user: 'cyan',
  admin: 'red',
  system: 'grey',

  // Time
  timestamp: 'grey',
  duration: 'yellow',

  // Environment
  development: 'cyan',
  staging: 'yellow',
  production: 'red',
});

// Format helpers
export const formatters = {
  // Status formatters
  status: (text) => colors.bold(text),
  error: (text) => colors.error(colors.bold(text)),
  success: (text) => colors.success(colors.bold(text)),

  // Time formatters
  timestamp: (date) => colors.timestamp(date.toLocaleString()),
  duration: (ms) => colors.duration(`${ms}ms`),

  // Environment formatter
  environment: (env) => {
    switch (env.toLowerCase()) {
      case 'production':
        return colors.production(colors.bold('PRODUCTION'));
      case 'staging':
        return colors.staging(colors.bold('STAGING'));
      default:
        return colors.development(colors.bold('DEVELOPMENT'));
    }
  },

  // Data formatters
  json: (obj, _indent = 2) => {
    const colorize = (obj) => {
      if (obj === undefined) return colors.null('null');
      if (obj === null) return colors.null('null');
      if (typeof obj === 'number') return colors.number(obj);
      if (typeof obj === 'boolean') return colors.boolean(obj);
      if (typeof obj === 'string') return colors.string(`"${obj}"`);
      if (Array.isArray(obj)) {
        return `[${obj.map((item) => colorize(item)).join(', ')}]`;
      }
      if (typeof obj === 'object') {
        const pairs = Object.entries(obj).map(([key, value]) => `"${key}": ${colorize(value)}`);
        return `{${pairs.join(', ')}}`;
      }

      return obj.toString();
    };

    return colorize(obj);
  },
};

export const customColors = colors;

export default colors;
