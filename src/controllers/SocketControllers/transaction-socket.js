import config from '@/config';
import TransactionService from '@/services/user/Transaction.service';
import { ROOM_PREFIX } from '@/types/socket/user';
import { SocketError } from '@/utils/error/errors';
import { logger } from '@/utils/logger';
// const { RateLimiter } = require('../../utils/rate-limiter');

const EMIT_EVENTS = {
  ERROR: 'error',
  SERVICE_STATUS: 'service-status',
  GET_TRANSACTIONS: 'transaction:get',
  GET_NEW_TRANSACTIONS: 'transaction:new',
  GET_SERVICE_TRANSACTIONS: 'service-transaction:get',
  GET_GAME_TRANSACTIONS: 'game-transaction:get',
  GET_NEW_GAME_TRANSACTIONS: 'game-transaction:new',
};

const LISTEN_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  GET_TRANSACTIONS: 'transaction:get',
  GET_SERVICE_TRANSACTIONS: 'service-transaction:get',
  GET_GAME_TRANSACTIONS: 'game-transaction:get',
  ERROR: 'error',
};

export class TransactionSocketService {
  static instance = null;

  constructor() {
    if (TransactionSocketService.instance) {
      return TransactionSocketService.instance;
    }

    // Rate limiting configuration removed
    /*
    this.rateLimiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      waitTimeout: 2000,
    });
    */

    this.isHealthy = false;
    this.connectedClients = new Map();
    this.healthCheckInterval = null;
    this.users = new Map();
    this.adminSocket = null;
    this.namespace = null;
    this.userTransactionService = TransactionService;
    TransactionSocketService.instance = this;
  }

  init(namespace, cb) {
    try {
      this.namespace = namespace;
      // Add namespace middleware for basic checks
      this.namespace.use(this.middlewareHandler.bind(this));

      // Set up connection handling
      this.namespace.on(LISTEN_EVENTS.CONNECTION, async (socket) => {
        if (typeof cb === 'function') {
          cb(socket);
        }
        await this.handleConnection(socket);
      });

      // Start health monitoring
      this.startHealthCheck();

      this.isHealthy = true;
    } catch (error) {
      logger.error('Failed to initialize TransactionSocketService:', error);
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

  async handleConnection(socket) {
    try {
      this.connectedClients.set(socket.id, {
        id: socket.id,
        address: socket.handshake.address,
        connectedAt: new Date(),
      });

      // Setup disconnect handler
      socket.on(LISTEN_EVENTS.DISCONNECT, () => {
        this.handleDisconnect(socket);
      });

      // Setup error handler
      socket.on(LISTEN_EVENTS.ERROR, (error) => {
        this.handleError(socket, error);
      });

      if (socket.user?.id) {
        this.users.set(socket.user.id, {
          id: socket.id,
          userId: socket.user.id,
        });
      } else if (socket.shared) {
        this.adminSocket = socket.id;
      }

      // Setup other event handlers
      this.setupSocketHandlers(socket);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  handleDisconnect(socket) {
    try {
      if (socket.user?.id) {
        this.users.delete(socket.user?.id);
      } else if (socket.shared) {
        this.adminSocket = null;
      }
      this.connectedClients.delete(socket.id);
      logger.info(`Client disconnected: ${socket.id}`);
    } catch (error) {
      logger.error(`Error handling disconnect for ${socket.id}:`, error);
    }
  }

  handleError(socket, error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error.code || 500;

    socket.emit(EMIT_EVENTS.ERROR, {
      message: errorMessage,
      code: errorCode,
    });

    logger.error(`Socket error for ${socket.id}:`, error);
  }

  emitTransactionConfirmation(transaction) {
    this.namespace.to(`${ROOM_PREFIX.USER}${transaction.userId}`).emit(EMIT_EVENTS.GET_NEW_TRANSACTIONS, transaction);
  }

  async emitTransactions(socket, options = {}) {
    const user = socket.user;
    if (!user) {
      return socket.emit(EMIT_EVENTS.ERROR, {
        message: 'User not found',
      });
    }

    try {
      const { page = 1, limit } = options;

      // Get transactions with pagination
      const userCryptoTransactions = await this.userTransactionService.getCryptoTransactions(user.id, page, limit);
      socket.emit(EMIT_EVENTS.GET_TRANSACTIONS, {
        transactions: userCryptoTransactions.transactions,
        pagination: userCryptoTransactions.pagination,
        message: 'Transactions fetched successfully',
      });
    } catch (error) {
      logger.error(`Error in emitTransactions for user ${user.id}:`, error);
      socket.emit(EMIT_EVENTS.ERROR, {
        message: 'Failed to process transaction request',
        code: error.code || 500,
      });
    }
  }

  async emitServiceTransactions(socket, options = {}) {
    const user = socket.user;
    if (!user) {
      return socket.emit(EMIT_EVENTS.ERROR, {
        message: 'User not found',
      });
    }

    try {
      const { page = 1, limit, filter } = options;

      // Get transactions with pagination
      const userCryptoTransactions = await this.userTransactionService.getServiceTransactions(
        user.id,
        page,
        limit,
        filter
      );
      socket.emit(EMIT_EVENTS.GET_SERVICE_TRANSACTIONS, {
        transactions: userCryptoTransactions.transactions,
        pagination: userCryptoTransactions.pagination,
        message: 'Service Transactions fetched successfully',
      });
    } catch (error) {
      logger.error(`Error in emitServiceTransactions for user ${user.id}:`, error);
      socket.emit(EMIT_EVENTS.ERROR, {
        message: 'Failed to process service transaction request',
        code: error.code || 500,
      });
    }
  }

  async emitGameTransactions(socket, options = {}) {
    const user = socket.user;
    if (!user) {
      return socket.emit(EMIT_EVENTS.ERROR, {
        message: 'User not found',
      });
    }

    try {
      const { page = 1, limit, filter } = options;

      // Get transactions with pagination
      const userCryptoTransactions = await this.userTransactionService.getGameTransactions(
        user.id,
        page,
        limit,
        filter
      );

      socket.emit(EMIT_EVENTS.GET_GAME_TRANSACTIONS, {
        transactions: userCryptoTransactions.transactions,
        pagination: userCryptoTransactions.pagination,
        message: 'Game Transactions fetched successfully',
      });
    } catch (error) {
      logger.error(`Error in emitGameTransactions for user ${user.id}:`, error);
      socket.emit(EMIT_EVENTS.ERROR, {
        message: 'Failed to process game transaction request',
        code: error.code || 500,
      });
    }
  }

  setupSocketHandlers(socket) {
    // Listen for pagination requests
    socket.on(LISTEN_EVENTS.GET_TRANSACTIONS, (options) => {
      this.emitTransactions(socket, options);
    });

    socket.on(LISTEN_EVENTS.GET_SERVICE_TRANSACTIONS, (options) => {
      this.emitServiceTransactions(socket, options);
    });

    socket.on(LISTEN_EVENTS.GET_GAME_TRANSACTIONS, (options) => {
      this.emitGameTransactions(socket, options);
    });
  }

  startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      try {
        // Implement health check logic here
        this.isHealthy = true;
        this.namespace.emit(EMIT_EVENTS.SERVICE_STATUS, { healthy: this.isHealthy });
      } catch (error) {
        logger.error('Health check failed:', error);
        this.isHealthy = false;
      }
    }, config.healthCheckInterval || 30000);
  }

  cleanup() {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      this.connectedClients.clear();

      if (this.namespace) {
        this.namespace.removeAllListeners();
      }

      this.isHealthy = false;
      logger.info('TriviaSocketService cleaned up');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  static getInstance() {
    if (!TransactionSocketService.instance) {
      TransactionSocketService.instance = new TransactionSocketService();
    }
    return TransactionSocketService.instance;
  }
}

// Create singleton instance
const transactionSocketService = new TransactionSocketService();
export default transactionSocketService;
