import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserWagerRaceBalanceSchema = new Schema<IUserWagerRaceBalance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Only one record per user
      index: true,
    },
    wagerRaceBalance: {
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
    wageringRequirement: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'forfeited'],
      default: 'active',
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    lockedWinnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    raceHistory: [
      {
        raceId: {
          type: Schema.Types.ObjectId,
          ref: 'WagerRace',
        },
        position: Number,
        prizeAmount: Number,
        wageredAmount: Number,
        completedAt: Date,
      },
    ],
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
UserWagerRaceBalanceSchema.methods.isWageringRequirementMet = function () {
  return this.wageredAmount >= this.wageringRequirement;
};

// Calculate remaining wagering requirement
UserWagerRaceBalanceSchema.methods.getRemainingWageringRequirement = function () {
  return Math.max(0, this.wageringRequirement - this.wageredAmount);
};

// Update wagered amount with transaction
UserWagerRaceBalanceSchema.methods.updateWageringProgress = function (totalWagerAmount: number) {
  const requirementWageringAmount = this.wageringMultiplier * this.initialAmount;

  const wageringProgress = requirementWageringAmount > 0 ? (totalWagerAmount / requirementWageringAmount) * 100 : 0;

  this.wageringProgress = Math.min(wageringProgress, 100);
  return this;
};

// Add wager race prize with transaction
UserWagerRaceBalanceSchema.methods.addWagerRacePrize = async function (
  raceId: string,
  position: number,
  prizeAmount: number,
  wageredAmount: number,
  session = null
) {
  if (prizeAmount <= 0) {
    return this;
  }

  const session_ = session || (await mongoose.startSession());
  let localTransaction = false;

  if (!session) {
    session_.startTransaction();
    localTransaction = true;
  }

  try {
    // Add to race history
    const raceHistoryEntry = {
      raceId,
      position,
      prizeAmount,
      wageredAmount,
      completedAt: new Date(),
    };

    // Use findOneAndUpdate for atomic operation
    const Model = mongoose.model<IUserWagerRaceBalance>('UserWagerRaceBalance');
    const updated = await Model.findOneAndUpdate(
      { _id: this._id },
      {
        $inc: {
          wagerRaceBalance: prizeAmount,
          initialAmount: prizeAmount,
        },
        $push: { raceHistory: raceHistoryEntry },
        $set: {
          status: 'active',
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

// Add wager race bonus amount with transaction
UserWagerRaceBalanceSchema.methods.addWagerRaceBonus = async function (
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
    const Model = mongoose.model<IUserWagerRaceBalance>('UserWagerRaceBalance');
    const updated = await Model.findOneAndUpdate(
      { _id: this._id },
      {
        $inc: {
          wagerRaceBalance: amount,
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

// Static method to get or create user's wager race balance with transaction
UserWagerRaceBalanceSchema.statics.getOrCreate = async function (userId, session = null) {
  const session_ = session || (await mongoose.startSession());
  let localTransaction = false;

  if (!session) {
    session_.startTransaction();
    localTransaction = true;
  }

  try {
    let wagerRaceBalance = await this.findOne({ userId }).session(session_);

    if (!wagerRaceBalance) {
      wagerRaceBalance = new this({
        userId,
        wagerRaceBalance: 0,
        initialAmount: 0,
        wageredAmount: 0,
        wageringRequirement: 0,
        status: 'active',
      });
      await wagerRaceBalance.save({ session: session_ });
    }

    if (localTransaction) {
      await session_.commitTransaction();
    }

    return wagerRaceBalance;
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

// Static method to get total wager race balance for a user
UserWagerRaceBalanceSchema.statics.getUserWagerRaceBalance = async function (userId) {
  const result = await this.findOne({ userId });
  return result ? result.wagerRaceBalance : 0;
};

// Static method to get user's race history
UserWagerRaceBalanceSchema.statics.getUserRaceHistory = async function (userId, limit = 10) {
  const result = await this.findOne({ userId })
    .select('raceHistory')
    .populate('raceHistory.raceId', 'title period prize')
    .sort({ 'raceHistory.completedAt': -1 })
    .limit(limit);
  return result ? result.raceHistory : [];
};

// Static method to get top performers in a race
UserWagerRaceBalanceSchema.statics.getTopPerformers = async function (raceId, limit = 10) {
  return await this.find({
    'raceHistory.raceId': raceId,
  })
    .select('userId raceHistory')
    .populate('userId', 'username avatar')
    .sort({ 'raceHistory.wageredAmount': -1 })
    .limit(limit);
};

const UserWagerRaceBalance = mongoose.model<IUserWagerRaceBalance, IUserWagerRaceBalanceModel>(
  'UserWagerRaceBalance',
  UserWagerRaceBalanceSchema
);

export default UserWagerRaceBalance;
