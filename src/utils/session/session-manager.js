export class SessionManager {
  constructor() {
    // Map to store user sessions: userId -> Set of socket IDs
    this.userSessions = new Map();
    // Map to store socket to user mapping: socketId -> userId
    this.socketToUser = new Map();
    this.io = null;
  }

  setIO(ioInstance) {
    this.io = ioInstance; // ✅ Save the WebSocket instance
  }

  addUserSession(userId, socketId) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(socketId);
    this.socketToUser.set(socketId, userId);
  }

  removeUserSession(socketId) {
    const userId = this.socketToUser.get(socketId);
    if (userId) {
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

  getUserBySocket(socketId) {
    return this.socketToUser.get(socketId);
  }

  getActiveUserCount() {
    return this.userSessions.size;
  }

  getTotalConnectionCount() {
    return this.io.sockets.sockets.size;
    // return this.socketToUser.size;
  }

  isUserActive(userId) {
    const sessions = this.userSessions.get(userId);
    return sessions ? sessions.size > 0 : false;
  }

  getDiagnostics() {
    return {
      uniqueUsers: this.getActiveUserCount(),
      totalConnections: this.getTotalConnectionCount(),
      userSessions: Object.fromEntries(
        Array.from(this.userSessions.entries()).map(([userId, sockets]) => [userId, Array.from(sockets)])
      ),
    };
  }

  broadcastNewToken(userId, newToken) {
    if (!this.io) {
      console.error('Socket.io instance not set in sessionManager!');
      return;
    }

    const userSockets = this.getUserSessions(userId);

    userSockets.forEach((socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('auth:refresh', { token: newToken }); // ✅ Send new token
      }
    });
  }
}

export default new SessionManager();
