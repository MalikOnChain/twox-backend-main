import mongoose from 'mongoose';

const { Schema } = mongoose;

const CashbackSchema = new Schema<ICashback>({
  name: {
    type: String,
    required: true,
    unique: true,
    comment: 'The name of the cashback',
  },
  type: {
    type: Number,
    default: 0,
    required: true,
    enum: [0, 1, 2, 3],
    comment: '0:default, 1: time based boost, 2: game-specific multiplier, 3: win streak',
  },
  tiers: [
    {
      tierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VipTier',
        required: true,
        comment: 'The id of the tier',
      },
      tierName: {
        type: String,
        required: true,
        comment: 'The name of the tier',
      },
      tierLevel: {
        type: String,
        required: true,
        comment: 'The level of the tier',
      },
      percentage: {
        type: Number,
        default: 0,
        required: false,
        comment: 'The percentage of cashback for the tier',
      },
      cap: {
        day: {
          type: Number,
          default: 0,
          required: true,
          comment: 'The daily cap for the player to be eligible for cashback',
        },
        week: {
          type: Number,
          default: 0,
          required: true,
          comment: 'The weekly cap for the player to be eligible for cashback',
        },
        month: {
          type: Number,
          default: 0,
          required: true,
          comment: 'The monthly cap for the player to be eligible for cashback',
        },
      },
      minWagering: {
        type: Number,
        default: 0,
        required: true,
        comment: 'The minimum wagering for the player to be eligible for cashback',
      },
    },
  ],
  claimFrequency: {
    mode: {
      type: String,
      default: 'instant',
      required: true,
      enum: ['instant', 'daily', 'weekly', 'monthly'],
      comment: 'The frequency of the player to be eligible for cashback',
    },
    cooldown: {
      type: Number,
      default: 0,
      required: false,
      comment: 'The cooldown for the player to be eligible for cashback',
    },
  },
  default: {
    enabled: {
      type: Boolean,
      default: false,
      comment: 'Whether default cashback is enabled for this cashback',
    },
    defaultPercentage: {
      type: Number,
      default: 0,
      required: true,
      comment: 'The percentage of cashback for the default cashback',
    },
  },
  timeBoost: {
    enabled: {
      type: Boolean,
      default: false,
      comment: 'Whether time boost is enabled for this cashback',
    },
    from: {
      type: Date,
      default: null,
      required: false,
      comment: 'The start time of the time boost',
    },
    to: {
      type: Date,
      default: null,
      required: false,
      comment: 'The end time of the time boost',
    },
    allowedDays: {
      type: [Number],
      enum: [0, 1, 2, 3, 4, 5, 6],
      default: [],
      comment: 'The days of the week (0-6, where 0 is Sunday)',
    },
    defaultPercentage: {
      type: Number,
      default: 0,
      required: true,
      comment: 'The percentage of cashback for the time boost',
    },
  },
  gameSpecific: {
    enabled: {
      type: Boolean,
      default: false,
      comment: 'Whether game-specific multipliers are enabled',
    },
    multipliers: [
      {
        gameType: {
          type: String,
          required: true,
          comment: 'The game type identifier',
        },
        defaultPercentage: {
          type: Number,
          required: true,
          default: 0,
          comment: 'The percentage of cashback for this game type',
        },
      },
    ],
  },
  status: {
    type: Number,
    default: 1,
    required: true,
    enum: [0, 1],
    comment: '0: inactive, 1: active',
  },
  wagerMultiplier: {
    type: Number,
    default: 5,
    required: true,
    comment: 'The multiplier for the wager',
  },
});

// Add methods to the schema
CashbackSchema.methods.isTimeBoostActive = function () {
  if (!this.timeBoost.enabled) return false;

  const now = new Date();
  const from = this.timeBoost.from ? new Date(this.timeBoost.from) : null;

  if (!from) return false;

  const to = this.timeBoost.to ? new Date(this.timeBoost.to) : now;

  if (now < from || now > to) return false;

  if (this.timeBoost.allowedDays && this.timeBoost.allowedDays.length > 0) {
    const currentDay = now.getDay();
    const isDayMatch = this.timeBoost.allowedDays.includes(currentDay);
    if (!isDayMatch) return false;
  }

  return true;
};

CashbackSchema.methods.getCurrentTimeBoostMultiplier = function ({
  tierName,
  tierLevel,
  wageringAmount,
}: {
  tierName: string;
  tierLevel: string;
  wageringAmount: number;
}) {
  if (!this.isTimeBoostActive()) return 0;

  const tier = this.tiers.find((t: any) => t.tierName === tierName && t.tierLevel === tierLevel);

  if (!tier) {
    const defaultMiniumWageringAmount = 10;
    if (wageringAmount < defaultMiniumWageringAmount) return 0;

    if (this.timeBoost.defaultPercentage && this.timeBoost.defaultPercentage > 0) {
      return this.timeBoost.defaultPercentage / 100;
    }

    return 0;
  }

  if (tier.minWagering && wageringAmount < tier.minWagering) return 0;

  if (tier.percentage && tier.percentage > 0) return tier.percentage / 100;

  return this.timeBoost.defaultPercentage / 100;
};

CashbackSchema.methods.getGameMultiplier = function ({
  gameType,
  tierName,
  tierLevel,
  wageringAmount,
}: {
  gameType: string;
  tierName: string;
  tierLevel: string;
  wageringAmount: number;
}) {
  if (!this.gameSpecific.enabled) return 0;

  const gameConfig = this.gameSpecific.multipliers.find((m: any) => m.gameType === gameType);

  if (!gameConfig) return 0;

  const tier = this.tiers.find((t: any) => t.tierName === tierName && t.tierLevel === tierLevel);

  if (!tier) {
    if (gameConfig && gameConfig.defaultPercentage && gameConfig.defaultPercentage > 0) {
      const defaultMiniumWageringAmount = 10;
      if (wageringAmount < defaultMiniumWageringAmount) return 0;

      return gameConfig.defaultPercentage / 100;
    }

    return 0;
  }

  if (tier.minWagering && wageringAmount < tier.minWagering) return 0;

  if (tier && tier.percentage && tier.percentage > 0) return tier.percentage / 100;

  return gameConfig.defaultPercentage / 100;
};

CashbackSchema.methods.getDefaultMultiplier = function ({
  tierName,
  tierLevel,
  wageringAmount,
}: {
  tierName: string;
  tierLevel: string;
  wageringAmount: number;
}) {
  if (!this.default.enabled) return 0;

  const tier = this.tiers.find((t: any) => t.tierName === tierName && t.tierLevel === tierLevel);

  if (!tier) {
    const defaultMiniumWageringAmount = 10;
    if (wageringAmount < defaultMiniumWageringAmount) return 0;

    if (this.default.defaultPercentage && this.default.defaultPercentage > 0) {
      return this.default.defaultPercentage / 100;
    }

    return 0;
  }

  if (tier.minWagering && wageringAmount < tier.minWagering) return 0;

  if (tier.percentage && tier.percentage > 0) return tier.percentage / 100;

  return this.default.defaultPercentage / 100;
};

CashbackSchema.methods.getCapAmount = function ({
  tierName,
  tierLevel,
  type,
}: {
  tierName: string;
  tierLevel: string;
  type: 'day' | 'week' | 'month';
}) {
  const tier = this.tiers.find((t: any) => t.tierName === tierName && t.tierLevel === tierLevel);

  if (!tier) return 0;

  if (type === 'day') return tier.cap.day;
  if (type === 'week') return tier.cap.week;
  if (type === 'month') return tier.cap.month;

  return tier.cap;
};

const Cashback = mongoose.model<ICashback>('Cashback', CashbackSchema);

export default Cashback;
