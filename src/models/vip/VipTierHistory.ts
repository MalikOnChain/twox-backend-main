import mongoose from 'mongoose';

const vipTierHistorySchema = new mongoose.Schema<IVipTierHistory>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    history: [
      {
        tier: {
          type: String,
          required: true,
        },
        achievedAt: {
          type: Date,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

vipTierHistorySchema.statics.addTierHistory = async function (userId, tier) {
  const history = await this.findOne({ userId });
  if (!history) {
    await this.create({ userId, history: [{ tier, achievedAt: new Date() }] });
  } else {
    history.history.push({ tier, achievedAt: new Date() });
    await history.save();
  }
};

const VipTierHistory = mongoose.model<IVipTierHistory, IVipTierHistoryModel>('VipTierHistory', vipTierHistorySchema);

export default VipTierHistory;
