import mongoose from 'mongoose';

import { GAME_CATEGORIES, GAME_TRANSACTION_STATUS, TRANSACTION_TYPES } from '@/types/game/game';

const { Schema } = mongoose;

// Custom error class for game transactions
export class GameTransactionError extends Error {
  code: string;
  details: any;

  constructor(message: string, code = 'GAME_TRANSACTION_ERROR', details: any = {}) {
    super(message);
    this.name = 'GameTransactionError';
    this.code = code;
    this.details = details;
  }
}

// Validation helper
const validateAmount = {
  validator: (value: number) => Number.isFinite(value) && value >= 0,
  message: 'Amount must be a non-negative finite number',
};

const gameSchema = new Schema(
  {
    id: { type: String, required: true },
  },
  { strict: false } // ✅ Allows additional fields dynamically
);

// Schema definition
const gameTransactionSchema = new Schema<IGameTransactions>(
  {
    category: {
      type: String,
      enum: Object.values(GAME_CATEGORIES), // ✅ Only valid categories allowed
      required: true, // ✅ Always required
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    betAmount: {
      type: Number,
      required: true,
      validate: validateAmount,
    },
    winAmount: {
      type: Number,
      default: 0,
      validate: validateAmount,
    },
    userBalance: {
      before: {
        type: Number,
      },
      after: {
        type: Number,
      },
    },
    bonusBalances: {
      before: {
        type: Object,
      },
      after: {
        type: Object,
      },
    },
    cashbackBalances: {
      before: {
        type: Object,
      },
      after: {
        type: Object,
      },
    },
    referBonusBalances: {
      before: {
        type: Object,
      },
      after: {
        type: Object,
      },
    },
    wagerRaceBalances: {
      before: {
        type: Object,
      },
      after: {
        type: Object,
      },
    },
    freeSpinBalances: {
      before: {
        type: Object,
      },
      after: {
        type: Object,
      },
    },
    betDetails: {
      type: Object,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(TRANSACTION_TYPES),
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(GAME_TRANSACTION_STATUS),
      default: GAME_TRANSACTION_STATUS.PENDING,
      index: true,
    },
    game: {
      type: gameSchema,
      required: true,
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
    wagerRaces: {
      type: [Schema.Types.ObjectId],
      ref: 'WagerRace',
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
gameTransactionSchema.index({ 'game.id': 1 });
gameTransactionSchema.index({ createdAt: 1, status: 1 });
gameTransactionSchema.index({ userId: 1, createdAt: -1 });

// Pre-save middleware for validation
gameTransactionSchema.pre('save', function (next) {
  // Update version on changes
  if (this.isModified()) {
    this.version += 1;
  }
  next();
});

// Virtual for net amount (win - bet)
gameTransactionSchema.virtual('netAmount').get(function () {
  return this.winAmount - this.betAmount;
});

const GameTransaction = mongoose.model<IGameTransactions>('GameTransaction', gameTransactionSchema);

export default GameTransaction;
