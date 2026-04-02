import mongoose from 'mongoose';

import User from '@/models/users/User';

// Constants
const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  APPROVED: 'APPROVED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
};

const TRANSACTION_TYPE = {
  BET: 'BET',
  WIN: 'WIN',
  LOSE: 'LOSE',
  DEPOSIT: 'DEPOSIT',
  WITHDRAW: 'WITHDRAW',
  REFUND: 'REFUND',
};

class TransactionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'TransactionError';
    this.code = code;
    this.details = details;
  }
}

export class BaseTransactionManager {
  constructor() {
    this.userModel = User;
  }

  async withTransaction(operation) {
    const session = await mongoose.startSession();
    session.startTransaction();

    // Log session ID (Unique per session)
    // logger.debug(`Starting Transaction: Session ID: ${session.serverSession.txnNumber || 'Unknown'}`);

    try {
      const result = await operation(session);

      // Log session details before commit
      // logger.debug(`Committing Transaction: Session ID: ${session.serverSession.txnNumber || 'Unknown'}`);

      await session.commitTransaction();
      return result;
    } catch (error) {
      // Log error with session info
      // logger.error(`Transaction Error: ${error.message} | Session ID: ${session.serverSession.txnNumber || 'Unknown'}`);

      await session.abortTransaction();
      throw error;
    } finally {
      // Log session close
      // logger.debug(`Ending Transaction: Session ID: ${session.serverSession.txnNumber || 'Unknown'}`);
      session.endSession();
    }
  }

  async getUserById(userId, session) {
    const user = await this.userModel.findById(userId).session(session);
    if (!user) {
      throw new TransactionError('User not found', 'USER_NOT_FOUND');
    }
    return user;
  }

  async getTransactionById(model, id) {
    const transaction = await model.findById(id);
    if (!transaction) {
      throw new TransactionError('Transaction not found', 'NOT_FOUND');
    }
    return transaction;
  }

  async cancelTransaction(model, id, reason, session) {
    const transaction = await model.findById(id).session(session);

    if (!transaction) {
      throw new TransactionError('Transaction not found', 'NOT_FOUND');
    }

    if (transaction.status === TRANSACTION_STATUS.COMPLETED) {
      throw new TransactionError('Cannot cancel completed transaction', 'INVALID_CANCELLATION');
    }

    transaction.status = TRANSACTION_STATUS.CANCELLED;
    transaction.errorDetails = {
      code: 'CANCELLED',
      message: reason,
      timestamp: new Date(),
    };
    transaction.version += 1;

    await transaction.save({ session });
    return transaction;
  }
}

export { TransactionError, TRANSACTION_STATUS, TRANSACTION_TYPE };

export default new BaseTransactionManager();
