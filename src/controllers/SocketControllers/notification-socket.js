import NotificationService from '@/services/notification/Notification.service';
import { ROOM_PREFIX } from '@/types/socket/user';
import { SocketError } from '@/utils/error/errors';
import { logger } from '@/utils/logger/index.js';

const EMIT_EVENTS = {
  ERROR: 'error',
  NEW_NOTIFICATION: 'notification:new',
  NOTIFICATIONS: 'notification:list',
  NOTIFICATION_COUNT: 'notification:count',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_DELETED: 'notification:deleted',
  ALL_MARKED_READ: 'notification:all-read',
  ALL_USERS_NOTIFICATION: 'notification:all-users',
};

const LISTEN_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  GET_NOTIFICATIONS: 'notification:get',
  GET_UNREAD_COUNT: 'notification:get-count',
  MARK_AS_READ: 'notification:mark-read',
  MARK_ALL_READ: 'notification:mark-all-read',
  DELETE_NOTIFICATION: 'notification:delete',
};

class NotificationSocketController {
  static instance = null;

  constructor() {
    if (NotificationSocketController.instance) {
      return NotificationSocketController.instance;
    }

    this.namespace = null;
    this.eventHandlers = new Map();
    this._notificationService = null; // Lazy loaded notification service
    this.setupEventHandlers();

    NotificationSocketController.instance = this;
  }

  // Add getter for notification service
  get notificationService() {
    if (!this._notificationService) {
      this._notificationService = NotificationService;
    }
    return this._notificationService;
  }

  setupEventHandlers() {
    this.eventHandlers.set(LISTEN_EVENTS.GET_NOTIFICATIONS, this.handleGetNotifications.bind(this));
    this.eventHandlers.set(LISTEN_EVENTS.GET_UNREAD_COUNT, this.handleGetUnreadCount.bind(this));
    this.eventHandlers.set(LISTEN_EVENTS.MARK_AS_READ, this.handleMarkAsRead.bind(this));
    this.eventHandlers.set(LISTEN_EVENTS.MARK_ALL_READ, this.handleMarkAllRead.bind(this));
    this.eventHandlers.set(LISTEN_EVENTS.DELETE_NOTIFICATION, this.handleDeleteNotification.bind(this));
  }

  init(namespace, cb) {
    this.namespace = namespace;

    this.namespace.on(LISTEN_EVENTS.CONNECTION, (socket) => {
      try {
        if (typeof cb === 'function') {
          cb(socket);
        }

        // Check authentication
        if (!socket.user) {
          return;
        }

        // Join user's room
        const userId = socket.user.id;
        socket.join(`${ROOM_PREFIX.USER}${userId}`);

        // Set up event listeners
        this.eventHandlers.forEach((handler, event) => {
          socket.on(event, async (...args) => {
            try {
              await handler(socket, ...args);
            } catch (error) {
              this.handleError(socket, error);
            }
          });
        });

        // Send initial unread count
        this.sendUnreadCount(socket);
      } catch (error) {
        logger.error('Error initializing notification socket:', error);
        socket.emit(EMIT_EVENTS.ERROR, {
          message: 'Failed to initialize connection',
        });
        socket.disconnect(true);
      }
    });

    this.namespace.on(LISTEN_EVENTS.DISCONNECT, (socket) => {
      logger.debug(socket.user, 'socket disconnected');
    });

    logger.info(`NotificationSocketController initialized on route: ${namespace?.name}`);
  }

  handleError(socket, error) {
    const errorMessage = error instanceof SocketError ? error.message : 'Internal server error';
    const errorCode = error instanceof SocketError ? error.code : 500;

    logger.error('Socket error:', {
      socketId: socket.id,
      userId: socket.user?.id,
      error: error.message,
      stack: error.stack,
    });

    socket.emit(EMIT_EVENTS.ERROR, {
      message: errorMessage,
      code: errorCode,
    });
  }

  async sendUnreadCount(socket) {
    try {
      const userId = socket.user.id;
      const count = await this.notificationService.getUnreadCount(userId);
      socket.emit(EMIT_EVENTS.NOTIFICATION_COUNT, { count });
    } catch (error) {
      logger.error(`Error getting unread count for user ${socket.user.id}:`, error);
    }
  }

  // Socket event handlers
  async handleGetNotifications(socket, options = {}) {
    try {
      const userId = socket.user.id;
      const result = await this.notificationService.getUserNotifications(userId, options);
      socket.emit(EMIT_EVENTS.NOTIFICATIONS, result);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async handleGetUnreadCount(socket) {
    try {
      const userId = socket.user.id;
      const count = await this.notificationService.getUnreadCount(userId);
      socket.emit(EMIT_EVENTS.NOTIFICATION_COUNT, { count });
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async handleMarkAsRead(socket, { notificationId }) {
    try {
      if (!notificationId) {
        throw new SocketError('Notification ID is required', 400);
      }

      const userId = socket.user.id;
      const updatedNotification = await this.notificationService.markAsRead(notificationId, userId);

      if (!updatedNotification) {
        throw new SocketError('Notification not found or not owned by user', 404);
      }

      socket.emit(EMIT_EVENTS.NOTIFICATION_READ, { notificationId });

      // Also send updated count
      const count = await this.notificationService.getUnreadCount(userId);
      socket.emit(EMIT_EVENTS.NOTIFICATION_COUNT, { count });
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async handleMarkAllRead(socket) {
    try {
      const userId = socket.user.id;
      await this.notificationService.markAllAsRead(userId);

      socket.emit(EMIT_EVENTS.ALL_MARKED_READ);
      socket.emit(EMIT_EVENTS.NOTIFICATION_COUNT, { count: 0 });
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async handleDeleteNotification(socket, { notificationId }) {
    try {
      if (!notificationId) {
        throw new SocketError('Notification ID is required', 400);
      }

      const userId = socket.user.id;
      const result = await this.notificationService.deleteNotification(notificationId, userId);

      if (!result) {
        throw new SocketError('Notification not found or not owned by user', 404);
      }

      socket.emit(EMIT_EVENTS.NOTIFICATION_DELETED, { notificationId });

      // Also send updated count if it was unread
      if (!result.isRead) {
        const count = await this.notificationService.getUnreadCount(userId);
        socket.emit(EMIT_EVENTS.NOTIFICATION_COUNT, { count });
      }
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  // Methods for external services to use
  emitNotification(userId, notification) {
    if (!this.namespace) {
      logger.error('Cannot emit notification: Socket namespace not initialized');
      return;
    }

    logger.debug(userId, notification, 'emitNotification');

    // Check if user is connected to their room
    const roomName = `${ROOM_PREFIX.USER}${userId}`;
    const room = this.namespace.adapter.rooms.get(roomName);
    const isConnected = room && room.size > 0;
    logger.debug(`User ${userId} connection status in room ${roomName}: ${isConnected}`);

    try {
      this.namespace.to(roomName).emit(EMIT_EVENTS.NEW_NOTIFICATION, notification);

      // Also update the unread count
      this.emitNotificationCount(userId);
    } catch (error) {
      logger.error(`Error emitting notification to user ${userId}:`, error);
    }
  }

  async emitNotificationCount(userId) {
    if (!this.namespace) {
      logger.error('Cannot emit notification count: Socket namespace not initialized');
      return;
    }

    try {
      const count = await this.notificationService.getUnreadCount(userId);
      this.namespace.to(`${ROOM_PREFIX.USER}${userId}`).emit(EMIT_EVENTS.NOTIFICATION_COUNT, { count });
    } catch (error) {
      logger.error(`Error emitting notification count to user ${userId}:`, error);
    }
  }

  emitNotificationToAll(notification) {
    if (!this.namespace) {
      logger.error('Cannot emit notification: Socket namespace not initialized');
      return;
    }

    try {
      this.namespace.emit(EMIT_EVENTS.ALL_USERS_NOTIFICATION, notification);
    } catch (error) {
      logger.error(`Error emitting notification to all users:`, error);
    }
  }

  cleanup() {
    try {
      if (this.namespace) {
        this.namespace.removeAllListeners();
      }
      logger.info('NotificationSocketController cleaned up');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

const notificationSocketController = new NotificationSocketController();
export default notificationSocketController;
