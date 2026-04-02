import mongoose from 'mongoose';

import { TRANSACTION_STATUS } from '../../controllers/TransactionControllers/BaseTransactionManager';
import { CRYPTO_TRANSACTION_TYPES } from '../../types/crypto/crypto';
import { BLOCKCHAIN_PROTOCOL_NAME, NETWORK, VAULTODY_TX_EVENTS } from '../../types/vaultody/vaultody';

const Schema = mongoose.Schema;

const CryptoTransactionsSchema = new Schema<ICryptoTransactions>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blockchain: {
      type: String,
      required: true,
      enum: Object.values(BLOCKCHAIN_PROTOCOL_NAME),
      index: true,
    },
    network: {
      type: String,
      required: true,
      enum: Object.values(NETWORK),
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(CRYPTO_TRANSACTION_TYPES),
      index: true,
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
      enum: [...Object.values(VAULTODY_TX_EVENTS), ...Object.values(TRANSACTION_STATUS)],
      default: VAULTODY_TX_EVENTS.TRANSACTION_REQUEST,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    exchangeRate: {
      type: Number,
      required: true,
    },
    exchangedAmount: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
      uppercase: true,
    },
    transactionRequestId: {
      type: String,
    },
    transactionId: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    processingError: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    version: {
      type: Number,
      default: 1,
    },
    currentConfirmations: {
      type: Number,
      default: 0,
    },
    targetConfirmations: {
      type: Number,
    },
  },
  {
    timestamps: true, // Automatically manage `createdAt` and `updatedAt`
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Update timestamps on save
CryptoTransactionsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  if (this.isModified()) {
    this.version += 1;
  }

  next();
});

// Compound indexes for common queries
CryptoTransactionsSchema.index({ userId: 1, blockchain: 1, status: 1 });
CryptoTransactionsSchema.index({ userId: 1, createdAt: -1 });
CryptoTransactionsSchema.index({ blockchain: 1, network: 1, status: 1 });
// Add a unique index on transactionId to prevent duplicates
CryptoTransactionsSchema.index({ transactionId: 1 }, { unique: true });

// Add a pre-save hook to check for duplicates before saving
CryptoTransactionsSchema.pre('save', async function (next) {
  // Only check for duplicates if this is a new document with a transactionId
  if (this.isNew && this.transactionId) {
    const Model = mongoose.model<ICryptoTransactions>('CryptoTransactions');
    const existing = await Model.findOne({ transactionId: this.transactionId });
    if (existing) {
      const error = new Error(`Transaction with ID ${this.transactionId} already exists`);
      return next(error);
    }
  }
  next();
});

// Static method to get user's transactions
CryptoTransactionsSchema.statics.getUserTransactions = async function (userId, filters = {}) {
  const query = { userId, ...filters };
  return this.find(query).sort({ createdAt: -1 }).lean();
};

// Static method to get transaction by txId
CryptoTransactionsSchema.statics.getByTransactionId = async function (transactionId) {
  return this.findOne({ transactionId }).lean();
};

// Static method to get pending deposits
CryptoTransactionsSchema.statics.getPendingDeposits = async function () {
  return this.find({
    type: CRYPTO_TRANSACTION_TYPES.DEPOSIT,
    status: VAULTODY_TX_EVENTS.TRANSACTION_REQUEST,
  }).sort({ createdAt: 1 });
};

// Static method to mark transaction as confirmed
CryptoTransactionsSchema.methods.markCoinConfirmed = async function () {
  this.status = VAULTODY_TX_EVENTS.INCOMING_CONFIRMED_COIN_TX;
  this.updatedAt = new Date();
  return this.save();
};

// Static method to safely find or create a transaction
CryptoTransactionsSchema.statics.findOrCreateTransaction = async function (transactionData) {
  // Only attempt the atomic operation if we have a transactionId
  if (transactionData.transactionId) {
    try {
      // Use findOneAndUpdate with upsert for atomic operation
      const result = await this.findOneAndUpdate(
        { transactionId: transactionData.transactionId },
        { $setOnInsert: { ...transactionData, createdAt: new Date(), updatedAt: new Date() } },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );

      // Determine if it was newly created by checking timestamps
      const justCreated =
        result.createdAt && result.updatedAt && result.createdAt.getTime() === result.updatedAt.getTime();

      return { transaction: result, created: justCreated };
    } catch (error: any) {
      // Handle duplicate key error
      if (error.code === 11000) {
        // Find the existing transaction and return it
        const existingTransaction = await this.findOne({ transactionId: transactionData.transactionId });
        return { transaction: existingTransaction, created: false };
      }
      throw error;
    }
  }

  // If no transactionId, create a new transaction
  const newTransaction = new this(transactionData);
  await newTransaction.save();
  return { transaction: newTransaction, created: true };
};

// Virtual for transaction URL (if needed)
CryptoTransactionsSchema.virtual('explorerUrl').get(function () {
  // Implementation would depend on your supported blockchains
  // Example for Ethereum:
  if (this.blockchain === BLOCKCHAIN_PROTOCOL_NAME.ETHEREUM) {
    const baseUrl = this.network === NETWORK.MAINNET ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
    return `${baseUrl}/tx/${this.transactionId}`;
  }
  return null;
});

const CryptoTransaction = mongoose.model<ICryptoTransactions, ICryptoTransactionsModel>(
  'CryptoTransaction',
  CryptoTransactionsSchema
);

export default CryptoTransaction;
