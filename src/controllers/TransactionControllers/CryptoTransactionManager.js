import mongoose from 'mongoose';

import CryptoTransaction from '@/models/transactions/CryptoTransactions';
import { BALANCE_UPDATE_TYPES } from '@/types/balance/balance';
import { logger } from '@/utils/logger';

import {
  BaseTransactionManager,
  TransactionError,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from './BaseTransactionManager';

export class CryptoTransactionManager extends BaseTransactionManager {
  constructor() {
    super();
    this.cryptoTransactionModel = CryptoTransaction;
    this.transactionSessions = new Map();
    this.sessionLocks = new Map();
  }

  async addTransactionSession(userId, transactionId, handler) {
    const sessionKey = userId + ':' + transactionId;

    logger.info(sessionKey, 'sessionKey ----------------------------');

    if (this.sessionLocks.has(sessionKey)) {
      try {
        await this.sessionLocks.get(sessionKey);
      } catch (error) {
        logger.warn(`Lock acquisition failed for ${sessionKey}: ${error.message}`);
      }
    }

    let resolveLock, rejectLock;
    const lockPromise = new Promise((resolve, reject) => {
      resolveLock = resolve;
      rejectLock = reject;
    });
    this.sessionLocks.set(sessionKey, lockPromise);

    try {
      if (this.transactionSessions.has(sessionKey)) {
        logger.info(`Session for ${sessionKey} already exists, returning existing handler`);
        return this.transactionSessions.get(sessionKey);
      }

      this.transactionSessions.set(sessionKey, handler);
      resolveLock();
      return handler;
    } catch (error) {
      rejectLock(error);
      throw new TransactionError(`Failed to add transaction session: ${error.message}`, 'TRANSACTION_SESSION_ERROR');
    } finally {
      setTimeout(() => {
        if (this.sessionLocks.get(sessionKey) === lockPromise) {
          this.sessionLocks.delete(sessionKey);
        }
      }, 5000);
    }
  }

  async updateTransactionSession(userId, transactionId, handler) {
    const sessionKey = userId + ':' + transactionId;

    if (this.sessionLocks.has(sessionKey)) {
      try {
        await this.sessionLocks.get(sessionKey);
      } catch (error) {
        logger.warn(`Lock acquisition failed for ${sessionKey}: ${error.message}`);
      }
    }

    let resolveLock, rejectLock;
    const lockPromise = new Promise((resolve, reject) => {
      resolveLock = resolve;
      rejectLock = reject;
    });
    this.sessionLocks.set(sessionKey, lockPromise);

    try {
      if (!this.transactionSessions.has(sessionKey)) {
        logger.warn(`Transaction session not found for ${sessionKey}, creating new session`);
        this.transactionSessions.set(sessionKey, handler);
      } else {
        this.transactionSessions.set(sessionKey, handler);
      }
      resolveLock();
      return handler;
    } catch (error) {
      rejectLock(error);
      throw new TransactionError(`Failed to update transaction session: ${error.message}`, 'TRANSACTION_SESSION_ERROR');
    } finally {
      setTimeout(() => {
        if (this.sessionLocks.get(sessionKey) === lockPromise) {
          this.sessionLocks.delete(sessionKey);
        }
      }, 5000);
    }
  }

  async removeTransactionSession(userId, transactionId) {
    const sessionKey = userId + ':' + transactionId;

    if (this.sessionLocks.has(sessionKey)) {
      try {
        await this.sessionLocks.get(sessionKey);
      } catch (error) {
        logger.warn(`Lock acquisition failed for ${sessionKey}: ${error.message}`);
      }
    }

    let resolveLock, rejectLock;
    const lockPromise = new Promise((resolve, reject) => {
      resolveLock = resolve;
      rejectLock = reject;
    });
    this.sessionLocks.set(sessionKey, lockPromise);

    try {
      if (!this.transactionSessions.has(sessionKey)) {
        logger.warn(`Attempt to remove non-existent session ${sessionKey}`);
        resolveLock();
        return;
      }

      this.transactionSessions.delete(sessionKey);
      resolveLock();
    } catch (error) {
      rejectLock(error);
      throw new TransactionError(`Failed to remove transaction session: ${error.message}`, 'TRANSACTION_SESSION_ERROR');
    } finally {
      setTimeout(() => {
        if (this.sessionLocks.get(sessionKey) === lockPromise) {
          this.sessionLocks.delete(sessionKey);
        }
      }, 5000);
    }
  }

  async getTransactionSession(userId, transactionId) {
    const sessionKey = userId + ':' + transactionId;

    if (this.sessionLocks.has(sessionKey)) {
      try {
        await this.sessionLocks.get(sessionKey);
      } catch (error) {
        logger.warn(`Lock acquisition failed for ${sessionKey}: ${error.message}`);
      }
    }

    const transactionHandler = this.transactionSessions.get(sessionKey);

    if (!transactionHandler) {
      throw new TransactionError('Transaction session not found', 'TRANSACTION_SESSION_NOT_FOUND');
    }

    return transactionHandler;
  }

  hasTransactionSession(userId, transactionId) {
    const sessionKey = userId + ':' + transactionId;
    return this.transactionSessions.has(sessionKey);
  }

  getAllSessions() {
    return Array.from(this.transactionSessions.keys());
  }

  async createTransaction(userId, data) {
    return this.withTransaction(async (session) => {
      try {
        const result = await this.cryptoTransactionModel.findOneAndUpdate(
          {
            transactionId: data.transactionId,
          },
          {
            $setOnInsert: {
              userId,
              ...data,
              createdAt: new Date(),
            },
          },
          {
            upsert: true,
            new: true,
            session,
            runValidators: true,
          }
        );

        // If this is a completely new transaction, we might need to do additional processing
        const isNewTransaction =
          result.updatedAt && result.createdAt && result.updatedAt.getTime() === result.createdAt.getTime();

        if (isNewTransaction) {
          logger.debug(`Created new transaction with ID: ${result._id} for txnId: ${data.transactionId}`);
        } else {
          logger.debug(`Found existing transaction with ID: ${result._id} for txnId: ${data.transactionId}`);
        }

        return {
          cryptoTransaction: result,
          isNewTransaction,
        };
      } catch (error) {
        // Handle duplicate key error specifically
        if (error.code === 11000) {
          logger.info(`Duplicate transaction detected for txnId: ${data.transactionId}, retrieving existing record`);

          // Fetch the existing transaction
          const existingTransaction = await this.cryptoTransactionModel
            .findOne({
              transactionId: data.transactionId,
            })
            .session(session);

          // Find or create the secure transaction
          const secureTransaction =
            (await this.secureTransactionManager.findByCryptoTransactionId(existingTransaction._id)) ||
            (await this.secureTransactionManager.createSecureTransaction(existingTransaction.toObject(), 'CRYPTO'));

          return {
            cryptoTransaction: existingTransaction,
            secureTransaction,
            isNewTransaction: false,
          };
        }

        // Rethrow other errors
        throw error;
      }
    });
  }

  async processDeposit(transactionId, confirmedAmount, confirmations) {
    return this.withTransaction(async (session) => {
      const cryptoTransaction = await this.cryptoTransactionModel.findById(transactionId).session(session);

      if (!cryptoTransaction || cryptoTransaction.type !== TRANSACTION_TYPE.DEPOSIT) {
        throw new TransactionError('Invalid transaction or type', 'INVALID_TRANSACTION');
      }

      if (confirmations < cryptoTransaction.targetConfirmations) {
        throw new TransactionError('Transaction not completed', 'TRANSACTION_NOT_COMPLETED');
      }

      // Check both status and confirmations to prevent duplicate processing
      if (cryptoTransaction.status === TRANSACTION_STATUS.COMPLETED) {
        logger.info(`Transaction ${transactionId} already completed, skipping balance update`);
        return {
          cryptoTransaction,
        };
      }

      const user = await this.getUserById(cryptoTransaction.userId, session);
      const oldBalance = user.balance;
      logger.info(oldBalance, 'oldBalance');
      const updatedUser = await user.increaseGameTokenBalance(confirmedAmount, BALANCE_UPDATE_TYPES.DEPOSIT);
      const newBalance = updatedUser.balance;
      logger.info(newBalance, 'newBalance');

      // Update crypto transaction
      cryptoTransaction.exchangedAmount = confirmedAmount;
      cryptoTransaction.userBalance = {
        before: oldBalance,
        after: newBalance,
      };
      cryptoTransaction.status = TRANSACTION_STATUS.COMPLETED;
      cryptoTransaction.currentConfirmations = confirmations;

      await cryptoTransaction.save({ session });

      logger.info(cryptoTransaction, 'cryptoTransaction');

      return {
        cryptoTransaction,
      };
    });
  }

  async updateConfirmations(transactionId, confirmations) {
    return this.withTransaction(async (session) => {
      const cryptoTransaction = await this.cryptoTransactionModel.findById(transactionId).session(session);

      if (!cryptoTransaction || cryptoTransaction.type !== TRANSACTION_TYPE.DEPOSIT) {
        throw new TransactionError('Invalid transaction or type', 'INVALID_TRANSACTION');
      }

      if (cryptoTransaction.currentConfirmations >= cryptoTransaction.targetConfirmations) {
        throw new TransactionError('Transaction already completed', 'TRANSACTION_COMPLETED');
      }

      if (confirmations <= cryptoTransaction.currentConfirmations) {
        return {
          cryptoTransaction,
        };
      }

      cryptoTransaction.currentConfirmations = confirmations;
      await cryptoTransaction.save({ session });

      return {
        cryptoTransaction,
      };
    });
  }

  async processWithdrawal(transactionId, networkTxId) {
    return this.withTransaction(async (session) => {
      const cryptoTransaction = await this.cryptoTransactionModel.findById(transactionId).session(session);

      if (!cryptoTransaction || cryptoTransaction.type !== TRANSACTION_TYPE.WITHDRAW) {
        throw new TransactionError('Invalid transaction or type', 'INVALID_TRANSACTION');
      }

      const user = await this.getUserById(cryptoTransaction.userId, session);
      const updatedUser = await user.decreaseGameTokenBalance(
        cryptoTransaction.exchangedAmount,
        BALANCE_UPDATE_TYPES.WITHDRAWAL
      );

      // Update crypto transaction
      cryptoTransaction.transactionId = networkTxId;
      cryptoTransaction.userBalance = {
        before: user.balance,
        after: updatedUser.balance,
      };
      cryptoTransaction.status = TRANSACTION_STATUS.COMPLETED;

      await cryptoTransaction.save({ session });

      return {
        cryptoTransaction,
      };
    });
  }

  async verifyTransaction(transactionId) {
    const cryptoTransaction = await this.cryptoTransactionModel.findById(transactionId);
    if (!cryptoTransaction) {
      throw new TransactionError('Transaction not found', 'NOT_FOUND');
    }

    return {
      isValid: true,
      cryptoTransaction,
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

    const stats = await this.cryptoTransactionModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalDeposits: { $sum: { $cond: [{ $eq: ['$type', TRANSACTION_TYPE.DEPOSIT] }, 1, 0] } },
          totalWithdraws: { $sum: { $cond: [{ $eq: ['$type', TRANSACTION_TYPE.WITHDRAW] }, 1, 0] } },
          totalDepositAmount: {
            $sum: {
              $cond: [{ $eq: ['$type', TRANSACTION_TYPE.DEPOSIT] }, '$exchangedAmount', 0],
            },
          },
          totalWithdrawAmount: {
            $sum: {
              $cond: [{ $eq: ['$type', TRANSACTION_TYPE.WITHDRAW] }, '$exchangedAmount', 0],
            },
          },
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
        totalDeposits: 0,
        totalWithdraws: 0,
        totalDepositAmount: 0,
        totalWithdrawAmount: 0,
      }),
    };
  }

  async getDepositAmountByUserId(userId) {
    const stats = await this.cryptoTransactionModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: TRANSACTION_TYPE.DEPOSIT,
          status: {
            $in: [TRANSACTION_STATUS.COMPLETED],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalDepositAmount: {
            $sum: '$exchangedAmount',
          },
        },
      },
    ]);

    return stats[0]?.totalDepositAmount ? stats[0] : { totalDepositAmount: 0 };
  }

  async getDepositTransactionsByUserId(userId) {
    logger.debug('getDepositTransactionsByUserId', userId);

    const transactions = await this.cryptoTransactionModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      type: TRANSACTION_TYPE.DEPOSIT,
      status: {
        $in: [TRANSACTION_STATUS.COMPLETED],
      },
    });

    return transactions;
  }

  async cancelTransaction(id, reason) {
    return this.withTransaction(async (session) => {
      const cryptoTransaction = await this.cancelTransaction(this.cryptoTransactionModel, id, reason, session);

      return {
        cryptoTransaction,
      };
    });
  }
}

const cryptoTransactionManager = new CryptoTransactionManager();

export class CryptoTransactionHandler {
  constructor(category) {
    this._category = category || 'crypto';
    this._cryptoTransaction = null;
    this._manager = cryptoTransactionManager;
    this._initTime = Date.now();
  }

  async startTransaction(userId, transactionData) {
    try {
      // Check for existing transaction
      if (this._cryptoTransaction) {
        logger.warn(`Transaction already in progress for handler created at ${this._initTime}`);
        throw new TransactionError('Transaction already in progress', 'INVALID_STATE');
      }

      if (this._manager.hasTransactionSession(userId, transactionData.transactionId)) {
        logger.warn(`Transaction already in progress for handler created at ${this._initTime}`);
        throw new TransactionError('Transaction already in progress', 'INVALID_STATE');
      }

      const { cryptoTransaction } = await this._manager.createTransaction(userId, {
        ...transactionData,
        category: this._category,
      });

      // Add transaction to session manager
      await this._manager.addTransactionSession(userId, cryptoTransaction._id, this);

      // Wait a bit to ensure transaction is properly registered
      await new Promise((resolve) => setTimeout(resolve, 200));

      this._cryptoTransaction = cryptoTransaction;

      return cryptoTransaction;
    } catch (error) {
      // Handle duplicate key error by fetching and using the existing transaction
      if (error.code === 11000 && transactionData.transactionId) {
        logger.info(`Duplicate transaction detected for ${transactionData.transactionId}, retrieving existing record`);
        const existingTransaction = await CryptoTransaction.findOne({
          transactionId: transactionData.transactionId,
        });

        if (existingTransaction) {
          // Load the existing transaction into the handler
          this._cryptoTransaction = existingTransaction;

          // Update session
          try {
            await this._manager.updateTransactionSession(userId, existingTransaction._id, this);
          } catch (sessionError) {
            logger.warn(`Failed to update session for existing transaction: ${sessionError.message}`);
          }

          return existingTransaction;
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  async processDeposit(confirmedAmount, confirmations) {
    try {
      this._validateTransactionExists();
      this._validateTransactionType(TRANSACTION_TYPE.DEPOSIT);

      // Check if transaction is already completed to prevent double processing
      if (this._cryptoTransaction.status === TRANSACTION_STATUS.COMPLETED) {
        logger.info(`Transaction ${this._cryptoTransaction._id} already completed, skipping processing`);
        return this._cryptoTransaction;
      }

      const result = await this._manager.processDeposit(this._cryptoTransaction._id, confirmedAmount, confirmations);

      // remove the session
      this._manager.removeTransactionSession(this._cryptoTransaction.userId, this._cryptoTransaction._id);

      this._updateTransactionState(result);
      return this._cryptoTransaction;
    } catch (error) {
      logger.error(`Error processing deposit: ${error.message}`, error);

      // Special handling for common errors
      if (error.message.includes('Transaction already completed')) {
        // This is fine, just return the transaction
        return this._cryptoTransaction;
      }

      throw error;
    }
  }

  async updateConfirmations(confirmations) {
    try {
      this._validateTransactionExists();
      this._validateTransactionType(TRANSACTION_TYPE.DEPOSIT);

      // Skip if we already have more confirmations
      if (this._cryptoTransaction.currentConfirmations >= confirmations) {
        logger.info(
          `Transaction ${this._cryptoTransaction._id} already has ${this._cryptoTransaction.currentConfirmations} confirmations, skipping update to ${confirmations}`
        );
        return this._cryptoTransaction;
      }

      const result = await this._manager.updateConfirmations(this._cryptoTransaction._id, confirmations);
      this._updateTransactionState(result);
      return this._cryptoTransaction;
    } catch (error) {
      logger.error(`Error updating confirmations: ${error.message}`, error);
      throw error;
    }
  }

  async processWithdrawal(networkTxId) {
    try {
      this._validateTransactionExists();
      this._validateTransactionType(TRANSACTION_TYPE.WITHDRAW);

      const result = await this._manager.processWithdrawal(this._cryptoTransaction._id, networkTxId);
      this._updateTransactionState(result);
      return this._cryptoTransaction;
    } catch (error) {
      logger.error(`Error processing withdrawal: ${error.message}`, error);
      throw error;
    }
  }

  async cancel(reason) {
    try {
      this._validateTransactionExists();
      const result = await this._manager.cancelTransaction(this._cryptoTransaction._id, reason);
      this._updateTransactionState(result);
      return this._cryptoTransaction;
    } catch (error) {
      logger.error(`Error canceling transaction: ${error.message}`, error);
      throw error;
    }
  }

  getDetails() {
    try {
      this._validateTransactionExists();
      return {
        id: this._cryptoTransaction._id,
        userId: this._cryptoTransaction.userId,
        status: this._cryptoTransaction.status,
        type: this._cryptoTransaction.type,
        amount: this._cryptoTransaction.amount,
        exchangedAmount: this._cryptoTransaction.exchangedAmount,
        exchangeRate: this._cryptoTransaction.exchangeRate,
        unit: this._cryptoTransaction.unit,
        createdAt: this._cryptoTransaction.createdAt,
        updatedAt: this._cryptoTransaction.updatedAt,
      };
    } catch (error) {
      logger.error(`Error getting transaction details: ${error.message}`, error);
      return null;
    }
  }

  async verify() {
    try {
      this._validateTransactionExists();
      const result = await this._manager.verifyTransaction(this._cryptoTransaction._id);
      return result;
    } catch (error) {
      logger.error(`Error verifying transaction: ${error.message}`, error);
      throw error;
    }
  }

  reset() {
    // Try to remove transaction session before reset
    if (this._cryptoTransaction) {
      try {
        this._manager.removeTransactionSession(this._cryptoTransaction.userId, this._cryptoTransaction._id);
      } catch (error) {
        logger.warn(`Failed to remove transaction session: ${error.message}`);
      }
    }

    this._cryptoTransaction = null;
  }

  _validateTransactionExists() {
    if (!this._cryptoTransaction) {
      const error = new TransactionError('No active transaction', 'INVALID_STATE');
      logger.error('Transaction state validation failed: No active transaction');
      throw error;
    }
  }

  _validateTransactionType(expectedType) {
    if (this._cryptoTransaction.type !== expectedType) {
      const error = new TransactionError(
        `Invalid transaction type. Expected ${expectedType}, got ${this._cryptoTransaction.type}`,
        'INVALID_TYPE'
      );
      logger.error(`Transaction type validation failed: ${error.message}`);
      throw error;
    }
  }

  _updateTransactionState(result) {
    if (result && result.cryptoTransaction) {
      this._cryptoTransaction = result.cryptoTransaction;
    }
  }
}

export default cryptoTransactionManager;
