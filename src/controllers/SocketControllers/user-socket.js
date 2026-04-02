import { ROOM_PREFIX } from '@/types/socket/user';
import { SocketError } from '@/utils/error/errors';
import { logger } from '@/utils/logger';
import sessionManager from '@/utils/session/session-manager';

const EMIT_EVENTS = {
  ERROR: 'error',
  USER_PROFILE: 'user:profile',
  USER_STATUS: 'user:status',
  AUTH_LOGOUT_SUCCESS: 'auth:logoutSuccess',
  TOKEN_BALANCE_UPDATE: 'balance:update',
  VIP_STATUS_UPDATE: 'vip:statusUpdate',
  VIP_TIER_UP: 'vip:tierUp',
};

const LISTEN_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  USER_GET_PROFILE: 'user:getProfile',
  AUTH_LOGOUT: 'auth:logout',
  VIP_GET_STATUS: 'vip:getStatus',
};

export class UserSocketController {
  static instance = null;

  constructor() {
    if (UserSocketController.instance) {
      return UserSocketController.instance;
    }
    this.namespace = null;
    /* Rate limiter removed
    this.rateLimiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 100,
    });
    */

    this.eventHandlers = new Map();
    this.setupEventHandlers();

    UserSocketController.instance = this;
  }

  setupEventHandlers() {
    this.eventHandlers.set(LISTEN_EVENTS.USER_GET_PROFILE, this.handleGetProfile.bind(this));
    this.eventHandlers.set(LISTEN_EVENTS.AUTH_LOGOUT, this.handleLogout.bind(this));
    this.eventHandlers.set(LISTEN_EVENTS.DISCONNECT, this.handleDisconnect.bind(this));
  }

  init(namespace, cb) {
    this.namespace = namespace;

    this.namespace.on(LISTEN_EVENTS.CONNECTION, (socket) => {
      try {
        cb(socket);
        if (!socket.user) {
          logger.warn(`Unauthorized socket connection attempt: ${socket.id}`);
          socket.emit(EMIT_EVENTS.ERROR, {
            message: 'Unauthorized connection',
          });
          socket.disconnect(true);
          return;
        }

        // Join user's personal room
        const userId = socket.user._id.toString();
        socket.join(`${ROOM_PREFIX.USER}${userId}`);

        // Set up event listeners
        this.eventHandlers.forEach((handler, event) => {
          socket.on(event, async (...args) => {
            try {
              await this.handleEvent(socket, handler, ...args);
            } catch (error) {
              this.handleError(socket, error);
            }
          });
        });

        // Emit initial online status
        this.namespace.emit(EMIT_EVENTS.USER_STATUS, {
          userId,
          status: 'online',
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error('Error initializing user socket:', error);
        socket.emit(EMIT_EVENTS.ERROR, {
          message: 'Failed to initialize connection',
        });
        socket.disconnect(true);
      }
    });

    logger.info(`UserSocketController initialized on route: ${namespace?.name}`);
  }

  async handleEvent(socket, handler, ...args) {
    /* Rate limit check removed
    if (!(await this.rateLimiter.checkLimit(socket.handshake.address))) {
      throw new SocketError('Rate limit exceeded', 429);
    }
    */

    await handler(socket, ...args);
  }

  handleError(socket, error) {
    const errorMessage = error instanceof SocketError ? error.message : 'Internal server error';

    const errorCode = error instanceof SocketError ? error.code : 500;

    logger.error('Socket error:', {
      socketId: socket.id,
      userId: socket.user?._id,
      error: error.message,
      stack: error.stack,
    });

    socket.emit(EMIT_EVENTS.ERROR, {
      message: errorMessage,
      code: errorCode,
    });
  }

  async handleGetProfile(socket) {
    try {
      const profile = {
        username: socket.user.username,
        balance: socket.user.balance,
        lastActive: Date.now(),
      };

      await sessionManager.updateUserLastActive(socket.user._id);
      socket.emit(EMIT_EVENTS.USER_PROFILE, profile);

      logger.debug('Profile sent:', {
        userId: socket.user._id,
        username: socket.user.username,
      });
    } catch (error) {
      throw new SocketError('Failed to fetch profile', 500);
    }
  }

  async handleLogout(socket) {
    try {
      const userId = socket.user._id.toString();

      await this.cleanupUserSession(socket);
      socket.emit(EMIT_EVENTS.AUTH_LOGOUT_SUCCESS);

      if (!(await sessionManager.isUserActive(userId))) {
        this.emitUserStatus(userId, 'offline');
      }

      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      throw new SocketError('Logout failed', 500);
    }
  }

  async handleDisconnect(socket) {
    try {
      if (socket.user) {
        const userId = socket.user._id.toString();

        await this.cleanupUserSession(socket);
        if (!(await sessionManager.isUserActive(userId))) {
          this.emitUserStatus(userId, 'offline');
        }

        logger.info(`User disconnected: ${userId}`);
      }
    } catch (error) {
      logger.error('Error handling disconnect:', error);
    }
  }

  async cleanupUserSession(socket) {
    const userId = socket.user._id.toString();
    await sessionManager.removeUserSession(socket.id);
    socket.leave(`${ROOM_PREFIX.USER}${userId}`);
    delete socket.user;
  }

  emitUserStatus(userId, status) {
    if (!this.namespace) {
      logger.error('Namespace not initialized');
      return;
    }

    this.namespace.emit(EMIT_EVENTS.USER_STATUS, {
      userId,
      status,
      timestamp: Date.now(),
    });
  }

  async emitBalanceUpdate({ userId, balance, type, metadata = {} }) {
    try {
      if (!this.namespace) {
        throw new Error('Namespace not initialized');
      }

      if (!userId) {
        throw new Error('Invalid parameters for game token update');
      }

      this.namespace.to(`${ROOM_PREFIX.USER}${userId}`).emit(EMIT_EVENTS.TOKEN_BALANCE_UPDATE, {
        userId,
        balance,
        timestamp: Date.now(),
        type,
        metadata,
      });
    } catch (error) {
      logger.error('Error emitting game token update:', error);
    }
  }

  emitVipStatusUpdate(userId, vipData) {
    try {
      if (!this.namespace) {
        throw new Error('Namespace not initialized');
      }

      this.namespace.to(`${ROOM_PREFIX.USER}${userId}`).emit(EMIT_EVENTS.VIP_STATUS_UPDATE, {
        ...vipData,
        timestamp: Date.now(),
      });

      // logger.info('VIP status updated:', { userId, ...vipData });
    } catch (error) {
      logger.error('Error emitting VIP status update:', error);
    }
  }

  emitVipTierUp(userId, newTier, oldTier) {
    try {
      // Emit tier up event
      this.namespace.to(`${ROOM_PREFIX.USER}${userId}`).emit(EMIT_EVENTS.VIP_TIER_UP, {
        userId,
        newTier,
        oldTier,
        timestamp: Date.now(),
      });

      logger.info('VIP tier up:', { userId, newTier, oldTier });
    } catch (error) {
      logger.error('Error emitting VIP tier up:', error);
    }
  }

  async isUserOnline(userId) {
    try {
      return await sessionManager.isUserActive(userId);
    } catch (error) {
      logger.error('Error checking user online status:', error);
      return false;
    }
  }

  cleanup() {
    try {
      if (this.namespace) {
        this.namespace.removeAllListeners();
      }
      logger.info('UserSocketController cleaned up');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

// Create singleton instance
const userSocketController = new UserSocketController();
export default userSocketController;
