import mongoose from 'mongoose';

const { Schema } = mongoose;
const UserFreeSpinBalanceSchema = new Schema<IUserFreeSpinBalance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Only one record per user
      index: true,
    },
    freeSpinBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalValue: {
      type: Number,
      default: 1,
    },
    initialAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    wageringProgress: {
      type: Number,
      default: 0,
      max: 100,
    },
    wageringMultiplier: {
      type: Number,
      default: 1,
      min: 1,
    },
    lockedWinnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    wageringRequirement: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Calculate if wagering rsequirement is met
UserFreeSpinBalanceSchema.methods.isWageringRequirementMet = function () {
  return this.wageredAmount >= this.wageringRequirement;
};

// Calculate remaining wagsering requirement
UserFreeSpinBalanceSchema.methods.getRemainingWageringRequirement = function () {
  return Math.max(0, this.wageringRequirement - this.wageredAmount);
};

UserFreeSpinBalanceSchema.methods.updateWageringProgress = function (totalWagerAmount: number) {
  const requirementWageringAmount = this.wageringMultiplier * this.initialAmount;

  // If there's no requirement amount, progress should be 0
  const wageringProgress = requirementWageringAmount > 0 ? (totalWagerAmount / requirementWageringAmount) * 100 : 0;

  this.wageringProgress = Math.min(wageringProgress, 100);
  return this;
};

const UserFreeSpinBalance = mongoose.model<IUserFreeSpinBalance>('UserFreeSpinBalance', UserFreeSpinBalanceSchema);

export default UserFreeSpinBalance;
