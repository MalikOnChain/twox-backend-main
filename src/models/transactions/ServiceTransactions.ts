import mongoose from 'mongoose';

import { SERVICE_TRANSACTION_STATUS, SERVICE_TRANSACTION_TYPES } from '../../types/bonus/service';

const { Schema } = mongoose;

// Custom error class for service transactions
export class ServiceTransactionError extends Error {
  code: string;
  details: any;

  constructor(message: string, code = 'SERVICE_TRANSACTION_ERROR', details: any = {}) {
    super(message);
    this.name = 'ServiceTransactionError';
    this.code = code;
    this.details = details;
  }
}

// Validation helper
const validateAmount = {
  validator: (value: number) => Number.isFinite(value) && value >= 0,
  message: 'Amount must be a non-negative finite number',
};

// Schema definition
const serviceTransactionSchema = new Schema<IServiceTransactions>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(SERVICE_TRANSACTION_TYPES),
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      validate: validateAmount,
    },
    userBalance: {
      before: {
        type: Number,
        required: false,
      },
      after: {
        type: Number,
        required: false,
      },
    },
    bonusBalances: {
      before: {
        type: Object,
        required: false,
      },
      after: {
        type: Object,
        required: false,
      },
    },
    cashbackBalances: {
      before: {
        type: Object,
        required: false,
      },
      after: {
        type: Object,
        required: false,
      },
    },
    referBonusBalances: {
      before: {
        type: Object,
        required: false,
      },
      after: {
        type: Object,
        required: false,
      },
    },
    wagerRaceBalances: {
      before: {
        type: Object,
        required: false,
      },
      after: {
        type: Object,
        required: false,
      },
    },
    freeSpinsBalances: {
      before: {
        type: Object,
        required: false,
      },
      after: {
        type: Object,
        required: false,
      },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(SERVICE_TRANSACTION_STATUS),
      default: SERVICE_TRANSACTION_STATUS.PENDING,
      index: true,
    },
    referenceId: { type: Schema.Types.ObjectId, required: true },
    metadata: {
      type: Object,
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

// Indexes
serviceTransactionSchema.index({ createdAt: 1, status: 1 });
serviceTransactionSchema.index({ userId: 1, createdAt: -1 });

// Pre-save middleware for validation
serviceTransactionSchema.pre('save', function (next) {
  // Update version on changes
  if (this.isModified()) {
    this.version += 1;
  }
  next();
});

const ServiceTransaction = mongoose.model<IServiceTransactions>('ServiceTransaction', serviceTransactionSchema);

export default ServiceTransaction;
