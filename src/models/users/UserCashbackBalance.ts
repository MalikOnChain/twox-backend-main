import mongoose from 'mongoose';

const { Schema } = mongoose;

const UserCashbackBalanceSchema = new Schema<IUserCashbackBalance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Only one record per user
      index: true,
    },
    cashbackBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedWinnings: {
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
UserCashbackBalanceSchema.methods.isWageringRequirementMet = function () {
  return this.wageredAmount >= this.wageringRequirement;
};

// Calculate remaining wagering requirement
UserCashbackBalanceSchema.methods.getRemainingWageringRequirement = function () {
  return Math.max(0, this.wageringRequirement - this.wageredAmount);
};

UserCashbackBalanceSchema.methods.updateWageringProgress = function (totalWagerAmount: number) {
  const requirementWageringAmount = this.wageringMultiplier * this.initialAmount;

  // If there's no requirement amount, progress should be 0
  const wageringProgress = requirementWageringAmount > 0 ? (totalWagerAmount / requirementWageringAmount) * 100 : 0;

  this.wageringProgress = Math.min(wageringProgress, 100);
  return this;
};

// Add cashback amount with transaction
UserCashbackBalanceSchema.methods.addCashback = async function (amount: number, session = null) {
  if (amount <= 0) {
    return this;
  }
  // Calculate additional wagering requirement
  const additionalRequirement = amount * this.wageringMultiplier;

  // Use findOneAndUpdate for atomic operation
  const Model = mongoose.model<IUserCashbackBalance>('UserCashbackBalance');
  const updated = await Model.findOneAndUpdate(
    { _id: this._id },
    {
      $inc: {
        cashbackBalance: amount,
        initialAmount: amount,
        wageringRequirement: additionalRequirement,
      },
      $set: {
        status: 'active',
        lastUpdatedAt: new Date(),
      },
    },
    { session, new: true }
  );

  return updated;
};

// Static method to get or create user's cashback balance with transaction
UserCashbackBalanceSchema.statics.getOrCreate = async function (userId: string, session = null) {
  let cashbackBalance = await this.findOne({ userId }).session(session);

  if (!cashbackBalance) {
    cashbackBalance = new this({
      userId,
      cashbackBalance: 0,
      initialAmount: 0,
      wageredAmount: 0,
      wageringRequirement: 0,
      status: 'active',
    });
    await cashbackBalance.save({ session });
  }

  return cashbackBalance;
};

// Static method to get total cashback balance for a user
UserCashbackBalanceSchema.statics.getUserCashbackBalance = async function (userId: string) {
  const result = await this.findOne({ userId });
  return result ? result.cashbackBalance : 0;
};

const UserCashbackBalance = mongoose.model<IUserCashbackBalance, IUserCashbackBalanceModel>(
  'UserCashbackBalance',
  UserCashbackBalanceSchema
);

export default UserCashbackBalance;
