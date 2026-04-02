import SkinsbackTransaction from '@/models/transactions/SkinsbackTransactions';
import { logger } from '@/utils/logger';

import {
  BaseTransactionManager,
  TransactionError,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
} from './BaseTransactionManager';

export class SkinsbackTransactionManager extends BaseTransactionManager {
  constructor() {
    super();
    this.skinsbackTransactionModel = SkinsbackTransaction;
  }

  async createTransaction(userId, data) {
    return this.withTransaction(async (session) => {
      const skinsbackTransaction = new this.skinsbackTransactionModel({
        userId,
        ...data,
      });

      await skinsbackTransaction.save({ session });

      return {
        skinsbackTransaction,
      };
    });
  }

  async processDeposit(transactionId, confirmedAmount) {
    return this.withTransaction(async (session) => {
      const skinsbackTransaction = await this.skinsbackTransactionModel.findById(transactionId).session(session);

      if (!skinsbackTransaction || skinsbackTransaction.type !== TRANSACTION_TYPE.DEPOSIT) {
        throw new TransactionError('Invalid transaction or type', 'INVALID_TRANSACTION');
      }

      const user = await this.getUserById(skinsbackTransaction.userId, session);
      const updatedUser = await user.increaseGameTokenBalance(confirmedAmount, TRANSACTION_TYPE.DEPOSIT);

      // Update skinsback transaction
      skinsbackTransaction.exchangedAmount = confirmedAmount;
      skinsbackTransaction.userBalance = {
        before: user.balance,
        after: updatedUser.balance,
      };
      skinsbackTransaction.status = TRANSACTION_STATUS.COMPLETED;
      skinsbackTransaction.version += 1;

      await skinsbackTransaction.save({ session });

      logger.info(skinsbackTransaction, 'skinsbackTransaction');

      return {
        skinsbackTransaction,
      };
    });
  }

  async processWithdrawal() {
    // TODO: Implement withdrawal
  }

  async verifyTransaction(transactionId) {
    const skinsbackTransaction = await this.skinsbackTransactionModel.findById(transactionId);
    if (!skinsbackTransaction) {
      throw new TransactionError('Transaction not found', 'NOT_FOUND');
    }

    return {
      isValid: true,
      skinsbackTransaction,
    };
  }

  async cancelTransaction(id, reason) {
    return this.withTransaction(async (session) => {
      const skinsbackTransaction = await super.cancelTransaction(this.skinsbackTransactionModel, id, reason, session);

      if (skinsbackTransaction.amount && skinsbackTransaction.type === TRANSACTION_TYPE.WITHDRAW) {
        const user = await this.getUserById(skinsbackTransaction.userId, session);
        const tokenAmount = skinsbackTransaction.amount * skinsbackTransaction.exchangedAmount;
        await user.increaseBalance(tokenAmount, session);
      }

      return {
        skinsbackTransaction,
      };
    });
  }
}

const skinsbackTransactionManager = new SkinsbackTransactionManager();

export class SkinsbackTransactionHandler {
  constructor(category) {
    this._manager = skinsbackTransactionManager;
    this._skinsbackTransaction = null;
    this._userId = null;
    this._transactionData = null;
    this._category = category;
  }

  // Start a new transaction
  async startTransaction(userId, transactionData) {
    if (this._skinsbackTransaction) {
      throw new TransactionError('Transaction already in progress', 'TRANSACTION_IN_PROGRESS');
    }

    const result = await this._manager.createTransaction(userId, {
      ...transactionData,
      category: this._category,
    });

    this._skinsbackTransaction = result.skinsbackTransaction;
    this._userId = userId;
    this._transactionData = transactionData;

    return result;
  }

  // Process deposit
  async processDeposit(confirmedAmount) {
    this._validateTransactionExists();
    this._validateTransactionType(TRANSACTION_TYPE.DEPOSIT);

    const result = await this._manager.processDeposit(this._skinsbackTransaction._id, confirmedAmount);
    this._updateTransactionState(result);
    return this;
  }

  // Process withdrawal
  async processWithdrawal() {
    this._validateTransactionExists();
    this._validateTransactionType(TRANSACTION_TYPE.WITHDRAW);

    const result = await this._manager.processWithdrawal(this._skinsbackTransaction._id);
    this._updateTransactionState(result);
    return this;
  }

  // Cancel the transaction
  async cancel(reason) {
    this._validateTransactionExists();

    const result = await this._manager.cancelTransaction(this._skinsbackTransaction._id, reason);
    this._updateTransactionState(result);
    return this;
  }

  // Get current transaction details
  getDetails() {
    this._validateTransactionExists();

    return {
      id: this._skinsbackTransaction._id,
      userId: this._userId,
      type: this._skinsbackTransaction.type,
      status: this._skinsbackTransaction.status,
      amount: this._skinsbackTransaction.amount,
      exchangedAmount: this._skinsbackTransaction.exchangedAmount,
      category: this._category,
      transactionData: this._transactionData,
      balance: this._skinsbackTransaction.userBalance,
      version: this._skinsbackTransaction.version,
    };
  }

  // Verify current transaction
  async verify() {
    this._validateTransactionExists();
    return await this._manager.verifyTransaction(this._skinsbackTransaction._id);
  }

  // Reset handler state for new transaction
  reset() {
    this._skinsbackTransaction = null;
    this._userId = null;
    this._transactionData = null;
    return this;
  }

  // Private helper methods
  _validateTransactionExists() {
    if (!this._skinsbackTransaction) {
      throw new TransactionError('No active transaction. Call startTransaction first.', 'NO_ACTIVE_TRANSACTION');
    }
  }

  _validateTransactionType(expectedType) {
    if (this._skinsbackTransaction.type !== expectedType) {
      throw new TransactionError(
        `Invalid transaction type. Expected ${expectedType}, got ${this._skinsbackTransaction.type}`,
        'INVALID_TYPE'
      );
    }
  }

  _updateTransactionState(result) {
    this._skinsbackTransaction = result.skinsbackTransaction;
  }
}

export default skinsbackTransactionManager;
