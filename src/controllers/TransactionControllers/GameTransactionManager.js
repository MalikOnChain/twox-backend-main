import {
  BaseTransactionManager,
  TransactionError,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from '@/controllers/TransactionControllers/BaseTransactionManager';
import GameTransaction from '@/models/transactions/GameTransactions';
import WagerRace from '@/models/wagerRace/WagerRace';
import BalanceManagerService from '@/services/balance/BalanceManager.service';
import CashbackService from '@/services/cashback/Cashback.service';
import WagerRaceService from '@/services/wagerRace/WagerRace.service';
import { BALANCE_UPDATE_TYPES } from '@/types/balance/balance';
import { logger } from '@/utils/logger';

export class GameTransactionManager extends BaseTransactionManager {
  constructor() {
    super();
    this.gameTransactionModel = GameTransaction;
    this.balanceManager = BalanceManagerService;
  }

  async createTransaction(userId, gameData, category) {
    return this.withTransaction(async (session) => {
      const [user, wagerRaces] = await Promise.all([
        this.getUserById(userId, session),
        WagerRace.getActiveRacesByUserId(userId),
      ]);

      const freeSpinBalances = await this.balanceManager.getFreeSpinsBalanceDetails(user);
      const bonusBalances = await this.balanceManager.getBonusBalanceDetails(user);
      const cashbackBalances = await this.balanceManager.getCashbackBalanceDetails(user);
      const referBonusBalances = await this.balanceManager.getReferBonusBalanceDetails(user);
      const wagerRaceBalances = await this.balanceManager.getWagerRaceBalanceDetails(user);

      // Create the game transaction
      const gameTransaction = new this.gameTransactionModel({
        category,
        userId,
        type: TRANSACTION_TYPE.BET,
        game: gameData,
        betAmount: 0,
        winAmount: 0,
        userBalance: {
          before: user.balance,
          after: null,
        },
        freeSpinBalances: {
          before: freeSpinBalances,
          after: null,
        },
        bonusBalances: {
          before: bonusBalances,
          after: null,
        },
        cashbackBalances: {
          before: cashbackBalances,
          after: null,
        },
        wagerRaceBalances: {
          before: wagerRaceBalances,
          after: null,
        },
        referBonusBalances: {
          before: referBonusBalances,
          after: null,
        },
        status: TRANSACTION_STATUS.PENDING,
        version: 1,
        wagerRaces: wagerRaces.length > 0 ? wagerRaces.map((race) => race._id) : [],
      });

      await gameTransaction.save({ session });

      return {
        gameTransaction,
      };
    });
  }

  async placeBet(transactionId, betAmount) {
    return this.withTransaction(async (session) => {
      // Find game transaction with session
      const gameTransaction = await this.gameTransactionModel.findById(transactionId).session(session);

      const cashbackService = CashbackService;

      if (!gameTransaction) {
        throw new TransactionError('Transaction not found', 'NOT_FOUND');
      }

      if (gameTransaction.status !== TRANSACTION_STATUS.PENDING) {
        throw new TransactionError('Transaction is not in pending status', 'INVALID_STATUS');
      }

      const user = await this.getUserById(gameTransaction.userId, session);

      const result = await user.decreaseGameTokenBalance(
        betAmount,
        BALANCE_UPDATE_TYPES.GAME,
        {
          gameType: gameTransaction.category,
          storeDetails: true,
        },
        session
      );

      const bonusBalances = await this.balanceManager.getBonusBalanceDetails(user, session);
      const cashbackBalances = await this.balanceManager.getCashbackBalanceDetails(user, session);
      const referBonusBalances = await this.balanceManager.getReferBonusBalanceDetails(user, session);
      const wagerRaceBalances = await this.balanceManager.getWagerRaceBalanceDetails(user, session);
      const freeSpinBalances = await this.balanceManager.getFreeSpinsBalanceDetails(user, session);

      // Update game transaction
      gameTransaction.betAmount = betAmount;
      gameTransaction.userBalance.after = user.balance; // New balance after deduction
      gameTransaction.bonusBalances.after = bonusBalances;
      gameTransaction.cashbackBalances.after = cashbackBalances;
      gameTransaction.referBonusBalances.after = referBonusBalances;
      gameTransaction.wagerRaceBalances.after = wagerRaceBalances;
      gameTransaction.freeSpinBalances.after = freeSpinBalances;
      gameTransaction.betDetails = result.betDetails || {};
      gameTransaction.status = TRANSACTION_STATUS.COMPLETED;
      gameTransaction.version += 1;

      await gameTransaction.save({ session });

      // Handle wager race update
      if (gameTransaction.wagerRaces && gameTransaction.wagerRaces.length > 0) {
        try {
          const wagerRaceService = WagerRaceService;
          for (const _raceId of gameTransaction.wagerRaces) {
            await wagerRaceService.updateTotalWageredAmount(gameTransaction.userId, betAmount, {
              gameId: gameTransaction.game.gameId,
              gameType: gameTransaction.category,
              transactionId: gameTransaction._id.toString(),
            });
          }
        } catch (error) {
          logger.error('Error updating wager race:', error);
          // Don't throw error - the bet itself succeeded
        }
      }

      await cashbackService.makeCashbackTransaction(user._id, betAmount, gameTransaction.category, session);

      const availableBalance = await this.balanceManager.getTotalAvailableBalance(user, session);

      return {
        gameTransaction,
        betDetails: result.betDetails,
        availableBalance,
      };
    });
  }

  async winGame(transactionId, winAmount, betDetails = null) {
    return this.withTransaction(async (session) => {
      const gameTransaction = await this.gameTransactionModel.findById(transactionId).session(session);

      if (!gameTransaction || gameTransaction.status !== TRANSACTION_STATUS.COMPLETED) {
        throw new TransactionError('Invalid transaction or status', 'INVALID_TRANSACTION');
      }

      const user = await this.getUserById(gameTransaction.userId, session);

      // Use the handleWin method which properly handles special balances
      await user.increaseGameTokenBalance(
        winAmount,
        BALANCE_UPDATE_TYPES.GAME,
        {
          betDetails: betDetails || gameTransaction.betDetails,
          gameType: gameTransaction.category,
          totalBetAmount: gameTransaction.betAmount,
          mainBalanceAmount:
            gameTransaction.betAmount -
            (gameTransaction.betDetails?.bonusUsed || 0) -
            (gameTransaction.betDetails?.cashbackUsed || 0),
        },
        session
      );

      // Get updated balance details
      const bonusBalances = await this.balanceManager.getBonusBalanceDetails(user);
      const cashbackBalances = await this.balanceManager.getCashbackBalanceDetails(user);

      gameTransaction.winAmount = winAmount;
      gameTransaction.userBalance.after = user.balance;
      gameTransaction.bonusBalances.after = bonusBalances;
      gameTransaction.cashbackBalances.after = cashbackBalances;
      gameTransaction.type = TRANSACTION_TYPE.WIN;
      gameTransaction.version += 1;

      await gameTransaction.save({ session });

      const availableBalance = await this.balanceManager.getTotalAvailableBalance(user, session);

      return {
        gameTransaction,
        availableBalance,
      };
    });
  }

  async loseGame(transactionId) {
    return this.withTransaction(async (session) => {
      const gameTransaction = await this.gameTransactionModel.findById(transactionId).session(session);

      if (!gameTransaction || gameTransaction.status !== TRANSACTION_STATUS.COMPLETED) {
        throw new TransactionError('Invalid transaction or status', 'INVALID_TRANSACTION');
      }

      const user = await this.getUserById(gameTransaction.userId, session);

      // Get updated balance details
      const bonusBalances = await this.balanceManager.getBonusBalanceDetails(user);
      const cashbackBalances = await this.balanceManager.getCashbackBalanceDetails(user);

      // Update game transaction
      gameTransaction.userBalance.after = user.balance;
      gameTransaction.bonusBalances.after = bonusBalances;
      gameTransaction.cashbackBalances.after = cashbackBalances;
      gameTransaction.type = TRANSACTION_TYPE.LOSE;
      gameTransaction.version += 1;

      await gameTransaction.save({ session });

      return {
        gameTransaction,
      };
    });
  }

  async refundGame(transactionId) {
    return this.withTransaction(async (session) => {
      const gameTransaction = await this.gameTransactionModel.findById(transactionId).session(session);

      if (
        !gameTransaction ||
        ![TRANSACTION_STATUS.COMPLETED, TRANSACTION_STATUS.FAILED].includes(gameTransaction.status)
      ) {
        throw new TransactionError('Invalid transaction or status', 'INVALID_TRANSACTION');
      }

      const user = await this.getUserById(gameTransaction.userId, session);
      const updatedUser = await user.increaseBalance(gameTransaction.betAmount, session);

      // Get updated balance details
      const bonusBalances = await this.balanceManager.getBonusBalanceDetails(user);
      const cashbackBalances = await this.balanceManager.getCashbackBalanceDetails(user);

      // Update game transaction
      gameTransaction.type = TRANSACTION_TYPE.REFUND;
      gameTransaction.userBalance.after = updatedUser.balance;
      gameTransaction.bonusBalances.after = bonusBalances;
      gameTransaction.cashbackBalances.after = cashbackBalances;
      gameTransaction.status = TRANSACTION_STATUS.COMPLETED;
      gameTransaction.version += 1;

      await gameTransaction.save({ session });

      return {
        gameTransaction,
      };
    });
  }

  async verifyTransaction(transactionId) {
    const gameTransaction = await this.gameTransactionModel.findById(transactionId);
    if (!gameTransaction) {
      throw new TransactionError('Transaction not found', 'NOT_FOUND');
    }

    return {
      isValid: true,
      gameTransaction,
    };
  }

  async getStats(userId, timeframe = '24h') {
    const query = { userId };
    const startDate = new Date();

    switch (timeframe) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        throw new TransactionError('Invalid timeframe', 'INVALID_TIMEFRAME');
    }

    query.createdAt = { $gte: startDate };

    const stats = await this.gameTransactionModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalBets: { $sum: { $cond: [{ $eq: ['$type', TRANSACTION_TYPE.BET] }, 1, 0] } },
          totalWins: { $sum: { $cond: [{ $eq: ['$type', TRANSACTION_TYPE.WIN] }, 1, 0] } },
          totalBetAmount: { $sum: '$betAmount' },
          totalWinAmount: { $sum: '$winAmount' },
        },
      },
    ]);

    return {
      timeframe,
      period: {
        start: startDate,
        end: new Date(),
      },
      ...(stats[0] || {
        totalBets: 0,
        totalWins: 0,
        totalBetAmount: 0,
        totalWinAmount: 0,
      }),
    };
  }

  async cancelTransaction(id, reason) {
    return this.withTransaction(async (session) => {
      const gameTransaction = await super.cancelTransaction(this.gameTransactionModel, id, reason, session);

      if (gameTransaction.betAmount > 0) {
        const user = await this.getUserById(gameTransaction.userId, session);
        await user.increaseBalance(gameTransaction.betAmount, session);
      }

      return {
        gameTransaction,
      };
    });
  }
}

const gameTransactionManager = new GameTransactionManager();

export class GameTransactionHandler {
  constructor(category) {
    this._category = category;
    this._manager = gameTransactionManager;
    this._gameTransaction = null;
    this._betDetails = null;
    this.availableBalance = 0;
  }

  async startTransaction(userId, gameData) {
    if (this._gameTransaction) {
      throw new TransactionError('Transaction already in progress', 'INVALID_STATE');
    }

    const result = await this._manager.createTransaction(userId, gameData, this._category);
    this._gameTransaction = result.gameTransaction;

    return {
      id: this._gameTransaction._id,
      status: this._gameTransaction.status,
    };
  }

  async placeBet(betAmount) {
    this._validateTransactionExists();

    const result = await this._manager.placeBet(this._gameTransaction._id, betAmount);
    this.availableBalance = result.availableBalance;

    // Update the bet details

    if (betAmount === 0) {
      const gte = new Date(this._gameTransaction.createdAt.getTime() - 5 * 60 * 1000);

      const previousGameTransaction = await this._manager.gameTransactionModel.findOne({
        userId: this._gameTransaction.userId,
        createdAt: {
          $lt: this._gameTransaction.createdAt,
          $gte: gte,
        },
        status: TRANSACTION_STATUS.COMPLETED,
        betAmount: { $gt: 0 },
        'game.gameId': this._gameTransaction.game.gameId,
        'game.category': this._gameTransaction.category,
      });

      if (previousGameTransaction && previousGameTransaction.betDetails) {
        this._updateBetDetails(previousGameTransaction.betDetails);
      } else {
        throw new TransactionError('No previous game transaction found', 'NO_PREVIOUS_GAME_TRANSACTION');
      }
    } else {
      this._updateBetDetails(result.betDetails);
    }

    this._updateTransactionState(result);
    return this;
  }

  async win(winAmount) {
    this._validateTransactionExists();

    const result = await this._manager.winGame(this._gameTransaction._id, winAmount, this._betDetails);
    this.availableBalance = result.availableBalance;

    this._updateTransactionState(result);
    return this;
  }

  async lose() {
    this._validateTransactionExists();

    const result = await this._manager.loseGame(this._gameTransaction._id);
    this._updateTransactionState(result);
    return this;
  }

  async refund() {
    this._validateTransactionExists();

    const result = await this._manager.refundGame(this._gameTransaction._id);
    this._updateTransactionState(result);
    return this;
  }

  async cancel(reason) {
    this._validateTransactionExists();

    const result = await this._manager.cancelTransaction(this._gameTransaction._id, reason);

    this._updateTransactionState(result);
    return this;
  }

  getDetails() {
    this._validateTransactionExists();
    return {
      id: this._gameTransaction._id,
      game: this._gameTransaction.game,
      status: this._gameTransaction.status,
      type: this._gameTransaction.type,
      betAmount: this._gameTransaction.betAmount,
      winAmount: this._gameTransaction.winAmount,
      userBalance: this._gameTransaction.userBalance,
      betDetails: this._gameTransaction.betDetails,
      createdAt: this._gameTransaction.createdAt,
    };
  }

  async verify() {
    this._validateTransactionExists();
    return {
      id: this._gameTransaction._id,
    };
  }

  reset() {
    this._gameTransaction = null;
    this._betDetails = null;
  }

  _validateTransactionExists() {
    if (!this._gameTransaction) {
      throw new TransactionError('No active transaction', 'INVALID_STATE');
    }
  }

  _updateTransactionState(result) {
    this._gameTransaction = result.gameTransaction;
  }

  _updateBetDetails(betDetails) {
    this._betDetails = betDetails;
  }
}

export default gameTransactionManager;
