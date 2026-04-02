import { TransactionError } from './BaseTransactionManager';
import cryptoTransactionManager from './CryptoTransactionManager';
import GameTransactionManager from './GameTransactionManager';

export class TransactionService {
  constructor() {
    this.gameManager = GameTransactionManager;
    this.cryptoManager = cryptoTransactionManager;
  }

  // Common transaction operations
  async getTransactionById(id, type) {
    const manager = this._getManagerByType(type);
    return manager.getTransactionById(id);
  }

  async cancelTransaction(id, type, reason) {
    const manager = this._getManagerByType(type);
    return manager.cancelTransaction(id, reason);
  }

  async getUserTransactions(userId, options = {}) {
    const { type, status, startDate, endDate, limit = 10, skip = 0 } = options;

    let manager;
    if (type) {
      manager = this._getManagerByType(type);
      return this._getTransactionsFromManager(manager, userId, { status, startDate, endDate, limit, skip });
    }

    // If no type specified, fetch from both managers and combine results
    const [gameResults, cryptoResults] = await Promise.all([
      this._getTransactionsFromManager(this.gameManager, userId, {
        status,
        startDate,
        endDate,
        limit: limit / 2,
        skip,
      }),
      this._getTransactionsFromManager(this.cryptoManager, userId, {
        status,
        startDate,
        endDate,
        limit: limit / 2,
        skip,
      }),
    ]);

    return {
      transactions: [...gameResults.transactions, ...cryptoResults.transactions]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit),
      pagination: {
        total: gameResults.pagination.total + cryptoResults.pagination.total,
        limit,
        skip,
        hasMore: gameResults.pagination.hasMore || cryptoResults.pagination.hasMore,
      },
    };
  }

  async getUserStats(userId, timeframe = '24h') {
    const [gameStats, cryptoStats] = await Promise.all([
      this.gameManager.getStats(userId, timeframe),
      this.cryptoManager.getStats(userId, timeframe),
    ]);

    return {
      timeframe,
      period: gameStats.period,
      game: {
        totalBets: gameStats.totalBets,
        totalWins: gameStats.totalWins,
        totalBetAmount: gameStats.totalBetAmount,
        totalWinAmount: gameStats.totalWinAmount,
        netAmount: gameStats.totalWinAmount - gameStats.totalBetAmount,
      },
      crypto: {
        totalDeposits: cryptoStats.totalDeposits,
        totalWithdraws: cryptoStats.totalWithdraws,
        totalDepositAmount: cryptoStats.totalDepositAmount,
        totalWithdrawAmount: cryptoStats.totalWithdrawAmount,
        netAmount: cryptoStats.totalDepositAmount - cryptoStats.totalWithdrawAmount,
      },
    };
  }

  // Helper methods
  _getManagerByType(type) {
    switch (type.toUpperCase()) {
      case 'GAME':
        return this.gameManager;
      case 'CRYPTO':
        return this.cryptoManager;
      default:
        throw new TransactionError('Invalid transaction type', 'INVALID_TYPE');
    }
  }

  async _getTransactionsFromManager(manager, userId, options) {
    const query = { userId };

    if (options.status) {
      query.status = options.status;
    }

    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = options.startDate;
      if (options.endDate) query.createdAt.$lte = options.endDate;
    }

    const [transactions, total] = await Promise.all([
      manager.transactionModel.find(query).sort({ createdAt: -1 }).skip(options.skip).limit(options.limit).exec(),
      manager.transactionModel.countDocuments(query),
    ]);

    return {
      transactions,
      pagination: {
        total,
        limit: options.limit,
        skip: options.skip,
        hasMore: total > options.skip + options.limit,
      },
    };
  }
}

export default new TransactionService();
