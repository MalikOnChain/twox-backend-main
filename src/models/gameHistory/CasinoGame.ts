import mongoose from 'mongoose';

import { GAME_CATEGORIES } from '../../types/game/game';
import { logger } from '../../utils/logger';

import RecentWinList from './RecentWinList';

const { Schema } = mongoose;

export const GAME_TYPES = {
  BASE: 'BASE',
  FREESPIN: 'FREESPIN',
  BONUS: 'BONUS',
};

export const GAME_STATUS = {
  Pending: 1,
  Completed: 2,
  Failed: 3,
};

/**
 * Player Schema Definition
 */
const PlayerSchema = new Schema<ICasinoGamePlayer>(
  {
    playerId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    betAmount: {
      type: Number,
      required: true,
    },
    winAmount: {
      type: Number,
      default: 0,
    },
    isBot: { type: Boolean, default: false },
    avatar: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const CasinoGameSchema = new Schema<ICasinoGame>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    gameCategory: {
      type: String,
      enum: [GAME_CATEGORIES.SLOTS, GAME_CATEGORIES.LIVE_CASINO],
      required: true,
    },

    providerCode: {
      type: String,
      required: true,
    },

    gameCode: {
      type: String,
      required: true,
    },

    gameName: {
      type: String,
      required: true,
    },

    transactionId: {
      type: String,
      required: true,
      unique: true,
    },

    roundType: {
      type: String,
      // enum: Object.values(GAME_TYPES),
      default: GAME_TYPES.BASE,
    },

    players: [PlayerSchema],

    totalWagers: {
      type: Number,
      default: 0,
    },

    totalPayouts: {
      type: Number,
      default: 0,
    },

    betAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    winAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      required: true,
    },

    gameData: {
      type: Schema.Types.Mixed,
      default: {},
    },

    userBalance: {
      type: Number,
      required: true,
    },

    status: {
      type: Number,
      enum: Object.values(GAME_STATUS),
      default: GAME_STATUS.Pending,
      index: true,
    },
    errorDetails: {
      code: String,
      message: String,
      timestamp: Date,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

/**
 * Index Definitions
 */
CasinoGameSchema.index({ userId: 1, createdAt: -1 });
CasinoGameSchema.index({ gameCategory: 1 });
CasinoGameSchema.index({ providerCode: 1, gameCode: 1 });
CasinoGameSchema.index({ 'players.playerId': 1 });

/**
 * Static Methods
 */
CasinoGameSchema.statics = {
  findByTransactionId: async function (transactionId) {
    return await this.findOne({ transactionId });
  },

  findByPlayerId: async function (playerId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    return await this.find({
      'players.playerId': playerId,
    })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  },

  getTopWinners: async function (days = 24, limit = 20) {
    try {
      const winners = await this.aggregate([
        // Only look at completed games from the last X days
        {
          $match: {
            status: GAME_STATUS.Completed,
            createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
          },
        },
        // Unwind the players array directly
        { $unwind: '$players' },
        // Filter out bot players and null/undefined values
        {
          $match: {
            'players.playerId': { $exists: true },
            'players.betAmount': { $gt: 0 },
          },
        },
        {
          $project: {
            playerId: '$players.playerId',
            username: '$players.username',
            avatar: '$players.avatar',
            betAmount: '$players.betAmount',
            winAmount: { $ifNull: ['$players.winAmount', 0] },
            profit: {
              $subtract: [{ $ifNull: ['$players.winAmount', 0] }, '$players.betAmount'],
            },
            gamesPlayed: 1,
          },
        },
        {
          $group: {
            _id: '$playerId',
            username: { $first: '$username' },
            avatar: { $first: '$avatar' },
            totalProfit: { $sum: '$profit' },
            totalBets: { $sum: '$betAmount' },
            totalWinnings: { $sum: '$winAmount' },
            gamesPlayed: { $sum: 1 },
          },
        },
        {
          $project: {
            playerId: '$_id',
            username: 1,
            avatar: 1,
            totalProfit: { $round: ['$totalProfit', 2] },
            totalBets: { $round: ['$totalBets', 2] },
            totalWinnings: { $round: ['$totalWinnings', 2] },
            gamesPlayed: 1,
            winRate: {
              $round: [{ $multiply: [{ $divide: ['$totalWinnings', '$totalBets'] }, 100] }, 2],
            },
            _id: 0,
          },
        },
        // Only include players with at least 3 games
        { $match: { gamesPlayed: { $gte: 3 } } },
        { $sort: { totalProfit: -1 } },
        { $limit: limit },
      ]);

      return winners;
    } catch (error) {
      console.error('Error fetching top winners', error);
      throw new Error('Failed to fetch top winners. Please try again later.');
    }
  },
};

/**
 * Virtuals
 */
CasinoGameSchema.virtual('netAmount').get(function () {
  return this.winAmount - this.betAmount;
});

/**
 * Instance Methods
 */
CasinoGameSchema.methods = {
  updateStatus: async function (newStatus: CasinoGameStatus, additionalData: any = {}) {
    const updateData = {
      status: newStatus,
      ...additionalData,
    };

    if (newStatus === GAME_STATUS.Completed) {
      updateData.endedAt = new Date();
    }

    Object.assign(this, updateData);
    return await this.save();
  },

  addPlayer: async function (playerId: Mongoose.ObjectId, playerData: Partial<ICasinoGamePlayer>) {
    const newPlayer = {
      playerId,
      ...playerData,
    };

    const updateData = {
      $push: { players: newPlayer },
      $inc: { totalWagers: playerData.betAmount },
    };

    const Model = mongoose.model<ICasinoGame>('CasinoGame');

    return await Model.findByIdAndUpdate(this._id, updateData, { new: true });
  },

  updatePlayerBet: async function (playerId: Mongoose.ObjectId, betData: Partial<ICasinoGamePlayer>) {
    const updateData: any = {
      $set: { 'players.$[elem]': betData },
    };

    if (betData.winAmount) {
      updateData.$inc = { totalPayouts: betData.winAmount };
    }

    const Model = mongoose.model<ICasinoGame>('CasinoGame');

    return await Model.findByIdAndUpdate(this._id, updateData, {
      arrayFilters: [{ 'elem.playerId': playerId }],
      new: true,
    });
  },

  setError: async function (error: { code?: string; message: string }) {
    return await this.updateStatus(GAME_STATUS.Failed, {
      errorDetails: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        timestamp: new Date(),
      },
    });
  },

  formatGameHistory: function (): any {
    return {
      _id: this._id,
      gameName: this.gameName,
      providerCode: this.providerCode,
      gameCode: this.gameCode,
      betAmount: this.betAmount,
      winAmount: this.winAmount,
      netAmount: this.netAmount,
      status: this.status,
      gameCategory: this.gameCategory,
      roundType: this.roundType,
      totalWagers: this.totalWagers,
      totalPayouts: this.totalPayouts,
      playerCount: this.players.length,
    };
  },
};

// Add this before creating the model
CasinoGameSchema.pre<ICasinoGame>('save', async function (next) {
  try {
    // Only update for completed games
    if (this.status === GAME_STATUS.Completed) {
      if (this.winAmount > 0) {
        await RecentWinList.findOneAndUpdate(
          {
            'game.id': this.gameCode,
            'game.provider': this.providerCode,
            isActive: true,
          },
          {
            $set: {
              lastBet: {
                avatar: this.players[0]?.avatar || '',
                betAmount: this.betAmount,
                winAmount: this.winAmount,
                username: this.players[0]?.username || 'Anonymous',
                time: new Date(),
                category: this.gameCategory,
                payout: this.winAmount / this.betAmount,
              },
            },
          }
        );
      }
    }
    next();
  } catch (error) {
    logger.error('Error updating RecentWinList:', error);
    next(); // Continue saving even if RecentWinList update fails
  }
});

export const CasinoGame = mongoose.model<ICasinoGame, ICasinoGameModel>('CasinoGame', CasinoGameSchema);
