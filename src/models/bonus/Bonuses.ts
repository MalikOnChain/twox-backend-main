// src/models/v2/bonus/Bonuses.js
import mongoose from 'mongoose';

import { BonusStatus, BonusType } from '../../types/bonus/bonus';

const BonusSchema = new mongoose.Schema<IBonus>(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true,
      comment: 'Display name of the bonus',
    },
    code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      comment: 'Optional bonus code for manual claims',
    },

    description: {
      type: String,
      required: true,
      comment: 'Detailed description of the bonus',
    },

    // Bonus Type and Category
    type: {
      type: String,
      enum: Object.values(BonusType),
      required: true,
      index: true,
      comment: 'Type of bonus (welcome, deposit, daily, etc.)',
    },

    category: {
      type: String,
      enum: ['standard', 'vip', 'promotional', 'seasonal'],
      default: 'standard',
      comment: 'Category for grouping bonuses',
    },

    status: {
      type: String,
      enum: Object.values(BonusStatus),
      default: BonusStatus.DRAFT,
      index: true,
      comment: 'Current status of the bonus',
    },

    isVisible: {
      type: Boolean,
      default: true,
      comment: 'Whether bonus is visible to users',
    },

    // Default Reward Configuration
    defaultReward: {
      cash: {
        amount: {
          type: Number,
          min: 0,
          comment: 'Fixed cash bonus amount',
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
          comment: 'Cash bonus percentage',
        },
        minAmount: {
          type: Number,
          min: 0,
          comment: 'Minimum cash bonus amount',
        },
        maxAmount: {
          type: Number,
          min: 0,
          comment: 'Maximum cash bonus amount',
        },
      },
      freeSpins: {
        amount: {
          type: Number,
          min: 0,
          comment: 'Fixed number of free spins',
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
          comment: 'Free spins percentage',
        },
        minAmount: {
          type: Number,
          min: 0,
          comment: 'Minimum number of free spins',
        },
        maxAmount: {
          type: Number,
          min: 0,
          comment: 'Maximum number of free spins',
        },
      },
      bonus: {
        amount: {
          type: Number,
          min: 0,
          comment: 'Fixed bonus amount',
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100,
          comment: 'Bonus percentage',
        },
        minAmount: {
          type: Number,
          min: 0,
          comment: 'Minimum bonus amount',
        },
        maxAmount: {
          type: Number,
          min: 0,
          comment: 'Maximum bonus amount',
        },
      },
      special: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
        comment: 'Special reward configuration',
      },
    },

    // Wagering Requirements
    defaultWageringMultiplier: {
      type: Number,
      default: 30,
      min: 0,
      comment: 'Default wagering requirement multiplier',
    },

    // Validity Period
    validFrom: {
      type: Date,
      required: true,
      comment: 'When the bonus becomes active',
    },
    validTo: {
      type: Date,
      comment: 'When the bonus expires (null for permanent)',
    },

    // Claim Restrictions
    maxClaims: {
      type: Number,
      comment: 'Maximum number of times this bonus can be claimed (null for unlimited)',
    },
    claimsCount: {
      type: Number,
      default: 0,
      comment: 'Current number of claims',
    },
    maxClaimsPerUser: {
      type: Number,
      default: 1,
      comment: 'Maximum claims per user',
    },

    // Priority and Ordering
    priority: {
      type: Number,
      default: 0,
      comment: 'Priority for bonus display (higher = more priority)',
    },
    displayOrder: {
      type: Number,
      default: 0,
      comment: 'Order for displaying bonuses',
    },

    // Media and Presentation
    imageUrl: {
      type: String,
      comment: 'URL for bonus image/banner',
    },
    iconUrl: {
      type: String,
      comment: 'URL for bonus icon',
    },
    termsAndConditions: {
      type: String,
      comment: 'Detailed terms and conditions',
    },

    // Metadata for complex bonuses
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      comment: 'Additional configuration data for complex bonus types',
    },

    // Audit Trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      comment: 'Admin who created this bonus',
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      comment: 'Admin who last modified this bonus',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
BonusSchema.index({ type: 1, status: 1 });
BonusSchema.index({ validFrom: 1, validTo: 1 });
BonusSchema.index({ status: 1, isVisible: 1, priority: -1 });
BonusSchema.index({ status: 1, isVisible: 1 });
// `code` uses unique+sparse on the path — no separate index here (avoids duplicate index warning).

// Virtual for checking if bonus is expired
BonusSchema.virtual('isExpired').get(function () {
  return this.validTo && new Date() > this.validTo;
});

// Virtual for checking if bonus is active
BonusSchema.virtual('isActive').get(function () {
  const now = new Date();
  return this.status === BonusStatus.ACTIVE && now >= this.validFrom && (!this.validTo || now <= this.validTo);
});

// Methods
BonusSchema.methods.canBeClaimed = function () {
  return this.isActive && (!this.maxClaims || this.claimsCount < this.maxClaims);
};

BonusSchema.methods.incrementClaimsCount = async function () {
  this.claimsCount += 1;
  return this.save();
};

export default mongoose.model<IBonus>('Bonuses', BonusSchema);
