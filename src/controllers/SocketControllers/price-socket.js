// services/PriceSocketService.js
import config from '@/config';
import CryptoPriceService from '@/services/crypto/CryptoPrice.service';
import { CRYPTO_SYMBOLS } from '@/types/vaultody/vaultody';
import { SocketError } from '@/utils/error/errors';
import { logger } from '@/utils/logger/index.js';
// const { RateLimiter } = require('../../utils/rate-limiter');

const EMIT_EVENTS = {
  ERROR: 'price:error',
  SERVICE_STATUS: 'price:serviceStatus',
  UPDATE_ALL: 'price:updateAll',
};

const LISTEN_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  GET_ALL: 'price:getAll',
  ERROR: 'error',
};

class PriceSocketService {
  static instance = null;

  constructor() {
    if (PriceSocketService.instance) {
      return PriceSocketService.instance;
    }

    // Configuration
    this.UPDATE_INTERVAL = Number(process.env.PRICE_UPDATE_INTERVAL) || 30000;
    this.CACHE_DURATION = Number(process.env.PRICE_CACHE_DURATION) || 5000;
    this.MAX_RETRIES = Number(process.env.PRICE_MAX_RETRIES) || 3;
    this.RETRY_DELAY = Number(process.env.PRICE_RETRY_DELAY) || 1000;
    this.MAX_PRICE_AGE = Number(process.env.MAX_PRICE_AGE) || 300000; // 5 minutes
    this.HEALTH_CHECK_INTERVAL = 60000; // 1 minute

    // Service state
    this.namespace = null;
    this.cryptoPriceService = null;
    this.pollingInterval = null;
    this.healthCheckInterval = null;
    this.priceCache = new Map();
    this.lastUpdateTime = null;
    this.failedAttempts = new Map();
    this.isPolling = false;
    this.isHealthy = true;

    // Rate limiting removed
    /*
    this.rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 100,
      waitTimeout: 2000,
    });
    */

    PriceSocketService.instance = this;
  }

  init(namespace, cb) {
    try {
      this.namespace = namespace;
      this.cryptoPriceService = CryptoPriceService;

      // Add namespace middleware for basic checks
      this.namespace.use(this.middlewareHandler.bind(this));

      // Set up connection handling
      this.namespace.on(LISTEN_EVENTS.CONNECTION, async (socket) => {
        if (typeof cb === 'function') {
          cb(socket);
        }
        this.setupSocketHandlers(socket);
        await this.sendAllPrices(socket);
      });

      // Start health monitoring
      this.startHealthCheck();

      // Start price polling
      this.startPricePolling();

      logger.info(`PriceSocketService initialized on route: ${namespace?.name}`);
    } catch (error) {
      logger.error('Failed to initialize PriceSocketService:', error);
      throw error;
    }
  }

  async middlewareHandler(socket, next) {
    try {
      // Check rate limit removed
      /*
      if (!(await this.rateLimiter.checkLimit(socket.handshake.address))) {
        return next(new SocketError('Rate limit exceeded', 429));
      }
      */

      // Check service health
      if (!this.isHealthy) {
        return next(new SocketError('Service temporarily unavailable', 503));
      }

      next();
    } catch (error) {
      next(new SocketError('Middleware error', 500));
    }
  }

  setupSocketHandlers(socket) {
    const handlers = {
      [LISTEN_EVENTS.GET_ALL]: async () => {
        try {
          await this.validateRequest(socket);
          await this.sendAllPrices(socket);
        } catch (error) {
          this.handleError(socket, error);
        }
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });
  }

  async validateRequest(_socket) {
    // Rate limit check removed
    /*
    if (!(await this.rateLimiter.checkLimit(socket.handshake.address))) {
      throw new SocketError('Rate limit exceeded', 429);
    }
    */

    if (!this.isHealthy) {
      throw new SocketError('Service temporarily unavailable', 503);
    }
  }

  handleSocketError(socket, error) {
    logger.error('Socket error:', { socketId: socket.id, error });
    this.handleError(socket, error);
  }

  handleError(socket, error) {
    const errorMessage = error instanceof SocketError ? error.message : 'Internal server error';
    const errorCode = error instanceof SocketError ? error.code : 500;

    logger.error('Price service error:', {
      socketId: socket.id,
      error: error.message,
      stack: error.stack,
    });

    socket.emit(EMIT_EVENTS.ERROR, {
      message: errorMessage,
      code: errorCode,
      timestamp: Date.now(),
    });
  }

  getExchangeRate(price) {
    if (!price || price <= 0) {
      throw new SocketError('Invalid price value', 400);
    }
    return Number(config.gameTokenRate) / Number(price);
  }

  async fetchPriceWithRetry(symbol) {
    const backoffDelays = Array.from({ length: this.MAX_RETRIES }, (_, i) => this.RETRY_DELAY * Math.pow(2, i));

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const price = await this.cryptoPriceService.getPriceInUSD(symbol);
        this.failedAttempts.set(symbol, 0);
        return price;
      } catch (error) {
        const failures = (this.failedAttempts.get(symbol) || 0) + 1;
        this.failedAttempts.set(symbol, failures);

        if (attempt === this.MAX_RETRIES - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, backoffDelays[attempt]));
      }
    }
  }

  isCacheValid(symbol) {
    const cached = this.priceCache.get(symbol);
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    return age < this.CACHE_DURATION;
  }

  async getAllPrices() {
    const prices = {};
    const fetchPromises = [];

    for (const [blockchain, symbol] of Object.entries(CRYPTO_SYMBOLS)) {
      if (this.isCacheValid(symbol)) {
        prices[symbol] = this.priceCache.get(symbol).data;
        continue;
      }

      fetchPromises.push(
        this.fetchPriceWithRetry(symbol)
          .then((price) => {
            const priceData = {
              symbol,
              blockchain,
              price: this.getExchangeRate(price),
            };

            this.priceCache.set(symbol, {
              timestamp: Date.now(),
              data: priceData,
            });

            prices[symbol] = priceData;
          })
          .catch((error) => {
            logger.error(`Error fetching price for ${symbol}:`, error);
            const cached = this.priceCache.get(symbol);
            if (cached) {
              prices[symbol] = {
                ...cached.data,
                isStale: true,
                lastUpdated: cached.timestamp,
              };
            }
          })
      );
    }

    await Promise.allSettled(fetchPromises);
    return prices;
  }

  async sendAllPrices(socket) {
    try {
      const prices = await this.getAllPrices();
      socket.emit(EMIT_EVENTS.UPDATE_ALL, prices);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async broadcastAllPrices() {
    try {
      const prices = await this.getAllPrices();

      this.lastUpdateTime = Date.now();
      this.namespace.emit(EMIT_EVENTS.UPDATE_ALL, prices);

      this.checkServiceHealth();
    } catch (error) {
      logger.error('Error broadcasting prices:', error);
      this.checkServiceHealth(error);
    }
  }

  startPricePolling() {
    if (this.isPolling) return;

    try {
      this.isPolling = true;
      this.broadcastAllPrices();

      this.pollingInterval = setInterval(async () => {
        await this.broadcastAllPrices();
      }, this.UPDATE_INTERVAL);

      logger.info('Price polling started');
    } catch (error) {
      logger.error('Error starting price polling:', error);
      this.isPolling = false;
    }
  }

  stopPricePolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      logger.info('Price polling stopped');
    }
  }

  startHealthCheck() {
    this.healthCheckInterval = setInterval(() => this.checkServiceHealth(), this.HEALTH_CHECK_INTERVAL);
  }

  checkServiceHealth(error = null) {
    try {
      const now = Date.now();
      const criticalFailures = Array.from(this.failedAttempts.values()).filter(
        (count) => count > this.MAX_RETRIES
      ).length;

      const isHealthy =
        !error && (!this.lastUpdateTime || now - this.lastUpdateTime < this.MAX_PRICE_AGE) && criticalFailures === 0;

      if (this.isHealthy !== isHealthy) {
        this.isHealthy = isHealthy;
        logger.warn(`Service health status changed to: ${isHealthy ? 'healthy' : 'unhealthy'}`);

        this.namespace.emit(EMIT_EVENTS.SERVICE_STATUS, {
          status: isHealthy ? 'healthy' : 'degraded',
          timestamp: now,
        });
      }
    } catch (error) {
      logger.error('Error checking service health:', error);
    }
  }

  isPriceDataStale() {
    return !this.lastUpdateTime || Date.now() - this.lastUpdateTime > this.MAX_PRICE_AGE;
  }

  cleanup() {
    try {
      this.stopPricePolling();

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      this.priceCache.clear();
      this.failedAttempts.clear();

      if (this.namespace) {
        this.namespace.removeAllListeners();
      }

      this.isHealthy = false;
      logger.info('PriceSocketService cleaned up');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

// Create singleton instance
const priceSocketService = new PriceSocketService();
export default priceSocketService;
