import path from 'path';

import { errorHandler, notFoundHandler } from '@bountyscripts/express-middleware';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import useragent from 'express-useragent';
import mongoose from 'mongoose';
import favicon from 'serve-favicon';

import config from '@/config';
import { validateJWT } from '@/middleware/auth';
import checkReferralCode from '@/middleware/check-referral-code';
import checkTestMode from '@/middleware/check-test-mode';
import checkUtm from '@/middleware/check-utm';
import metricsMiddleware from '@/middleware/metrics';
import ngrokSkipWarning from '@/middleware/ngrok-skip-warning';
import APIRouter from '@/routes/index.routes';
import { logger } from '@/utils/logger';

export class AppServer {
  constructor() {
    this.initializeErrorHandlers();

    this.app = express();
    this.app.use(useragent.express());
    this.app.set('trust proxy', 1);
    this.app.use(cors(config.cors));
    this.app.use(cookieParser());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(favicon(path.join(__dirname, '../../faviconoo.svg')));
    this.app.use(ngrokSkipWarning); // Add ngrok skip warning middleware early
    this.app.use(checkTestMode);
    this.app.use(checkReferralCode);
    this.app.use(metricsMiddleware);
    this.app.use(validateJWT);
    this.app.use(checkUtm);
    this.app.use('/api', APIRouter.getRouter());
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  async gracefulShutdown() {
    logger.info('Starting graceful shutdown...');
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        logger.info('Database connection closed');
      }

      logger.info('Graceful shutdown complete');
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
    } finally {
      // Force exit after timeout
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 5000);
    }
  }

  initializeErrorHandlers() {
    process.on('uncaughtException', async (error) => {
      logger.error(`Uncaught Exception:`, error);
      await this.gracefulShutdown();
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error(`Unhandled Rejection:`, { reason, promise });
      await this.gracefulShutdown();
    });

    // Handle SIGTERM and SIGINT
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received');
      await this.gracefulShutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received');
      await this.gracefulShutdown();
    });
  }

  getApp() {
    return this.app;
  }
}

const appServer = new AppServer();

export default appServer.getApp();
