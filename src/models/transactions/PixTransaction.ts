import mongoose from 'mongoose';
const { Schema } = mongoose;

const CURRENCIES = ['BRL', 'USD', 'EUR'];

const TRANSACTION_TYPES = {
  TRANSACTION: 'transaction',
  WITHDRAWAL: 'withdrawal',
  DEPOSIT: 'deposit',
};

const TRANSACTION_METHODS = {
  PIX: 'pix',
  PAYOUT_PIX: 'payout_pix',
  NOWPAYMENTS_CRYPTO: 'nowpayments_crypto',
  COINSBUY_CRYPTO: 'coinsbuy_crypto',
};

const TRANSACTION_STATUSES = {
  CREATED: 0,
  PAID: 1,
  REJECTED: 2,
  EXPIRED: 3,
  MANUALLY_REJECTED: 3,
  REFUNDED: 4,
  WAITING: 5,
};

// Validation helper
const validateAmount = {
  validator: (value: number) => Number.isFinite(value) && value >= 0,
  message: 'Amount must be a non-negative finite number',
};

const pixTransactionSchema = new Schema<IPixTransaction>(
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
    currency: {
      type: String,
      required: true,
      enum: CURRENCIES,
      default: CURRENCIES[0],
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(TRANSACTION_TYPES),
    },
    method: {
      type: String,
      required: true,
      enum: Object.values(TRANSACTION_METHODS),
    },
    due: {
      type: Date,
      default: null,
    },
    status: {
      type: Number,
      required: true,
      enum: Object.values(TRANSACTION_STATUSES),
      default: TRANSACTION_STATUSES.CREATED,
      index: true,
    },
    pixKey: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for common queries
pixTransactionSchema.index({ userId: 1, type: 1, status: 1, createdAt: -1 });
pixTransactionSchema.index({ userId: 1, createdAt: -1 });
pixTransactionSchema.index({ status: 1, type: 1 });

const PixTransaction = mongoose.model<IPixTransaction>('PixTransaction', pixTransactionSchema);

export { CURRENCIES, TRANSACTION_METHODS, TRANSACTION_STATUSES, TRANSACTION_TYPES };
export default PixTransaction;
