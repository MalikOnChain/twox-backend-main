import mongoose from 'mongoose';

import { GameTransactionHandler } from '@/controllers/TransactionControllers/GameTransactionManager';
import { GAME_CATEGORIES } from '@/types/game/game';
import { encrypt } from '@/utils/helpers/encrypt';
import { logger } from '@/utils/logger';

import RecentWinList from './RecentWinList';

const { Schema } = mongoose;

/**

 * Game Status Enumeration
 * @readonly
 * @enum {number}
 */
export const GAME_STATUS = {
  NotStarted: 1,
  Starting: 2,
  InProgress: 3,
  Over: 4,
  Blocking: 5,
  Refunded: 6,
};

export const BET_STATES = {
  Playing: 1,
  CashedOut: 2,
};

const PlayerSchema = new Schema<ICrashGamePlayer>(
  {
    playerId: { type: Schema.Types.ObjectId, required: true },
    username: { type: String, required: true },
    betAmount: { type: Number, required: true },
    autoCashoutAt: { type: Number, default: null },
    stoppedAt: { type: Number, default: 0 },
    winningAmount: { type: Number, default: 0 },
    forcedCashout: { type: Boolean, default: false },
    status: {
      type: Number,
      enum: Object.values(BET_STATES),
      default: BET_STATES.Playing,
      required: true,
    },
    isBot: { type: Boolean, default: false },
    avatar: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * Crash Game Schema Definition
 */
const CrashGameSchema = new Schema<ICrashGame>(
  {
    // Game Mechanics
    crashPoint: {
      type: Number,
      required: true,
      min: 1,
      max: 15000,
    },

    // Player Management
    players: [
      {
        type: PlayerSchema,
        default: [],
      },
    ],

    refundedPlayers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    privateSeed: {
      type: String,
      required: true,
    },

    publicSeed: {
      type: String,
      required: true,
    },

    gameHash: {
      type: String,
      required: true,
    },

    status: {
      type: Number,
      enum: Object.values(GAME_STATUS),
      default: GAME_STATUS.NotStarted,
    },

    startedAt: Date,
    endedAt: Date,

    totalWagers: {
      type: Number,
      default: 0,
    },
    totalPayouts: {
      type: Number,
      default: 0,
    },
  },
  {
    minimize: false,
  }
);

/**
 * Index Definitions
 */
CrashGameSchema.index({ status: 1 });
CrashGameSchema.index({ created: -1 });
CrashGameSchema.index({ status: 1, created: -1 });
CrashGameSchema.index({ privateSeed: 1 });
CrashGameSchema.index({ startedAt: -1 });
CrashGameSchema.index({ endedAt: -1 });
CrashGameSchema.index({ 'players.playerId': 1 });

/**
 * Virtuals
 */
CrashGameSchema.virtual('activePlayerCount').get(function () {
  return this.players.filter((player: ICrashGamePlayer) => player.status === BET_STATES.Playing).length;
});

/**
 * Static Methods
 */
((CrashGameSchema.statics = {
  createNewGame: async function (gameData) {
    const encryptedPrivateSeed = encrypt(gameData.privateSeed);
    const encryptedPublicSeed = encrypt(gameData.publicSeed);
    const encryptedGameHash = encrypt(gameData.gameHash);
    try {
      const result = await new this({
        privateSeed: encryptedPrivateSeed,
        publicSeed: encryptedPublicSeed,
        crashPoint: gameData.crashPoint,
        gameHash: encryptedGameHash,
        players: [],
      });
      return result;
    } catch (error) {
      console.error('Failed to create new game:', error);
      throw error;
    }
  },

  refundGame: async function () {
    logger.info('refunding games...');
    // Step 1: Get all active games that haven't been refunded yet
    const activeGames = await this.find({
      status: {
        $in: [GAME_STATUS.NotStarted, GAME_STATUS.Starting, GAME_STATUS.InProgress, GAME_STATUS.Blocking],
      },
      // Add check to exclude already refunded games
    });

    if (activeGames.length === 0) {
      logger.info('No active games found that need refunding.');
      return [];
    }

    const totalRefundedGames = [];

    // Step 2: Loop through each active game and refund only active players
    for (const game of activeGames) {
      // Get active players in the current game
      const activePlayers = game.players.filter((player: ICrashGamePlayer) => player.status === BET_STATES.Playing);

      if (activePlayers.length === 0) {
        continue;
      }
      const refundedPlayers = [];

      for (const player of activePlayers) {
        const transactionHandler = new GameTransactionHandler(GAME_CATEGORIES.CRASH);
        try {
          await transactionHandler
            .startTransaction(player.playerId, { id: game.id, category: GAME_CATEGORIES.CRASH })
            .then((handler: any) => handler.refund());
          refundedPlayers.push(player.playerId);
        } catch (error) {
          logger.error(`Failed to refund player ${player.playerId} in game ${game.id}:`, error);
          continue;
        }
      }

      // Step 3: Update the game status and refunded players only if we successfully refunded any players
      if (refundedPlayers.length > 0) {
        await game.updateOne({
          $set: {
            status: GAME_STATUS.Refunded,
            refundedPlayers,
            endedAt: new Date(),
          },
        });

        const refundedGame = { id: game.id, refundedPlayers };
        totalRefundedGames.push(refundedGame);
        logger.info(`Refunded Game ${game._id} with ${refundedPlayers.length} players.`);
      }
    }

    return totalRefundedGames;
  },

  getTopWinners: async function (GAME_STATUS, days = 24, limit = 20) {
    try {
      const winners = await this.aggregate([
        // Only look at completed games from the last 24 hours
        {
          $match: {
            status: GAME_STATUS.Over,
            endedAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
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
            winningAmount: { $ifNull: ['$players.winningAmount', 0] },
            profit: {
              $subtract: [{ $ifNull: ['$players.winningAmount', 0] }, '$players.betAmount'],
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
            totalWinnings: { $sum: '$winningAmount' },
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
      logger.error('Error fetching top winners', { error });
      throw new Error('Failed to fetch top winners. Please try again later.');
    }
  },
}),
  /**
   * Instance Methods
   */
  (CrashGameSchema.methods = {
    updateStatus: async function (newStatus: GameStatus, additionalData: any = {}) {
      const updateData = {
        status: newStatus,
        ...additionalData,
      };

      // Add timestamps based on status
      if (newStatus === GAME_STATUS.Starting) {
        updateData.startedAt = new Date();
      } else if (newStatus === GAME_STATUS.Over || newStatus === GAME_STATUS.Refunded) {
        updateData.endedAt = new Date();
      }

      Object.assign(this, updateData);
      return this.save();
    },

    addPlayer: async function (playerId: Mongoose.ObjectId, playerData: Partial<ICrashGamePlayer>) {
      if (this.status !== GAME_STATUS.Starting && this.status !== GAME_STATUS.NotStarted) {
        throw new Error('Game was already started');
      }

      const newPlayer = {
        playerId: playerId,
        ...playerData,
        status: BET_STATES.Playing,
      };

      const updateData = {
        $push: { players: newPlayer },
        $inc: { totalWagers: playerData.betAmount },
      };

      const Model = mongoose.model<ICrashGame>('CrashGame');

      return await Model.findByIdAndUpdate(this._id, updateData, { new: true });
    },

    addBotPlayer: async function (playerId: Mongoose.ObjectId, playerData: Partial<ICrashGamePlayer>) {
      if (this.status !== GAME_STATUS.Starting && this.status !== GAME_STATUS.NotStarted) {
        return null;
      }

      const newPlayer = {
        playerId: playerId,
        ...playerData,
        status: BET_STATES.Playing,
        isBot: true,
      };

      const updateData = {
        $push: { players: newPlayer },
        $inc: { totalWagers: playerData.betAmount },
      };

      const Model = mongoose.model<ICrashGame>('CrashGame');

      return await Model.findByIdAndUpdate(this._id, updateData, { new: true });
    },

    updatePlayerBet: async function (playerId: Mongoose.ObjectId, betData: Partial<ICrashGamePlayer>) {
      const updateData: any = {
        $set: { 'players.$[elem]': betData },
      };

      if (betData.betAmount) {
        updateData.$inc = { totalWagers: betData.betAmount };
      }

      const Model = mongoose.model<ICrashGame>('CrashGame');

      return await Model.findByIdAndUpdate(this._id, updateData, {
        arrayFilters: [{ 'elem.playerId': playerId }],
        new: true,
      });
    },

    processPlayerCashout: async function (playerId: Mongoose.ObjectId, cashoutData: any) {
      if (!playerId || !cashoutData) {
        throw new Error('Invalid cashout parameters');
      }

      // Fetch the latest document state before processing
      const CurrentModel = mongoose.model<ICrashGame>('CrashGame');
      const currentGame = await CurrentModel.findById(this._id);
      const player = currentGame?.players.find((p: ICrashGamePlayer) => p.playerId.toString() === playerId.toString());

      if (!player || Number(player.status) !== BET_STATES.Playing) {
        return null;
      }

      if (cashoutData.stoppedAt <= 100 || cashoutData.winningAmount <= 0) {
        return null;
      }

      const updateData = {
        $set: {
          'players.$[elem].status': BET_STATES.CashedOut,
          'players.$[elem].stoppedAt': cashoutData.stoppedAt,
          'players.$[elem].winningAmount': cashoutData.winningAmount,
          'players.$[elem].forcedCashout': Boolean(cashoutData.forcedCashout),
          'players.$[elem].cashedOutAt': new Date(),
        },
        $inc: { totalPayouts: cashoutData.winningAmount },
      };

      const Model = mongoose.model<ICrashGame>('CrashGame');

      const updatedGame = await Model.findByIdAndUpdate(this._id, updateData, {
        arrayFilters: [{ 'elem.playerId': playerId }],
        new: true,
      });

      await RecentWinList.findOneAndUpdate(
        {
          category: GAME_CATEGORIES.CRASH,
          isActive: true,
        },
        {
          $set: {
            lastBet: {
              avatar: player.avatar || '',
              betAmount: player.betAmount,
              winAmount: cashoutData.winningAmount,
              username: player.username || 'Anonymous',
              time: new Date(),
              category: GAME_CATEGORIES.CRASH,
              payout: cashoutData.winningAmount / player.betAmount,
            },
          },
        }
      );

      return updatedGame;
    },

    formatGameHistory: function () {
      return {
        _id: this._id,
        crashPoint: this.crashPoint,
        startedAt: this.startedAt,
        endedAt: this.endedAt,
        totalWagers: this.totalWagers,
        totalPayouts: this.totalPayouts,
        playerCount: this.players.length,
      };
    },

    bulkUpdatePlayerBets: async function (bets: Partial<ICrashGamePlayer>[]) {
      const operations = bets.map((bet: Partial<ICrashGamePlayer>) => ({
        updateOne: {
          filter: { _id: this._id, 'players.playerId': bet.playerId },
          update: { $set: { 'players.$': bet } },
        },
      }));

      const totalWagersInc = bets.reduce(
        (sum: number, bet: Partial<ICrashGamePlayer>) => sum + (bet.betAmount || 0),
        0
      );

      const Model = mongoose.model<ICrashGame>('CrashGame');

      await Model.bulkWrite(operations);
      return await Model.findByIdAndUpdate(this._id, { $inc: { totalWagers: totalWagersInc } }, { new: true });
    },
  }));

const CrashGame = mongoose.model<ICrashGame, ICrashGameModel>('CrashGame', CrashGameSchema);

export default CrashGame;
