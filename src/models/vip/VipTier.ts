import mongoose from 'mongoose';

const vipTierLevelSchema = new mongoose.Schema<IVipTierLevel>({
  level: {
    type: Number,
    required: true,
  },
  minXP: {
    type: Number,
    required: true,
  },
  icon: {
    type: String,
    required: true,
    comment: 'The icon for the VIP tier',
  },
  name: {
    type: String,
    required: true,
    comment: 'The name of the VIP tier',
  },
});

const vipTierSchema = new mongoose.Schema<IVipTier>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      comment: 'The name of the VIP tier',
    },
    icon: {
      type: String,
      required: true,
      comment: 'The icon for the VIP tier',
    },
    levels: {
      type: [vipTierLevelSchema],
      required: true,
    },
    downgradePeriod: {
      type: Number,
      required: false,
      default: 0,
      comment: 'The period in days for which the player can be downgraded',
    },
  },
  {
    timestamps: true,
  }
);

const VipTier = mongoose.model<IVipTier>('VipTiers', vipTierSchema);

export default VipTier;
