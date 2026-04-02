import { Server } from 'socket.io';

import config from '@/config';
import betHistorySocket from '@/controllers/SocketControllers/bet-history-socket';
import chatSocket from '@/controllers/SocketControllers/chat-socket';
import notificationSocket from '@/controllers/SocketControllers/notification-socket';
import priceSocket from '@/controllers/SocketControllers/price-socket';
import statusSocket from '@/controllers/SocketControllers/status-socket';
import transactionSocket from '@/controllers/SocketControllers/transaction-socket';
import triviaSocket from '@/controllers/SocketControllers/trivia-socket';
import userSocket from '@/controllers/SocketControllers/user-socket';
import socketAuthMiddleware from '@/middleware/socket-auth';
import { logger } from '@/utils/logger';

const socketNamespaces = config.socketNamespaces;

// Service configurations remain the same
const SERVICES = {
  CORE: {
    PRICE: {
      name: 'price',
      service: priceSocket,
      namespace: socketNamespaces.PRIVATE.PRICE,
      envDisableKey: 'PRICE_SOCKET_SERVICE_DISABLE',
    },
    CHAT: {
      name: 'chat',
      service: chatSocket,
      namespace: socketNamespaces.PUBLIC.CHAT,
      envDisableKey: 'CHAT_SOCKET_SERVICE_DISABLE',
    },
    USER: {
      name: 'user',
      service: userSocket,
      namespace: socketNamespaces.PRIVATE.USER,
      envDisableKey: 'USER_SOCKET_SERVICE_DISABLE',
    },
    BET_HISTORY: {
      name: 'bet-history',
      service: betHistorySocket,
      namespace: socketNamespaces.PUBLIC.BET_HISTORY,
      envDisableKey: 'BET_HISTORY_SOCKET_SERVICE_DISABLE',
    },
    NOTIFICATION: {
      name: 'notification',
      service: notificationSocket,
      namespace: socketNamespaces.PUBLIC.NOTIFICATION,
      envDisableKey: 'NOTIFICATION_SOCKET_SERVICE_DISABLE',
    },
    STATUS: {
      name: 'status',
      service: statusSocket,
      namespace: socketNamespaces.PUBLIC.STATUS,
      envDisableKey: 'STATUS_SOCKET_SERVICE_DISABLE',
    },
    TRIVIA: {
      name: 'trivia',
      service: triviaSocket,
      namespace: socketNamespaces.PRIVATE.TRIVIA,
      envDisableKey: 'TRIVIA_SOCKET_SERVICE_DISABLE',
    },
    TRANSACTION: {
      name: 'transaction',
      service: transactionSocket,
      namespace: socketNamespaces.PRIVATE.TRANSACTION,
      envDisableKey: 'TRANSACTION_SOCKET_SERVICE_DISABLE',
    },
  },
  GAMES: {
    // CRASH: {
    //   name: 'crash',
    //   service: require('../games-v2/crash'),
    //   namespace: socketNamespaces.PUBLIC.CRASH,
    //   envDisableKey: 'CRASH_SERVICE_DISABLE',
    // },
  },
};

export class SocketServer {
  static instance = null;

  constructor() {
    if (SocketServer.instance) {
      return SocketServer.instance;
    }

    this.io = null;
    this.services = new Map();
    this.NAMESPACES = Object.fromEntries(
      Object.values({ ...SERVICES.CORE, ...SERVICES.GAMES }).map((service) => [
        service.name.toUpperCase(),
        service.namespace,
      ])
    );

    SocketServer.instance = this;
  }

  async initialize(server, app) {
    try {
      this.io = new Server(server, { 
        cors: config.cors,
        transports: ['polling', 'websocket'],
        allowEIO3: true
      });
      this.setupDefaultService();
      await this.initializeServices();
      app.set('socketio', this.io);
      logger.info('WebSocket server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize socket server:', error);
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
  }

  setupDefaultService() {
    const handleDisconnection = (socket) => {
      try {
        const userId = socket.user?.id;
        statusSocket.removeUserSession(socket.id);

        logger.info('Socket disconnected:', {
          socketId: socket.id,
          userId: userId,
        });
      } catch (error) {
        logger.error('Error handling disconnection:', {
          socketId: socket.id,
          error,
        });
      }
    };

    const handleNewConnection = (socket) => {
      try {
        const userId = socket.user?.id;
        logger.info('New socket connection:', {
          socketId: socket.id,
          userId: userId,
          isAuthenticated: !!socket.user,
        });

        if (socket.user) {
          statusSocket.addUserSession(userId, socket.id);
        }
        socket.on('disconnect', () => {
          handleDisconnection(socket);
        });
      } catch (error) {
        logger.error('Error handling new connection:', {
          socketId: socket.id,
          error,
        });
      }
    };

    this.io.of('/').use(socketAuthMiddleware);

    this.io.of('/').use((socket, next) => {
      socket.on('error', (error) => {
        logger.error('Socket error:', { socketId: socket.id, error });
        statusSocket.removeUserSession(socket.id);
      });
      next();
    });

    this.io.of('/').on('connection', (socket) => {
      handleNewConnection(socket);
    });
  }

  async initializeServices() {
    try {
      //core services
      const coreServices = Object.values(SERVICES.CORE);
      await this.initializeServiceGroup(coreServices);

      //game services
      const gameServices = Object.values(SERVICES.GAMES);
      await this.initializeServiceGroup(gameServices);
    } catch (error) {
      logger.error('Error initializing services:', error);
      throw error;
    }
  }

  async initializeServiceGroup(services) {
    for (const service of services) {
      if (!this.isServiceDisabled(service.envDisableKey)) {
        await this.initializeService(service.name, service.service, service.namespace);
      }
    }
  }

  async initializeService(name, service, namespace) {
    try {
      if (service && typeof service.init === 'function') {
        const partIo = this.io.of(namespace);
        partIo.use(socketAuthMiddleware);

        const connectionCB = (socket) => {
          const userId = socket.user?.id;

          logger.info(`Socket connected on namespace ${namespace}:`, {
            socketId: socket.id,
            namespace,
            userId: userId,
          });

          socket.on('connect_error', (error) => {
            logger.error(`Socket connection error on namespace ${namespace}:`, {
              socketId: socket.id,
              namespace,
              error,
            });
            statusSocket.removeUserSession(socket.id);
          });

          socket.on('disconnect', () => {
            logger.info(`Socket disconnected from namespace ${namespace}:`, {
              socketId: socket.id,
              namespace,
            });
          });
        };

        await service.init(partIo, connectionCB);
        this.services.set(name, service);
        logger.info(`Initialized ${name} service on namespace: ${namespace}`);
      } else {
        logger.warn(`Service ${name} not properly initialized - missing init method`);
      }
    } catch (error) {
      logger.error(`Failed to initialize ${name} service:`, error);
      throw error;
    }
  }

  // Session Management Methods
  async disconnectUser(userId) {
    const userSessions = statusSocket.getUserSessions(userId);
    for (const socketId of userSessions) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
      statusSocket.removeUserSession(socketId);
    }
  }

  async disconnectNamespace(namespace) {
    // Filter sockets by namespace and disconnect them
    for (const socketId of Array.from(this.io.of(namespace).sockets.keys())) {
      const socket = this.io.of(namespace).sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
        statusSocket.removeUserSession(socketId);
      }
    }
  }

  async broadcastToUser(userId, event, data, namespace = null) {
    const userSessions = statusSocket.getUserSessions(userId);
    for (const socketId of userSessions) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && (!namespace || socket.nsp.name === namespace)) {
        socket.emit(event, data);
      }
    }
  }

  getActiveUsers() {
    return statusSocket.getDiagnostics();
  }

  isServiceDisabled(serviceName) {
    return process.env[serviceName] === 'true';
  }

  getService(name) {
    return this.services.get(name);
  }

  getNamespace(name) {
    return this.NAMESPACES[name.toUpperCase()];
  }

  getIO() {
    return this.io;
  }

  async shutdown() {
    try {
      // Clear all sessions and cleanup services
      for (const [name, service] of this.services.entries()) {
        if (typeof service.cleanup === 'function') {
          await service.cleanup();
          logger.info(`Cleaned up ${name} service`);
        }
      }

      // Close socket connections
      if (this.io) {
        this.io.close(() => {
          logger.info('All socket connections closed');
        });
      }
    } catch (error) {
      logger.error('Error during socket server shutdown:', error);
      throw error;
    }
  }
}

// Create singleton instance
export default new SocketServer();
