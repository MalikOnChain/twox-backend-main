import mongoose from 'mongoose';

import { TRANSACTION_STATUS } from '../../controllers/TransactionControllers/BaseTransactionManager';

const { Schema } = mongoose;

// Constants
const EXPIRATION_TIME = 25 * 60 * 1000; // 25 minutes in milliseconds

// Validation helper
const validateAmount = {
  validator: (value: number) => Number.isFinite(value) && value >= 0,
  message: 'Amount must be a non-negative finite number',
};

// Schema definition
const skinsbackTransactionSchema = new Schema<ISkinsbackTransactions>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      validate: validateAmount,
      default: 0,
    },
    userBalance: {
      before: {
        type: Number,
        required: true,
        default: 0,
      },
      after: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.PENDING,
      index: true,
    },
    metadata: {
      tid: String,
      hash: String,
    },
    errorDetails: {
      code: String,
      message: String,
      timestamp: Date,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for expiration check
skinsbackTransactionSchema.virtual('isExpired').get(function () {
  if (!this.createdAt) return false;
  return Date.now() > this.createdAt.getTime() + EXPIRATION_TIME;
});

// Method to check and update expiration status
skinsbackTransactionSchema.methods.checkExpiration = async function () {
  if (this.status === TRANSACTION_STATUS.PENDING && this.isExpired) {
    this.status = TRANSACTION_STATUS.EXPIRED;
    this.errorDetails = {
      code: 'TRANSACTION_EXPIRED',
      message: 'Transaction expired after 25 minutes',
      timestamp: new Date(),
    };
    await this.save();
    return true;
  }
  return false;
};

// Static method to find and update all expired transactions
skinsbackTransactionSchema.statics.updateExpiredTransactions = async function () {
  const expirationDate = new Date(Date.now() - EXPIRATION_TIME);

  const expiredTransactions = await this.find({
    status: TRANSACTION_STATUS.PENDING,
    createdAt: { $lt: expirationDate },
  });

  const updates = expiredTransactions.map((transaction: ISkinsbackTransactions) => ({
    updateOne: {
      filter: { _id: transaction._id },
      update: {
        $set: {
          status: TRANSACTION_STATUS.EXPIRED,
          errorDetails: {
            code: 'TRANSACTION_EXPIRED',
            message: 'Transaction expired after 25 minutes',
            timestamp: new Date(),
          },
        },
      },
    },
  }));

  if (updates.length > 0) {
    await this.bulkWrite(updates);
  }

  return updates.length;
};

// Indexes
skinsbackTransactionSchema.index({ createdAt: 1, status: 1 });
skinsbackTransactionSchema.index({ userId: 1, createdAt: -1 });
skinsbackTransactionSchema.index({ 'metadata.tid': 1 });

const SkinsbackTransaction = mongoose.model<ISkinsbackTransactions, ISkinsbackTransactionsModel>(
  'SkinsbackTransaction',
  skinsbackTransactionSchema
);

export default SkinsbackTransaction;
