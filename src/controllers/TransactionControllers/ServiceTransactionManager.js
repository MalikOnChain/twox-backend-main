import ServiceTransaction from '@/models/transactions/ServiceTransactions';
import BalanceManagerService from '@/services/balance/BalanceManager.service';
import { SERVICE_TRANSACTION_STATUS, SERVICE_TRANSACTION_TYPES, CASHBACKCLAIMTYPES } from '@/types/bonus/service';

import { BaseTransactionManager, TransactionError } from './BaseTransactionManager';

export class ServiceTransactionManager extends BaseTransactionManager {
  constructor() {
    super();
    this.serviceTransactionModel = ServiceTransaction;
    this.transactionSessions = new Map();
  }

  async addTransactionSession(userId, transactionId, handler) {
    const sessionKey = userId + ':' + transactionId;
    if (this.transactionSessions.has(sessionKey)) {
      throw new TransactionError('Transaction session already exists', 'TRANSACTION_SESSION_EXISTS');
    }
    this.transactionSessions.set(sessionKey, handler);
  }

  async getTransactionSession(userId, transactionId) {
    const sessionKey = userId + ':' + transactionId;
    return this.transactionSessions.get(sessionKey);
  }

  async createTransaction(userId, type, amount, referenceId, metadata = {}, sessionParam = null) {
    return this.withTransaction(async (_session) => {
      const session = sessionParam || _session;
      const user = await this.getUserById(userId, session);
      const balanceManager = BalanceManagerService;
      const bonusBalances = await balanceManager.getBonusBalanceDetails(user, session);
      const cashbackBalances = await balanceManager.getCashbackBalanceDetails(user, session);
      const referBonusBalances = await balanceManager.getReferBonusBalanceDetails(user, session);
      const wagerRaceBalances = await balanceManager.getWagerRaceBalanceDetails(user, session);
      const freeSpinsBalances = await balanceManager.getFreeSpinsBalanceDetails(user, session);
      const serviceTransaction = new this.serviceTransactionModel({
        userId,
        type,
        amount,
        userBalance: {
          before: user.balance,
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
        referBonusBalances: {
          before: referBonusBalances,
          after: null,
        },
        wagerRaceBalances: {
          before: wagerRaceBalances,
          after: null,
        },
        freeSpinsBalances: {
          before: freeSpinsBalances,
          after: null,
        },
        status: SERVICE_TRANSACTION_STATUS.PENDING,
        referenceId,
        metadata,
      });

      await serviceTransaction.save({ session });

      return {
        serviceTransaction,
      };
    });
  }

  async processTransaction(transactionId, sessionParam = null) {
    return this.withTransaction(async (_session) => {
      const session = sessionParam || _session;
      const serviceTransaction = await this.serviceTransactionModel.findById(transactionId).session(session);

      if (!serviceTransaction || serviceTransaction.status !== SERVICE_TRANSACTION_STATUS.PENDING) {
        throw new TransactionError('Invalid transaction or status', 'INVALID_TRANSACTION');
      }

      const user = await this.getUserById(serviceTransaction.userId, session);

      if (serviceTransaction.type === SERVICE_TRANSACTION_TYPES.BONUS) {
        await user.increaseGameTokenBalance(
          serviceTransaction.amount,
          SERVICE_TRANSACTION_TYPES.BONUS,
          {
            bonus: serviceTransaction.metadata.bonus,
            type: serviceTransaction.metadata.bonus.type,
            amount: serviceTransaction.amount,
          },
          session
        );
      } else if (serviceTransaction.type === SERVICE_TRANSACTION_TYPES.CASHBACK) {
        if (serviceTransaction.metadata.claimMode === CASHBACKCLAIMTYPES.INSTANT) {
          await user.increaseGameTokenBalance(
            serviceTransaction.amount,
            SERVICE_TRANSACTION_TYPES.CASHBACK,
            {
              type: serviceTransaction.metadata.cashbackType,
              wagerMultiplier: serviceTransaction.metadata.wagerMultiplier,
              amount: serviceTransaction.amount,
            },
            session
          );
        }
      } else if (serviceTransaction.type === SERVICE_TRANSACTION_TYPES.FREE_SPINS) {
        await user.increaseGameTokenBalance(
          serviceTransaction.amount,
          SERVICE_TRANSACTION_TYPES.FREE_SPINS,
          {
            bonusId: serviceTransaction.metadata.bonus?._id,
            type: serviceTransaction.metadata.bonus?.type,
            wageringMultiplier: serviceTransaction.metadata.bonus?.wageringMultiplier || 1,
          },
          session
        );
      } else {
        await user.increaseGameTokenBalance(serviceTransaction.amount, serviceTransaction.type, {}, session);
      }

      const balanceManager = BalanceManagerService;
      const bonusBalances = await balanceManager.getBonusBalanceDetails(user, session);
      const cashbackBalances = await balanceManager.getCashbackBalanceDetails(user, session);
      const referBonusBalances = await balanceManager.getReferBonusBalanceDetails(user, session);
      const wagerRaceBalances = await balanceManager.getWagerRaceBalanceDetails(user, session);
      const freeSpinsBalances = await balanceManager.getFreeSpinsBalanceDetails(user, session);

      serviceTransaction.status = SERVICE_TRANSACTION_STATUS.COMPLETED;
      serviceTransaction.version += 1;
      serviceTransaction.userBalance.after = user.balance;
      serviceTransaction.bonusBalances.after = bonusBalances;
      serviceTransaction.cashbackBalances.after = cashbackBalances;
      serviceTransaction.referBonusBalances.after = referBonusBalances;
      serviceTransaction.wagerRaceBalances.after = wagerRaceBalances;
      serviceTransaction.freeSpinsBalances.after = freeSpinsBalances;

      await serviceTransaction.save({ session });

      return {
        serviceTransaction,
      };
    });
  }

  async cancelTransaction(id, reason) {
    return this.withTransaction(async (session) => {
      const serviceTransaction = await super.cancelTransaction(this.serviceTransactionModel, id, reason, session);

      return {
        serviceTransaction,
      };
    });
  }

  async verifyTransaction(transactionId) {
    const serviceTransaction = await this.serviceTransactionModel.findById(transactionId);
    if (!serviceTransaction) {
      throw new TransactionError('Transaction not found', 'NOT_FOUND');
    }

    return {
      isValid: true,
      serviceTransaction,
    };
  }
}

const serviceTransactionManager = new ServiceTransactionManager();

export class ServiceTransactionHandler {
  constructor(type) {
    this._manager = serviceTransactionManager;
    this._serviceTransaction = null;
    this._userId = null;
    this._type = type;
  }

  async startTransaction(userId, amount, referenceId, metadata = {}, sessionParam = null) {
    if (this._serviceTransaction) {
      throw new TransactionError('Transaction already in progress', 'TRANSACTION_IN_PROGRESS');
    }

    const result = await this._manager.createTransaction(
      userId,
      this._type,
      amount,
      referenceId,
      metadata,
      sessionParam
    );
    this._serviceTransaction = result.serviceTransaction;
    this._userId = userId;
    this._manager.addTransactionSession(userId, this._serviceTransaction._id, this);
    return this;
  }

  async process(sessionParam = null) {
    this._validateTransactionExists();
    const result = await this._manager.processTransaction(this._serviceTransaction._id, sessionParam);
    this._updateTransactionState(result);
    return this;
  }

  async cancel(reason) {
    this._validateTransactionExists();
    const result = await this._manager.cancelTransaction(this._serviceTransaction._id, reason);
    this._updateTransactionState(result);
    return this;
  }

  async verify() {
    this._validateTransactionExists();
    return await this._manager.verifyTransaction(this._serviceTransaction._id);
  }

  getDetails() {
    this._validateTransactionExists();
    return {
      id: this._serviceTransaction._id,
      status: this._serviceTransaction.status,
      amount: this._serviceTransaction.amount,
      type: this._serviceTransaction.type,
      referenceId: this._serviceTransaction.referenceId,
      userBalance: this._serviceTransaction.userBalance,
      createdAt: this._serviceTransaction.createdAt,
    };
  }

  reset() {
    this._serviceTransaction = null;
    this._userId = null;
    return this;
  }

  _validateTransactionExists() {
    if (!this._serviceTransaction) {
      throw new TransactionError('No active transaction. Call startTransaction first.', 'NO_ACTIVE_TRANSACTION');
    }
  }

  _updateTransactionState(result) {
    this._serviceTransaction = result.serviceTransaction;
  }
}

export default serviceTransactionManager;
