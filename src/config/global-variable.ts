import path from 'path';
import { fileURLToPath } from 'url';

import moment from 'moment';

import { Time } from '@/utils/helpers/moment';
import { logger } from '@/utils/logger';

Object.defineProperty(global, 'current_date', {
  get: () => moment().format('YYYY-MM-DD'), // Returns current date
});

Object.defineProperty(global, 'current_time', {
  get: () => moment().format('HH:mm:ss'), // Returns current time
});

Object.defineProperty(global, 'current_timestamp', {
  get: () => moment().format('YYYY-MM-DD HH:mm:ss'), // Returns full timestamp
});

Object.defineProperty(global, 'logger', {
  value: logger,
  writable: false, // Optional: makes the logger read-only
  configurable: false, // Optional: prevents the property from being deleted
});

Object.defineProperty(global, 'Time', {
  value: Time,
  writable: false, // Optional: makes the logger read-only
  configurable: false, // Optional: prevents the property from being deleted
});

// Attach __dirname globally
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));
