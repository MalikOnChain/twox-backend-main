import { Server } from 'http';
import 'module-alias/register';

import axios from 'axios';
import colors from 'colors';

import config from '@/config';
import BotUserControllerForCrash from '@/games-v2/BotControllers/BotUserControllerForCrash';
import BotUserControllerForSlots from '@/games-v2/BotControllers/BotUserControllerForSlots';
import appServer from '@/servers/app-server';
import mongoDBServer from '@/servers/mongoDB-server';
import socketServer from '@/servers/socket-server';
import { CashbackService } from '@/services/cashback/Cashback.service';
import { CryptoPriceService } from '@/services/crypto/CryptoPrice.service';
import { isPixLegacyEnabled, isVaultodyLegacyEnabled } from '@/config/legacy-rails';
import { VaultodyService } from '@/services/crypto/Vaultody.service';
import { ConfigValidationService } from '@/services/settings/validationConfig';
import { WagerRaceService } from '@/services/wagerRace/WagerRace.service';
import { scheduleLiquidityReconciliation } from '@/jobs/liquidityReconciliation.job.js';
import { logger } from '@/utils/logger';

class ServerInitializer {
  constructor() {
    this.app = null;
    this.IS_PRODUCTION = process.env.NODE_ENV === 'production';
    this.PORT = process.env.PORT || 5000;
    this.server = null;
    this.configValidator = new ConfigValidationService(config);

    process.title = 'twox-backend';
  }

  async validateConfiguration() {
    logger.info(colors.cyan('============ Configuration Validation ============'));
    const isValid = await this.configValidator.validateAll();
    return isValid;
  }

  async connectToDatabase() {
    logger.info(colors.yellow('⏳ Connecting to the database...'));
    try {
      await mongoDBServer.connect();
      logger.info(colors.green('✅ Database connection successful!'));
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async setupWebSocketServer() {
    logger.info(colors.yellow('⏳ Initializing WebSocket server...'));
    try {
      await socketServer.initialize(this.server, this.app);
      logger.info(colors.green('✅ WebSocket server started successfully!'));
    } catch (error) {
      throw new Error(`WebSocket initialization failed: ${error.message}`);
    }
  }

  setupHttpServer() {
    logger.info(colors.yellow('⏳ Setting up the HTTP server...'));
    try {
      this.app = appServer;
      this.server = new Server(this.app);
      return this.server;
    } catch (error) {
      throw new Error(`HTTP server setup failed: ${error.message}`);
    }
  }

  logServerInfo() {
    logger.info(colors.cyan('============================== Server Information =============================='));
    logger.info(colors.blue(`***🌐 Environment: ${this.IS_PRODUCTION ? 'Production' : 'Development'}`));
    logger.info(colors.blue(`***🚪 Port: ${this.PORT}`));
    logger.info(colors.blue(`***⚡ Process ID: ${process.pid}`));
    logger.info(colors.blue(`***🔧 Node Version: ${process.version}`));
    logger.info(colors.cyan('============================== Server Information ==============================\n'));
  }

  setupErrorHandlers() {
    process.on('uncaughtException', (error) => {
      console.error(colors.red('\n❌ Uncaught Exception:'));
      console.error(error);
      this.gracefulShutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error(colors.red('\n❌ Unhandled Rejection at:'));
      console.error(promise);
      console.error(colors.red('Reason:'), reason);
    });

    process.on('SIGTERM', () => {
      logger.info(colors.yellow('\n⚠️ Received SIGTERM signal'));
      this.gracefulShutdown(0);
    });

    process.on('SIGINT', () => {
      logger.info(colors.yellow('\n⚠️ Received SIGINT signal'));
      this.gracefulShutdown(0);
    });

    process.on('warning', (warning) => {
      logger.info(colors.yellow('Warning Name:'), warning.name);
      logger.info(colors.yellow('Warning Message:'), warning.message);
      logger.info(colors.yellow('Stack Trace:'), warning.stack);
    });
  }

  async gracefulShutdown(exitCode = 0) {
    logger.info(colors.yellow('⏳ Initiating graceful shutdown...'));

    if (this.server) {
      logger.info(colors.yellow('⏳ Closing HTTP server...'));
      await new Promise((resolve) => this.server.close(resolve));
      logger.info(colors.green('✅ HTTP server closed'));
    }

    logger.info(colors.green('👋 Cleanup completed'));
    logger.info(colors.cyan('🔌 Server shutdown complete\n'));

    process.exit(exitCode);
  }

  async initVaultodyService() {
    VaultodyService.initialize(process.env.VAULTODY_API_KEY);
  }

  async initCashbackService() {
    CashbackService.initialize();
  }

  async initCryptoPriceService() {
    CryptoPriceService.initialize();
  }

  async initWagerRaceService() {
    WagerRaceService.initialize();
  }

  async testHealth() {
    try {
      // Wait a bit for server to fully initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const healthUrl = process.env.BACKEND_URL ? process.env.BACKEND_URL + '/api' : `http://localhost:${this.PORT}/api`;
      const response = await axios.get(healthUrl);
      logger.info(colors.green('✅ Health check passed'), response.data);
    } catch (error) {
      logger.warn(colors.yellow('⚠️  Health Check Error:', error.message));
      logger.warn(colors.yellow('   This is usually normal during startup and can be ignored.'));
    }
  }

  async startBotUsers() {
    BotUserControllerForSlots.initializePlayerCache();
    BotUserControllerForSlots.startGeneratingBets();

    BotUserControllerForCrash.initializePlayerCache();
  }

  async start() {
    try {
      logger.info(colors.cyan('🚀 Starting Twox Backend Server...'));

      this.logServerInfo();
      this.setupErrorHandlers();

      const isValid = await this.validateConfiguration();
      if (!isValid) {
        throw new Error('Configuration validation failed. Please check the errors above.');
      }

      // Bind HTTP before Mongo/services so PaaS (e.g. Render) sees an open port quickly.
      // Render times out deploys if nothing listens on $PORT while Mongo retries.
      this.setupHttpServer();

      await new Promise((resolve, reject) => {
        const onListenError = (err) => {
          this.server.off('error', onListenError);
          reject(err);
        };
        this.server.once('error', onListenError);
        this.server.listen(this.PORT, '0.0.0.0', () => {
          this.server.off('error', onListenError);
          resolve(undefined);
        });
      });

      logger.info(
        colors.green(`✅ Server listening on port ${this.PORT} (Production: ${this.IS_PRODUCTION})`)
      );

      try {
        await this.connectToDatabase();
      } catch (error) {
        logger.error('Database connection failed:', error);
        throw error;
      }

      const services = [
        { name: 'CryptoPrice', init: () => this.initCryptoPriceService() },
        ...(isVaultodyLegacyEnabled()
          ? [{ name: 'Vaultody', init: () => this.initVaultodyService() }]
          : []),
        { name: 'Cashback', init: () => this.initCashbackService() },
        { name: 'WagerRace', init: () => this.initWagerRaceService() },
        { name: 'BotUsers', init: () => this.startBotUsers() },
      ];

      if (!isVaultodyLegacyEnabled()) {
        logger.info(colors.yellow('Vaultody legacy disabled (ENABLE_VAULTODY_LEGACY not true)'));
      }
      if (!isPixLegacyEnabled()) {
        logger.info(colors.yellow('PIX legacy API disabled (ENABLE_PIX_LEGACY not true)'));
      }

      for (const service of services) {
        try {
          await service.init();
          logger.info(`${service.name} service initialized successfully`);
        } catch (error) {
          logger.error(`Failed to initialize ${service.name} service:`, error);
          throw error;
        }
      }

      await this.setupWebSocketServer();
      scheduleLiquidityReconciliation();
      await this.testHealth();

      return this.server;
    } catch (error) {
      logger.error(colors.red(`❌ Server startup failed: ${error.message}`));
      await this.gracefulShutdown(1);
      throw error;
    }
  }
}

const serverInitializer = new ServerInitializer();
const server = serverInitializer
  .start()
  .then((server) => server)
  .catch((error) => {
    process.exit(1);
  });

export { server };
