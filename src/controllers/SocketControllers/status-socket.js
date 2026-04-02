import config from '@/config';
import { ROOM_PREFIX } from '@/types/socket/user';
import { SocketError } from '@/utils/error/errors';
import { logger } from '@/utils/logger';

const EMIT_EVENTS = {
  ERROR: 'error',
  SERVICE_STATUS: 'service-status',
  ACTIVE_USERS: 'active-users',
  USER_STATUS_CHANGE: 'user-status-change',
  SYSTEM_STATS: 'system-stats',
  AUTH_REFRESH: 'auth:refresh',
  NEW_EVENT: 'new-event',
};

const LISTEN_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  GET_ACTIVE_USERS: 'get-active-users',
  GET_SYSTEM_STATS: 'get-system-stats',
  SUBSCRIBE_STATUS_UPDATES: 'subscribe-status-updates',
};

export class StatusSocket {
  static instance = null;

  constructor() {
    if (StatusSocket.instance) {
      return StatusSocket.instance;
    }

    // Session management (integrated from session-manager.js)
    this.userSessions = new Map(); // userId -> Set of socket IDs
    this.socketToUser = new Map(); // socketId -> userId
    this.io = null;

    this.isHealthy = false;
    this.connectedClients = new Map();
    this.healthCheckInterval = null;
    this.statusUpdateInterval = null;
    this.activeUsersInterval = null;
    this.activeUsersForAdminInterval = null;

    StatusSocket.instance = this;
  }
  // Original StatusSocket methods
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

      this.startHealthCheck();
      this.startStatusUpdates();

      this.isHealthy = true;
    } catch (error) {
      logger.error('Failed to initialize StatusSocket:', error);
      throw error;
    }
  }

  async middlewareHandler(socket, next) {
    try {
      // Check service health
      if (!this.isHealthy) {
        return next(new SocketError('Service temporarily unavailable', 503));
      }

      next();
    } catch (error) {
      next(new SocketError('Middleware error', 500));
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

  async handleConnection(socket) {
    try {
      // Store client information
      // Track user session if authenticated
      if (socket.user) {
        this.addUserSession(socket.user.id, socket.id);
      }

      this.connectedClients.set(socket.id, {
        id: socket.id,
        address: socket.handshake.address,
        connectedAt: new Date(),
        isAdmin: socket.user?.isAdmin || false,
      });

      // Setup disconnect handler
      socket.on(LISTEN_EVENTS.DISCONNECT, () => {
        this.handleDisconnect(socket);
      });

      // Setup error handler
      socket.on(LISTEN_EVENTS.ERROR, (error) => {
        this.handleError(socket, error);
      });

      // Setup other event handlers
      this.setupSocketHandlers(socket);

      // Send initial active users data
      this.sendActiveUsersData(socket);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  handleDisconnect(socket) {
    try {
      this.connectedClients.delete(socket.id);
      if (socket.user) {
        this.removeUserSession(socket.id);
      }
    } catch (error) {
      logger.error(`Error handling disconnect for ${socket.id}:`, error);
    }
  }

  setupSocketHandlers(socket) {
    // Setup status handlers
    socket.on(LISTEN_EVENTS.GET_ACTIVE_USERS, () => this.sendActiveUsersData(socket));
    socket.on(LISTEN_EVENTS.GET_SYSTEM_STATS, () => this.sendSystemStats(socket));
    socket.on(LISTEN_EVENTS.SUBSCRIBE_STATUS_UPDATES, (data) => this.handleStatusSubscription(socket, data));
  }

  startStatusUpdates() {
    this.statusUpdateInterval = setInterval(() => {
      try {
        this.broadcastActiveUsers();
      } catch (error) {
        logger.error('Status update failed:', error);
      }
    }, config.statusSocket.statusUpdateInterval || 10000); // Default to 10 seconds
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
    }, config.statusSocket.healthCheckInterval || 30000);
  }

  addUserSession(userId, socketId) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(socketId);

    // Store user details with the socket mapping
    const socket = this.namespace.sockets.get(socketId);
    if (socket && socket.user) {
      this.socketToUser.set(socketId, {
        userId,
        username: socket.user.username,
        avatar: socket.user.avatar,
      });
    } else {
      this.socketToUser.set(socketId, { userId });
    }
  }

  removeUserSession(socketId) {
    const userInfo = this.socketToUser.get(socketId);
    if (userInfo) {
      const userId = userInfo.userId;
      const userSessions = this.userSessions.get(userId);
      if (userSessions) {
        userSessions.delete(socketId);
        if (userSessions.size === 0) {
          this.userSessions.delete(userId);
        }
      }
      this.socketToUser.delete(socketId);

      return userId;
    }
    return null;
  }

  getUserSessions(userId) {
    return this.userSessions.get(userId) || new Set();
  }

  isUserActive(userId) {
    const sessions = this.userSessions.get(userId);
    return sessions ? sessions.size > 0 : false;
  }

  getDiagnostics() {
    try {
      // Calculate unique verified users (those with a userId)
      const verifiedUsers = new Map();
      this.socketToUser.forEach((userInfo, socketId) => {
        if (userInfo.userId) {
          verifiedUsers.set(userInfo.userId, {
            userId: userInfo.userId,
            username: userInfo.username,
            avatar: userInfo.avatar,
            socketId: socketId,
          });
        }
      });

      // Calculate anonymous connections (sockets without a user)
      const anonymousConnections = this.connectedClients.size - verifiedUsers.size;

      return {
        uniqueVerifiedUsers: verifiedUsers.size,
        anonymousConnections,
        totalConnections: this.connectedClients.size,
        verifiedUsers: Array.from(verifiedUsers.values()), // Contains user details
        clientDetails: Array.from(this.connectedClients.values()), // Only send to admins
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Error getting diagnostics:', error);
      return {
        uniqueVerifiedUsers: 0,
        anonymousConnections: 0,
        totalConnections: 0,
        verifiedUsers: [],
        timestamp: new Date(),
      };
    }
  }

  async sendNewEvent({ userId, type, message, success, metadata }) {
    const event = {
      type,
      message,
      success: success || true,
      metadata,
    };

    this.namespace.to(`${ROOM_PREFIX.USER}${userId}`).emit(EMIT_EVENTS.NEW_EVENT, event);
  }

  async sendActiveUsersData(socket) {
    try {
      const activeUsers = this.getDiagnostics();

      // Only send detailed user data to admin users
      if (socket.user?.isAdmin) {
        socket.emit(EMIT_EVENTS.ACTIVE_USERS, activeUsers);
      } else {
        // For regular users, still include verified users but exclude clientDetails
        socket.emit(EMIT_EVENTS.ACTIVE_USERS, {
          uniqueVerifiedUsers: activeUsers.uniqueVerifiedUsers,
          anonymousConnections: activeUsers.anonymousConnections,
          totalConnections: activeUsers.totalConnections,
          verifiedUsers: activeUsers.verifiedUsers,
          timestamp: activeUsers.timestamp,
        });
      }
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async sendSystemStats(socket) {
    try {
      // Only admins can get system stats
      if (!socket.user?.isAdmin) {
        throw new SocketError('Unauthorized', 403);
      }

      const stats = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        activeServices: Array.from(this.getActiveServices()),
        timestamp: new Date(),
      };

      socket.emit(EMIT_EVENTS.SYSTEM_STATS, stats);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  handleStatusSubscription(socket, data) {
    try {
      const { subscribe = true } = data || {};

      // Mark socket as subscribed or unsubscribed to status updates
      this.connectedClients.set(socket.id, {
        ...this.connectedClients.get(socket.id),
        subscribedToStatusUpdates: subscribe,
      });
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  broadcastActiveUsers() {
    try {
      const activeUsers = this.getDiagnostics();

      // Broadcast to all clients
      for (const [socketId, client] of this.connectedClients.entries()) {
        if (client.subscribedToStatusUpdates) {
          const socket = this.namespace.sockets.get(socketId);
          if (socket) {
            if (socket.user?.isAdmin) {
              socket.emit(EMIT_EVENTS.ACTIVE_USERS, activeUsers);
            } else {
              // For regular users, include verified users but exclude clientDetails
              socket.emit(EMIT_EVENTS.ACTIVE_USERS, {
                uniqueVerifiedUsers: activeUsers.uniqueVerifiedUsers,
                anonymousConnections: activeUsers.anonymousConnections,
                totalConnections: activeUsers.totalConnections,
                verifiedUsers: activeUsers.verifiedUsers,
                timestamp: activeUsers.timestamp,
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error broadcasting active users:', error);
    }
  }

  cleanup() {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      if (this.statusUpdateInterval) {
        clearInterval(this.statusUpdateInterval);
        this.statusUpdateInterval = null;
      }

      this.connectedClients.clear();
      this.userSessions.clear();
      this.socketToUser.clear();

      if (this.namespace) {
        this.namespace.removeAllListeners();
      }

      this.isHealthy = false;
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  // User connection management methods for socket-server integration
  disconnectUser(userId) {
    const userSessions = this.getUserSessions(userId);
    for (const socketId of userSessions) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
      this.removeUserSession(socketId);
    }
  }

  disconnectNamespace(namespace) {
    // Filter sockets by namespace
    const namespaceSockets = Array.from(this.socketToUser.keys()).filter((socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      return socket && socket.nsp.name === namespace;
    });

    for (const socketId of namespaceSockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
      this.removeUserSession(socketId);
    }
  }

  broadcastToUser(userId, event, data, namespace = null) {
    const userSessions = this.getUserSessions(userId);
    for (const socketId of userSessions) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && (!namespace || socket.nsp.name === namespace)) {
        socket.emit(event, data);
      }
    }
  }

  static getInstance() {
    if (!StatusSocket.instance) {
      StatusSocket.instance = new StatusSocket();
    }
    return StatusSocket.instance;
  }
}

// Create singleton instance
const statusSocket = new StatusSocket();
export default statusSocket;
