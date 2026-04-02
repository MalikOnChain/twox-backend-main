// src/models/v2/users/UserBonusBalance.js - Updated with better integration
import mongoose from 'mongoose';

import { BonusType } from '@/types/bonus/bonus';

const UserBonusBalanceSchema = new mongoose.Schema<IUserBonusBalance>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    bonusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bonuses',
      required: true,
    },

    // The current bonus balance that can be used to place bets
    bonusBalance: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },

    // Winnings from bonus bets that are locked until wagering requirements are met
    lockedWinnings: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },

    // The initial bonus amount (used to calculate wagering requirements)
    initialAmount: {
      type: Number,
      default: 0,
      required: true,
      min: 0,
    },

    // Track how much has been wagered towards the wagering requirement
    wageringProgress: {
      type: Number,
      default: 0,
      min: 0,
    },

    // The wagering multiplier for this specific bonus
    wageringMultiplier: {
      type: Number,
      default: 30, // 30x is a common industry standard
      min: 0,
    },

    // When the bonus was claimed (null if not claimed yet)
    claimedAt: {
      type: Date,
      default: null,
    },

    // Status of the bonus
    status: {
      type: String,
      enum: ['active', 'completed', 'expired', 'forfeited'],
      default: 'active',
      index: true,
    },

    // Type of bonus (for reference)
    bonusType: {
      type: String,
      enum: Object.values(BonusType),
      required: true,
    },

    // Expiry date for the bonus
    expiresAt: {
      type: Date,
      default: function () {
        // Default to 30 days from creation
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      },
      index: true,
    },

    // Metadata for additional information
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Version for optimistic locking
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

// Indexes for performance
UserBonusBalanceSchema.index({ userId: 1, status: 1 });
UserBonusBalanceSchema.index({ userId: 1, bonusId: 1 }, { unique: true });
UserBonusBalanceSchema.index({ status: 1, expiresAt: 1 });
UserBonusBalanceSchema.index({ claimedAt: -1 });

// Add indexes for common queries
UserBonusBalanceSchema.index({ userId: 1, bonusId: 1 });
UserBonusBalanceSchema.index({ userId: 1, status: 1 });
UserBonusBalanceSchema.index({ bonusId: 1, status: 1 });
UserBonusBalanceSchema.index({ claimedAt: 1 });

// Virtual method to check if bonus has been claimed
UserBonusBalanceSchema.virtual('isClaimed').get(function () {
  return this.claimedAt !== null;
});

// Virtual method to check if wagering requirements are met
UserBonusBalanceSchema.virtual('wageringCompleted').get(function () {
  const requiredWagering = this.initialAmount * this.wageringMultiplier;
  return this.wageringProgress >= requiredWagering;
});

// Virtual method to get the remaining wagering amount
UserBonusBalanceSchema.virtual('remainingWagering').get(function () {
  const requiredWagering = this.initialAmount * this.wageringMultiplier;
  return Math.max(0, requiredWagering - this.wageringProgress);
});

// Virtual to check if bonus is expired
UserBonusBalanceSchema.virtual('isExpired').get(function () {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Virtual to get wagering progress percentage
UserBonusBalanceSchema.virtual('wageringProgressPercentage').get(function () {
  const requiredWagering = this.initialAmount * this.wageringMultiplier;
  if (requiredWagering === 0) return 100;
  return Math.min(100, (this.wageringProgress / requiredWagering) * 100);
});

// Pre-save middleware
UserBonusBalanceSchema.pre('save', function (next) {
  // Update version for optimistic locking
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }

  // Auto-expire if past expiry date
  if (this.isExpired && this.status === 'active') {
    this.status = 'expired';
  }

  // Auto-complete if wagering is done and no remaining balance
  if (this.wageringCompleted && this.bonusBalance === 0 && this.status === 'active') {
    this.status = 'completed';
  }

  // Ensure claimedAt is set for active bonuses
  if (this.status === 'active' && !this.claimedAt) {
    this.claimedAt = new Date();
  }

  next();
});

// Method to update wagering progress
UserBonusBalanceSchema.methods.updateWageringProgress = function (totalWagerAmount: number) {
  const requirementWageringAmount = this.wageringMultiplier * this.initialAmount;

  if (requirementWageringAmount > 0) {
    // Calculate percentage instead of amount
    const progressPercentage = (totalWagerAmount / requirementWageringAmount) * 100;
    this.wageringProgress = Math.min(progressPercentage, 100);
  } else {
    this.wageringProgress = 0; // If no requirement, consider it complete
  }

  return this;
};

// Method to mark bonus as claimed
UserBonusBalanceSchema.methods.claim = function () {
  if (!this.claimedAt) {
    this.claimedAt = new Date();
    this.status = 'active';
  }
  return this;
};

// Method to forfeit bonus
UserBonusBalanceSchema.methods.forfeit = async function (reason = 'User forfeited') {
  this.status = 'forfeited';
  this.bonusBalance = 0;
  this.lockedWinnings = 0;
  this.metadata.forfeitReason = reason;
  this.metadata.forfeitedAt = new Date();
  return this.save();
};

// Method to complete bonus (unlock winnings)
UserBonusBalanceSchema.methods.complete = async function () {
  if (this.wageringCompleted) {
    this.status = 'completed';
    // Locked winnings would be transferred to real balance by the balance manager
    return this.save();
  }
  throw new Error('Wagering requirements not met');
};

// Static method to find active bonuses for user
UserBonusBalanceSchema.statics.findActiveBonuses = function (userId) {
  return this.find({
    userId,
    status: 'active',
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).sort({ claimedAt: 1 }); // FIFO order
};

// Static method to find bonuses requiring wagering completion check
UserBonusBalanceSchema.statics.findBonusesForWageringCheck = function (userId) {
  return this.find({
    userId,
    status: 'active',
    lockedWinnings: { $gt: 0 },
  });
};

// Static method to expire old bonuses
UserBonusBalanceSchema.statics.expireOldBonuses = async function () {
  const result = await this.updateMany(
    {
      status: 'active',
      expiresAt: { $lt: new Date() },
    },
    {
      $set: {
        status: 'expired',
        bonusBalance: 0,
        lockedWinnings: 0,
      },
    }
  );
  return result;
};

// Static method to get user's total active bonus balance
UserBonusBalanceSchema.statics.getTotalActiveBonusBalance = async function (userId) {
  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: 'active',
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      },
    },
    {
      $group: {
        _id: null,
        totalBonusBalance: { $sum: '$bonusBalance' },
        totalLockedWinnings: { $sum: '$lockedWinnings' },
      },
    },
  ]);

  return result.length > 0 ? result[0] : { totalBonusBalance: 0, totalLockedWinnings: 0 };
};

// Static method to get bonus statistics for user
UserBonusBalanceSchema.statics.getUserBonusStats = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$initialAmount' },
      },
    },
  ]);

  const result = {
    active: { count: 0, totalAmount: 0 },
    completed: { count: 0, totalAmount: 0 },
    expired: { count: 0, totalAmount: 0 },
    forfeited: { count: 0, totalAmount: 0 },
  };

  stats.forEach((stat: any) => {
    if (result[stat._id as keyof typeof result]) {
      result[stat._id as keyof typeof result] = {
        count: stat.count,
        totalAmount: stat.totalAmount,
      };
    }
  });

  return result;
};

const UserBonusBalance = mongoose.model<IUserBonusBalance, IUserBonusBalanceModel>(
  'UserBonusBalance',
  UserBonusBalanceSchema
);

export default UserBonusBalance;
