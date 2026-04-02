import BetHistory from '@/models/gameHistory/BetHistory';
import RecentWinList from '@/models/gameHistory/RecentWinList';
import { GAME_CATEGORIES } from '@/types/game/game';
import { SocketError } from '@/utils/error/errors';
import { logger } from '@/utils/logger';

const EMIT_EVENTS = {
  ERROR: 'error',
  BET_HISTORY_UPDATE: 'betHistory:update',
  BET_HISTORY_LIST: 'history-list',
  BET_HISTORY_DETAIL: 'betHistory:detail',
  NEW_BET_PLACED: 'new-bet',
  BET_STATUS_UPDATE: 'betHistory:statusUpdate',
  RECENT_WIN_LIST: 'recent-win-list',
};

const LISTEN_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  GET_BET_HISTORY: 'get-my-bet',
  GET_BET_DETAIL: 'get-bets',
  GET_RECENT_BETS: 'get-recent-bets',
  GET_RECENT_WIN_LIST: 'get-recent-win-list',
};

export class BetHistorySocketController {
  static instance = null;

  constructor() {
    if (BetHistorySocketController.instance) {
      return BetHistorySocketController.instance;
    }
    this.namespace = null;

    this.eventHandlers = new Map();
    this.setupEventHandlers();

    BetHistorySocketController.instance = this;
  }

  setupEventHandlers() {
    this.eventHandlers.set(LISTEN_EVENTS.GET_BET_HISTORY, this.handleGetBetHistory.bind(this));
    this.eventHandlers.set(LISTEN_EVENTS.GET_BET_DETAIL, this.handleGetBetDetail.bind(this));
    this.eventHandlers.set(LISTEN_EVENTS.GET_RECENT_BETS, this.handleGetRecentBets.bind(this));
    this.eventHandlers.set(LISTEN_EVENTS.GET_RECENT_WIN_LIST, this.handleGetRecentWinList.bind(this));
    // this.eventHandlers.set(LISTEN_EVENTS.DISCONNECT, this.handleDisconnect.bind(this));
  }

  init(namespace, cb) {
    this.namespace = namespace;

    this.namespace.on(LISTEN_EVENTS.CONNECTION, (socket) => {
      try {
        cb(socket);

        // Set up event listeners
        this.eventHandlers.forEach((handler, event) => {
          socket.on(event, async (...args) => {
            try {
              await this.handleEvent(socket, handler, event, ...args);
            } catch (error) {
              this.handleError(socket, error);
            }
          });
        });

        // logger.info(`Bet history socket connected: ${socket.id}`);
      } catch (error) {
        logger.error('Error initializing bet history socket:', error);
        socket.emit(EMIT_EVENTS.ERROR, {
          message: 'Failed to initialize connection',
        });
        socket.disconnect(true);
      }
    });

    logger.info(`BetHistorySocketController initialized on route: ${namespace?.name}`);
  }

  async handleEvent(socket, handler, event, ...args) {
    // Check authentication only for private routes
    if (event === LISTEN_EVENTS.GET_BET_HISTORY && !socket.user) {
      throw new SocketError('Unauthorized access', 401);
    }

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

  async handleGetBetHistory(socket, { page = 1, limit = 20, filters = {} }) {
    try {
      if (!socket.user) return;

      const userId = socket.user.id;
      const skip = (page - 1) * limit;

      const query = { userId, ...filters };
      const betHistory = await BetHistory.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

      const total = await BetHistory.countDocuments(query);

      socket.emit(EMIT_EVENTS.BET_HISTORY_LIST, {
        bets: betHistory,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });

      logger.debug('Bet history sent:', {
        userId,
        page,
        limit,
        total,
      });
    } catch (error) {
      throw new SocketError('Failed to fetch bet history', 500);
    }
  }

  async handleGetBetDetail(socket, { betId }) {
    try {
      if (!betId) {
        throw new SocketError('Need to provide bet id...', 404);
      }

      // Public route - no user check required
      const betDetail = await BetHistory.findOne({
        _id: betId,
      }).lean();

      if (!betDetail) {
        throw new SocketError('Bet not found', 404);
      }

      socket.emit(EMIT_EVENTS.BET_HISTORY_DETAIL, betDetail);

      logger.debug('Bet detail sent:', {
        betId,
      });
    } catch (error) {
      throw new SocketError('Failed to fetch bet detail', 500);
    }
  }

  async handleGetRecentBets(socket, params) {
    try {
      const { limit = 10 } = params || {};

      // Fetch bets for each category separately with the same limit
      const [allBets, crashBets, rouletteBets, slotsBets, limboBets, casesBets, diceBets, liveCasinoBets] =
        await Promise.all([
          BetHistory.find().sort({ createdAt: -1 }).limit(limit).lean(),
          BetHistory.find({ category: GAME_CATEGORIES.CRASH }).sort({ createdAt: -1 }).limit(limit).lean(),
          BetHistory.find({ category: GAME_CATEGORIES.ROULETTE }).sort({ createdAt: -1 }).limit(limit).lean(),
          BetHistory.find({ category: GAME_CATEGORIES.SLOTS }).sort({ createdAt: -1 }).limit(limit).lean(),
          BetHistory.find({ category: GAME_CATEGORIES.LIMBO }).sort({ createdAt: -1 }).limit(limit).lean(),
          BetHistory.find({ category: GAME_CATEGORIES.CASES }).sort({ createdAt: -1 }).limit(limit).lean(),
          BetHistory.find({ category: GAME_CATEGORIES.DICE }).sort({ createdAt: -1 }).limit(limit).lean(),
          BetHistory.find({ category: GAME_CATEGORIES.LIVE_CASINO }).sort({ createdAt: -1 }).limit(limit).lean(),
        ]);

      const categorizedBets = {
        allBets,
        crashBets,
        rouletteBets,
        slotsBets,
        limboBets,
        casesBets,
        diceBets,
        liveCasinoBets,
      };

      socket.emit(EMIT_EVENTS.BET_HISTORY_LIST, {
        bets: categorizedBets,
      });
    } catch (error) {
      throw new SocketError('Failed to fetch recent bets', 500);
    }
  }

  async handleGetRecentWinList(socket, _params) {
    try {
      const recentWinList = await RecentWinList.find().lean();
      recentWinList.sort((a, b) => b.lastBet?.winAmount - a.lastBet?.winAmount);
      socket.emit(EMIT_EVENTS.RECENT_WIN_LIST, {
        recentWinList,
      });
    } catch (error) {
      throw new SocketError('Failed to fetch recent win list', 500);
    }
  }

  // async handleDisconnect(socket) {
  //   try {
  //     if (socket.user) {
  //       const userId = socket.user._id.toString();
  //       socket.leave(`${ROOM_PREFIX.USER}${userId}`);
  //       logger.info(`User disconnected from bet history socket: ${userId}`);
  //     }
  //     logger.info(`Socket disconnected: ${socket.id}`);
  //   } catch (error) {
  //     logger.error('Error handling disconnect:', error);
  //   }
  // }

  // Emit methods for external use
  emitNewBet(betData) {
    try {
      if (!this.namespace) {
        throw new Error('Namespace not initialized');
      }

      this.namespace.emit(EMIT_EVENTS.NEW_BET_PLACED, {
        ...betData,
      });
    } catch (error) {
      logger.error('Error emitting new bet:', error);
    }
  }

  // emitBetStatusUpdate(userId, betId, status, result) {
  //   try {
  //     if (!this.namespace) {
  //       throw new Error('Namespace not initialized');
  //     }

  //     this.namespace.to(`${ROOM_PREFIX.USER}${userId}`).emit(EMIT_EVENTS.BET_STATUS_UPDATE, {
  //       betId,
  //       status,
  //       result,
  //       timestamp: Date.now(),
  //     });

  //     logger.info('Bet status update emitted:', { userId, betId, status });
  //   } catch (error) {
  //     logger.error('Error emitting bet status update:', error);
  //   }
  // }

  cleanup() {
    try {
      if (this.namespace) {
        this.namespace.removeAllListeners();
      }
      logger.info('BetHistorySocketController cleaned up');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

// Create singleton instance
const betHistorySocketController = new BetHistorySocketController();

export default betHistorySocketController;
