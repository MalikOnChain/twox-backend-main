import colors from 'colors';
import mongoose from 'mongoose';

import config from '@/config';
import { logger } from '@/utils/logger';

const MONGO_URI = config.database.mongoURI;

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 60000,
  family: 4,
  retryWrites: true,
  autoIndex: process.env.NODE_ENV !== 'production',
  maxPoolSize: 10,
  minPoolSize: 5,
  connectTimeoutMS: 20000,
};

export class MongoDBServer {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryInterval = 5000;
    this.env = process.env.NODE_ENV || 'development';
    this.isConnecting = false;
  }

  async connect() {
    if (this.isConnecting) {
      logger.info('🔄 MongoDB >>'.info, 'Connection attempt already in progress'.warn);
      return;
    }

    try {
      this.isConnecting = true;

      if (mongoose.connection.readyState === 1) {
        logger.info('🔄 MongoDB >>'.info, 'Already connected!'.success);
        this.isConnecting = false;
        return;
      }

      await mongoose.connect(MONGO_URI, MONGO_OPTIONS);
      logger.info(
        '✅ MongoDB >>'.success,
        `Connected successfully to ${this.env.toUpperCase()}`.success,
        `[${new Date().toLocaleString()}]`.highlight
      );

      this.setupEventListeners();
      this.retryCount = 0;
      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      console.error('❌ MongoDB >>'.error, 'Connection error:'.error, error.message.trim());
      await this.handleConnectionError();
    }
  }

  async disconnect() {
    await mongoose.connection.close();
  }

  setupEventListeners() {
    let lastDisconnectedLogTime = 0;
    let reconnectionTimeout;
    let lastReconnectTime = 0;
    const RECONNECT_COOLDOWN = 5000; // 5 second cooldown between reconnection attempts

    mongoose.connection.on('disconnected', () => {
      const now = Date.now();

      // Prevent multiple disconnect logs
      if (now - lastDisconnectedLogTime > 5000) {
        logger.info(
          '🔌 MongoDB >>'.warn,
          'Disconnected! Attempting to reconnect...'.warn,
          `[${new Date().toLocaleString()}]`.highlight
        );
        lastDisconnectedLogTime = now;
      }

      // Prevent reconnection storm
      if (now - lastReconnectTime < RECONNECT_COOLDOWN) {
        return;
      }
      lastReconnectTime = now;

      // Clear any existing reconnection timeout
      if (reconnectionTimeout) {
        clearTimeout(reconnectionTimeout);
      }

      // Set new reconnection timeout with exponential backoff
      const backoffTime = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
      reconnectionTimeout = setTimeout(() => this.handleReconnection(), backoffTime);
    });

    mongoose.connection.on('error', (error) => {
      console.error(
        '❌ MongoDB >>'.error,
        'Connection error:'.error,
        error.message.trim(),
        `[${new Date().toLocaleString()}]`.highlight
      );
    });

    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
      process.on(signal, () => {
        if (reconnectionTimeout) {
          clearTimeout(reconnectionTimeout);
        }
        this.gracefulShutdown(signal);
      });
    });

    process.on('unhandledRejection', (error) => {
      console.error(
        '⚠️  MongoDB >>'.error,
        'Unhandled Promise Rejection:'.error,
        error.message.trim(),
        `[${new Date().toLocaleString()}]`.highlight
      );
    });
  }

  async handleConnectionError() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const backoffTime = Math.min(1000 * Math.pow(2, this.retryCount), 30000);

      logger.info(
        '🔄 MongoDB >>'.warn,
        `Retrying connection (${this.retryCount}/${this.maxRetries}) in ${backoffTime / 1000}s...`.warn,
        `[${new Date().toLocaleString()}]`.highlight
      );

      await new Promise((resolve) => setTimeout(resolve, backoffTime));
      return this.connect();
    }

    console.error(
      '💥 MongoDB >>'.error,
      `Failed to connect after ${this.maxRetries} attempts`.error,
      `[${new Date().toLocaleString()}]`.highlight
    );

    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }

  async handleReconnection() {
    if (this.isConnecting || mongoose.connection.readyState === 1) {
      return;
    }

    try {
      this.isConnecting = true;
      await mongoose.connect(MONGO_URI, MONGO_OPTIONS);
      logger.info(
        '✅ MongoDB >>'.success,
        'Reconnected successfully!'.success,
        `[${new Date().toLocaleString()}]`.highlight
      );
      this.retryCount = 0;
    } catch (error) {
      console.error(
        '❌ MongoDB >>'.error,
        'Reconnection failed:'.error,
        error.message.trim(),
        `[${new Date().toLocaleString()}]`.highlight
      );
      await this.handleConnectionError();
    } finally {
      this.isConnecting = false;
    }
  }

  async gracefulShutdown(signal) {
    logger.info(
      '🛑 MongoDB >>'.warn,
      `${signal} received. Starting graceful shutdown...`.warn,
      `[${new Date().toLocaleString()}]`.highlight
    );

    try {
      await mongoose.connection.close();
      logger.info(
        '👋 MongoDB >>'.success,
        'Connection closed gracefully'.success,
        `[${new Date().toLocaleString()}]`.highlight
      );

      // eslint-disable-next-line
      process.exit(0);
    } catch (error) {
      console.error(
        '💥 MongoDB >>'.error,
        'Error during graceful shutdown:'.error,
        error.message.trim(),
        `[${new Date().toLocaleString()}]`.highlight
      );

      // eslint-disable-next-line
      process.exit(1);
    }
  }

  getConnectionState() {
    const states = {
      0: colors.red('disconnected'),
      1: colors.green('connected'),
      2: colors.yellow('connecting'),
      3: colors.red('disconnecting'),
    };
    return states[mongoose.connection.readyState];
  }

  async getConnectionStats() {
    if (mongoose.connection.readyState !== 1) {
      return colors.red('Not connected to database');
    }

    return {
      status: this.getConnectionState(),
      host: colors.cyan(mongoose.connection.host),
      port: colors.cyan(mongoose.connection.port),
      name: colors.cyan(mongoose.connection.name),
      environment: colors.cyan(this.env.toUpperCase()),
      timestamp: colors.cyan(new Date().toLocaleString()),
    };
  }
}

const mongoDBServer = new MongoDBServer();
export default mongoDBServer;
