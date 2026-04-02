import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserReferBonusBalanceSchema = new Schema<IUserReferBonusBalance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Only one record per user
      index: true,
    },
    referBonusBalance: {
      type: Number,
      default: 0,
      min: 0,
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
    rewardHistory: {
      type: Array,
      default: [],
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

// Calculate if wagering requirement is met
UserReferBonusBalanceSchema.methods.isWageringRequirementMet = function () {
  return this.wageredAmount >= this.wageringRequirement;
};

// Calculate remaining wagering requirement
UserReferBonusBalanceSchema.methods.getRemainingWageringRequirement = function () {
  return Math.max(0, this.wageringRequirement - this.wageredAmount);
};

// Update wagered amount with transaction
UserReferBonusBalanceSchema.methods.updateWageringProgress = function (totalWagerAmount: number) {
  const requirementWageringAmount = this.wageringMultiplier * this.initialAmount;

  const wageringProgress = requirementWageringAmount > 0 ? (totalWagerAmount / requirementWageringAmount) * 100 : 0;

  this.wageringProgress = Math.min(wageringProgress, 100);
  return this;
};

// Add refer bonus amount with transaction
UserReferBonusBalanceSchema.methods.addReferBonus = async function (
  amount: number,
  wageringMultiplier = 1,
  session = null
) {
  if (amount <= 0) {
    return this;
  }

  const session_ = session || (await mongoose.startSession());
  let localTransaction = false;

  if (!session) {
    session_.startTransaction();
    localTransaction = true;
  }

  try {
    // Calculate additional wagering requirement
    const additionalRequirement = amount * wageringMultiplier;

    // Use findOneAndUpdate for atomic operation
    const Model = mongoose.model<IUserReferBonusBalance>('UserReferBonusBalance');
    const updated = await Model.findOneAndUpdate(
      { _id: this._id },
      {
        $inc: {
          referBonusBalance: amount,
          initialAmount: amount,
          wageringRequirement: additionalRequirement,
        },
        $set: {
          status: 'active',
          wageringMultiplier: wageringMultiplier,
          lastUpdatedAt: new Date(),
        },
      },
      { session: session_, new: true }
    );

    if (localTransaction) {
      await session_.commitTransaction();
    }

    return updated;
  } catch (error) {
    if (localTransaction) {
      await session_.abortTransaction();
    }
    throw error;
  } finally {
    if (localTransaction) {
      session_.endSession();
    }
  }
};

// Static method to get or create user's refer bonus balance with transaction
UserReferBonusBalanceSchema.statics.getOrCreate = async function (userId, session = null) {
  const session_ = session || (await mongoose.startSession());
  let localTransaction = false;

  if (!session) {
    session_.startTransaction();
    localTransaction = true;
  }

  try {
    let referBonusBalance = await this.findOne({ userId }).session(session_);

    if (!referBonusBalance) {
      referBonusBalance = new this({
        userId,
        referBonusBalance: 0,
        initialAmount: 0,
        wageredAmount: 0,
        wageringRequirement: 0,
        status: 'active',
      });
      await referBonusBalance.save({ session: session_ });
    }

    if (localTransaction) {
      await session_.commitTransaction();
    }

    return referBonusBalance;
  } catch (error) {
    if (localTransaction) {
      await session_.abortTransaction();
    }
    throw error;
  } finally {
    if (localTransaction) {
      session_.endSession();
    }
  }
};

// Static method to get total refer bonus balance for a user
UserReferBonusBalanceSchema.statics.getUserReferBonusBalance = async function (userId: string) {
  const result = await this.findOne({ userId });
  return result ? result.referBonusBalance : 0;
};

const UserReferBonusBalance = mongoose.model<IUserReferBonusBalance, IUserReferBonusBalanceModel>(
  'UserReferBonusBalance',
  UserReferBonusBalanceSchema
);

export default UserReferBonusBalance;
