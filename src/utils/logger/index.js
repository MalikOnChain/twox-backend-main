import fs from 'fs';
import path from 'path';
import util from 'util';

import colorPen from 'colors';
import winston from 'winston';

import 'winston-daily-rotate-file';
import { ICONS, withIcon } from '@/utils/logger/icons.js';

// Configure colors theme
colorPen.setTheme({
  filename: ['green', 'bold'],
  functionName: ['cyan', 'bold'],
  logLevel: ['yellow', 'bold'],
  timestamp: 'gray',
  separator: 'gray',
  error: ['red'],
  warn: ['yellow'],
  info: ['blue'],
  debug: ['green'],
  http: ['magenta'],
});

class Logger {
  constructor(options = {}) {
    this.options = {
      maxSize: options.maxSize || '20m',
      maxFiles: options.maxFiles || '14d',
      zippedArchive: options.zippedArchive !== false,
      datePattern: options.datePattern || 'YYYY-MM-DD',
      ...options,
    };

    this.options = {
      ...this.options,
      // enabledLevels: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'info', 'warn', 'debug', 'http'],
      enabledLevels:
        process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn', 'debug', 'http', 'info'],
      enabledLogFile: false,
    };

    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.env = process.env.NODE_ENV || 'development';
    this.enabledLogFile = options.enabledLogFile || false;

    // Default log levels
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      debug: 4,
    };

    this.defaultIcons = {
      error: ICONS.ERROR,
      warn: ICONS.WARNING,
      info: ICONS.INFO,
      http: ICONS.HTTP,
      debug: ICONS.DEBUG,
    };

    // Enable specific log levels with Set for better performance
    this.enabledLevels = new Set(this.options.enabledLevels || Object.keys(this.logLevels));

    if (this.enabledLogFile) {
      this.setupLogDirectory();
    }
    this.setupLogger();
  }

  setupLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir);
    }
  }

  // Dynamic level control methods
  // Enable method
  enable(Level) {
    if (Object.prototype.hasOwnProperty.call(this.logLevels, Level)) {
      this.enabledLevels.add(Level);
    }
  }

  // Disable method
  disable(Level) {
    if (Object.prototype.hasOwnProperty.call(this.logLevels, Level)) {
      this.enabledLevels.delete(Level);
    }
  }

  isEnabled(level) {
    return this.enabledLevels.has(level);
  }

  enableLevels(levels) {
    levels.forEach((level) => this.enable(level));
  }

  disableLevels(levels) {
    levels.forEach((level) => this.disable(level));
  }

  getLogPrefix(level) {
    if (!this.isEnabled(level)) return null;
    const icon = this.defaultIcons[level] || '';
    return colorPen[level](colorPen.bold(`${icon} [${level.toUpperCase()}]`));
  }

  getCallerInfo() {
    const stack = new Error().stack.split('\n');
    if (stack.length >= 4) {
      const callerLine = stack[3].trim();
      const match = callerLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return {
          functionName: match[1],
          filename: path.basename(match[2]),
          line: match[3],
        };
      }
    }
    return { functionName: 'Unknown', filename: 'Unknown', line: '0' };
  }

  formatMessage(...args) {
    return util.format(...args);
  }

  formatLogEntry(level, args, callerInfo) {
    if (!this.isEnabled(level)) return null;

    const prefix = this.getLogPrefix(level);
    const styledFunction = colorPen.gray(`[${callerInfo.filename}:${callerInfo.line}][${callerInfo.functionName}]`);
    const formattedMessage = this.formatMessage(...args);

    // Ensure that the color is applied to the message correctly
    const coloredMessage = colorPen[level](formattedMessage);

    return `${prefix}${styledFunction}${colorPen.separator(' >> ')}${coloredMessage}`;
  }

  setupLogger() {
    const consoleFormat = winston.format.printf(({ message }) => message);

    const transports = [
      new winston.transports.Console({
        format: consoleFormat,
        handleExceptions: true,
      }),
    ];

    if (this.enabledLogFile) {
      // Add file transports if enabled
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: path.join(this.logDir, 'combined-%DATE%.log'),
          datePattern: this.options.datePattern,
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
          maxSize: this.options.maxSize,
          maxFiles: this.options.maxFiles,
          zippedArchive: this.options.zippedArchive,
        })
      );
    }

    this.logger = winston.createLogger({
      level: 'debug',
      levels: this.logLevels,
      transports,
      exitOnError: false,
    });
  }

  // Console.log style logging methods
  error(...args) {
    if (!this.isEnabled('error')) return;
    const callerInfo = this.getCallerInfo();
    const message = this.formatLogEntry('error', args, callerInfo);
    if (message) this.logger.error(message);
  }

  warn(...args) {
    if (!this.isEnabled('warn')) return;
    const callerInfo = this.getCallerInfo();
    const message = this.formatLogEntry('warn', args, callerInfo);
    if (message) this.logger.warn(message);
  }

  info(...args) {
    if (!this.isEnabled('info')) return;
    const callerInfo = this.getCallerInfo();
    const message = this.formatLogEntry('info', args, callerInfo);
    if (message) this.logger.info(message);
  }

  debug(...args) {
    if (!this.isEnabled('debug')) return;
    const callerInfo = this.getCallerInfo();
    const message = this.formatLogEntry('debug', args, callerInfo);
    if (message) this.logger.debug(message);
  }

  http(...args) {
    if (!this.isEnabled('http')) return;
    const callerInfo = this.getCallerInfo();
    const message = this.formatLogEntry('http', args, callerInfo);
    if (message) this.logger.http(message);
  }

  formatDuration(duration) {
    if (duration < 1) {
      return `${(duration * 1000).toFixed(2)}μs`;
    } else if (duration < 1000) {
      return `${duration.toFixed(2)}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(2)}s`;
    } else {
      return `${(duration / 60000).toFixed(2)}min`;
    }
  }

  startPerformanceMeasurement(operation) {
    const startTime = process.hrtime();

    return (...args) => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
      const formattedDuration = this.formatDuration(duration);

      // Create performance message
      const message = `${operation} completed in ${formattedDuration}`;

      // Log with any additional arguments
      this.info(withIcon('PERFORMANCE', message), ...args);

      return duration;
    };
  }

  static createLogger() {
    return new Logger();
  }
}

export const logger = Logger.createLogger();

export default Logger;
