import config from '@/config';
import ChatMessage from '@/models/features/ChatMessage';
import GiphyController from '@/services/Giphy/Giphy.service';
import { SocketError } from '@/utils/error/errors';
import { logger } from '@/utils/logger';

const EMIT_EVENTS = {
  ERROR: 'error',
  SERVICE_STATUS: 'service-status',
  MESSAGE_RECEIVED: 'message-received',
  NOTIFICATION: 'notification',
  ROOM_CREATED: 'room-created',
  ROOM_JOINED: 'room-joined',
  ROOM_STATUS: 'room-status',
  ROOM_MESSAGE: 'room-message',
  CHAT_HISTORY: 'chat-history',
};

const LISTEN_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  SEND_PRIVATE_MESSAGE: 'send-private-message',
  SEND_ROOM_MESSAGE: 'send-room-message',
  CREATE_ROOM: 'create-room',
  JOIN_ROOM: 'join-room',
  GET_CHAT_HISTORY: 'get-chat-history',
};

export class ChatSocketService {
  static instance = null;

  constructor() {
    if (ChatSocketService.instance) {
      return ChatSocketService.instance;
    }

    this.isHealthy = false;
    this.connectedClients = new Map();
    this.healthCheckInterval = null;
    this.rooms = new Map();

    // Define default rooms
    this.defaultRooms = [
      { name: 'General', id: 'general' },
      { name: 'Random', id: 'random' },
      // Add more default rooms as needed
    ];
    this.giphyController = GiphyController;

    ChatSocketService.instance = this;
    this.globalEmitRoomStatus();
  }

  init(namespace, cb) {
    try {
      this.namespace = namespace;

      // Initialize default rooms
      this.initializeDefaultRooms();

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
      logger.info(`ChatSocketService initialized on route: ${namespace?.name}`);
    } catch (error) {
      logger.error('Failed to initialize ChatSocketService:', error);
      throw error;
    }
  }

  initializeDefaultRooms() {
    for (const room of this.defaultRooms) {
      this.rooms.set(room.id, {
        id: room.id,
        name: room.name,
        isPrivate: false,
        createdBy: 'system',
        createdAt: new Date(),
        members: new Set(),
        isDefault: true,
      });
    }
    logger.info('Default rooms initialized');
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

      // Setup other event handlers
      this.setupSocketHandlers(socket);

      // Auto-join default rooms
      await this.joinDefaultRooms(socket);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async joinDefaultRooms(socket) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.isDefault) {
        socket.join(roomId);

        if (socket.user?.id) {
          room.members.add(socket.user?.id);
        }

        const { messages, hasMore } = await this.getChatHistory(roomId, new Date());

        // Notify user about joined room
        socket.emit(EMIT_EVENTS.ROOM_JOINED, {
          roomId,
          roomName: room.name,
          messages,
          hasMore,
        });
        await this.emitRoomStatus(roomId);
      }
    }
  }

  handleDisconnect(socket) {
    try {
      if (socket.user?.id) {
        // Remove user from all room members sets
        for (const room of this.rooms.values()) {
          room.members.delete(socket.user.id);
        }
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

  setupSocketHandlers(socket) {
    // Setup message handlers
    socket.on(LISTEN_EVENTS.SEND_PRIVATE_MESSAGE, (messageData) => this.onSendPrivateMessage(socket, messageData));
    socket.on(LISTEN_EVENTS.SEND_ROOM_MESSAGE, (messageData) => {
      logger.info(`onSendRoomMessage called for room: ${messageData}`);
      this.onSendRoomMessage(socket, messageData);
    });

    // Setup room handlers
    socket.on(LISTEN_EVENTS.CREATE_ROOM, (roomData) => this.onCreateRoom(socket, roomData));
    socket.on(LISTEN_EVENTS.JOIN_ROOM, (roomData) => this.onJoinRoom(socket, roomData));
    socket.on(LISTEN_EVENTS.GET_CHAT_HISTORY, (roomData) => this.onGetChatHistory(socket, roomData));
  }

  async onCreateRoom(socket, roomData) {
    try {
      if (!this.validateRoomData(roomData)) {
        throw new SocketError('Invalid room data', 400);
      }

      const { roomName, isPrivate = false } = roomData;
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create room
      this.rooms.set(roomId, {
        id: roomId,
        name: roomName,
        isPrivate,
        createdBy: socket.user.id,
        createdAt: new Date(),
        members: new Set([socket.user.id]),
      });

      // Join the room
      socket.join(roomId);

      // Notify creator
      socket.emit(EMIT_EVENTS.ROOM_CREATED, {
        roomId,
        roomName,
        isPrivate,
      });

      logger.info(`Room created: ${roomId} by user: ${socket.user.id}`);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async onJoinRoom(socket, roomData) {
    try {
      const { roomId } = roomData;
      const room = this.rooms.get(roomId);

      if (!room) {
        throw new SocketError('Room not found', 404);
      }

      if (room.isPrivate && room.createdBy !== socket.user.id) {
        throw new SocketError('Cannot join private room', 403);
      }

      // Join the room
      socket.join(roomId);
      room.members.add(socket.user.id);

      const { messages, hasMore } = await this.getChatHistory(roomId, new Date());
      // Notify user
      socket.emit(EMIT_EVENTS.ROOM_JOINED, {
        roomId,
        roomName: room.name,
        messages,
        hasMore,
      });

      logger.info(`User ${socket.user.id} joined room: ${roomId}`);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async onSendPrivateMessage(socket, messageData) {
    try {
      if (!this.validateMessageData(messageData)) {
        throw new SocketError('Invalid message format', 400);
      }

      const { message, recipientId } = messageData;

      if (!this.connectedClients.has(recipientId)) {
        throw new SocketError('Recipient not found or offline', 404);
      }

      const messagePayload = {
        id: Date.now().toString(),
        senderId: socket.user.id,
        recipientId,
        message,
        username: socket.user.username,
        type: 'private',
        currentRank: socket.user.currentRank,
        currentLevel: socket.user.currentLevel,
      };

      // Save message to database
      const savedMessage = await ChatMessage.create({
        type: 'private',
        senderId: socket.user.id,
        username: socket.user.username,
        recipientId,
        message,
      });

      // Update messagePayload with database ID
      messagePayload.id = savedMessage._id;

      // Send to recipient
      await this.namespace.to(recipientId).emit(EMIT_EVENTS.MESSAGE_RECEIVED, messagePayload);

      // Send notification
      await this.sendNotification(recipientId, {
        type: 'new_private_message',
        from: socket.user.id,
        preview: message.substring(0, 50),
      });

      // Acknowledge to sender
      socket.emit(EMIT_EVENTS.MESSAGE_RECEIVED, {
        ...messagePayload,
        status: 'sent',
      });

      logger.info(`Private message sent from ${socket.user.id} to ${recipientId}`);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async onSendRoomMessage(socket, messageData) {
    try {
      if (!socket.user?.id) {
        throw new SocketError('You are not authorized to send messages', 404);
      }

      const { message, roomId, isGif = false, gifId = null } = messageData;

      const room = this.rooms.get(roomId);

      if (!room) {
        throw new SocketError('Room not found', 404);
      }

      if (!room.members.has(socket.user.id)) {
        throw new SocketError('Not a member of this room', 403);
      }

      // Save message to database
      const savedMessage = await ChatMessage.create({
        type: 'room',
        senderId: socket.user.id,
        username: socket.user.username,
        roomId,
        message: isGif ? (message.length > 0 ? message : 'GIF') : message,
        avatar: socket.user.avatar,
        isGif,
        gifId: isGif ? gifId : null,
      });
      const messagePayload = {
        ...savedMessage.toObject(),
        id: savedMessage._id,
        currentLevel: socket.user.currentLevel,
        currentRank: socket.user.currentRank,
      };
      // Broadcast to room
      await this.namespace.to(roomId).emit(EMIT_EVENTS.ROOM_MESSAGE, messagePayload);

      logger.info(`Room message sent in ${roomId} by ${socket.user.id}`);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  async onGetChatHistory(socket, roomData) {
    const { roomId, before } = roomData;
    const { messages, hasMore } = await this.getChatHistory(roomId, before);
    socket.emit(EMIT_EVENTS.CHAT_HISTORY, { roomId, messages, hasMore });
  }

  validateMessageData(messageData) {
    return (
      messageData &&
      typeof messageData.message === 'string' &&
      messageData.message.trim().length > 0 &&
      typeof messageData.recipientId === 'string'
    );
  }

  validateRoomData(roomData) {
    return roomData && typeof roomData.roomName === 'string' && roomData.roomName.trim().length > 0;
  }

  sendNotification(recipientId, notification) {
    try {
      if (this.connectedClients.has(recipientId)) {
        this.namespace.to(recipientId).emit(EMIT_EVENTS.NOTIFICATION, notification);

        logger.info(`Notification sent to ${recipientId}`);
      }
    } catch (error) {
      logger.error(`Error sending notification to ${recipientId}:`, error);
    }
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
      this.rooms.clear();

      if (this.namespace) {
        this.namespace.removeAllListeners();
      }

      this.isHealthy = false;
      logger.info('ChatSocketService cleaned up');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  async getGifUrl(gifId) {
    const gif = await this.giphyController.getGifById(gifId);
    return gif;
  }

  static getInstance() {
    if (!ChatSocketService.instance) {
      ChatSocketService.instance = new ChatSocketService();
    }
    return ChatSocketService.instance;
  }

  async getChatHistory(roomId, before) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new SocketError('Room not found', 404);
    }
    return this.getRoomMessages(roomId, before);
  }

  async getRoomMessages(roomId, before) {
    let beforeDate;

    if (before) {
      // Try to create a valid date from the 'before' parameter
      beforeDate = new Date(before);

      // Check if the resulting date is valid
      if (isNaN(beforeDate.getTime())) {
        logger.warn(`Invalid 'before' date received: ${before}, using current date instead`);
        beforeDate = new Date(); // Fallback to current date
      }
    } else {
      // If 'before' is undefined, use current date as default
      beforeDate = new Date();
    }

    const LIMIT = 20;
    // First get count of all possible messages to determine if there are more
    const totalCount = await ChatMessage.countDocuments({
      type: 'room',
      roomId,
      createdAt: { $lt: beforeDate },
    });

    const chatHistory = await ChatMessage.aggregate([
      {
        $match: {
          type: 'room',
          roomId,
          createdAt: { $lt: new Date(before) },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: LIMIT },
      {
        $lookup: {
          from: 'vipusers',
          let: { senderId: '$senderId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: '$userId' }, '$$senderId'],
                },
              },
            },
            {
              $project: {
                _id: 0,
                currentTier: 1,
                currentLevel: 1,
              },
            },
          ],
          as: 'vipUser',
        },
      },
      {
        $unwind: {
          path: '$vipUser',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          currentRank: '$vipUser.currentTier',
          currentLevel: '$vipUser.currentLevel',
        },
      },
      {
        $project: {
          vipUser: 0,
        },
      },
      {
        $sort: { createdAt: 1 },
      },
    ]).exec();

    return {
      messages: chatHistory,
      hasMore: totalCount > LIMIT ? 1 : 0,
    };
  }

  async getPrivateMessages(userId1, userId2, options = {}) {
    const { limit = 50, before = Date.now() } = options;

    const messages = await ChatMessage.aggregate([
      {
        $match: {
          type: 'private',
          createdAt: { $lt: new Date(before) },
          $or: [
            { senderId: userId1, recipientId: userId2 },
            { senderId: userId2, recipientId: userId1 },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'vipusers',
          let: { senderId: '$senderId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: '$userId' }, '$$senderId'],
                },
              },
            },
            {
              $project: {
                _id: 0,
                currentTier: 1,
                currentLevel: 1,
              },
            },
          ],
          as: 'vipUser',
        },
      },
      {
        $unwind: {
          path: '$vipUser',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          currentRank: '$vipUser.currentTier',
          currentLevel: '$vipUser.currentLevel',
        },
      },
      {
        $project: {
          vipUser: 0, // Remove vipUser field from the final output
        },
      },
      { $sort: { createdAt: 1 } }, // chronological
    ]).exec();

    return messages;
  }

  async emitRoomStatus(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    const memberCount = room.members.size;

    this.namespace.to(roomId).emit(EMIT_EVENTS.ROOM_STATUS, {
      memberCount,
      roomId,
    });
  }

  async globalEmitRoomStatus() {
    setInterval(
      async () => {
        for (const room of this.rooms.values()) {
          await this.emitRoomStatus(room.id);
        }
      },
      1 * 60 * 1000
    );
  }
}

// Create singleton instance
const chatSocketService = new ChatSocketService();
export default chatSocketService;
