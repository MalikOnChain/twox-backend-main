import mongoose from 'mongoose';

import { GAME_CATEGORIES } from '@/types/game/game';
import { XP_SETTING_STATUS } from '@/types/settings/settings';

const { Schema } = mongoose;

const wagerXpSettingSchema = new Schema<IWagerXpSetting>({
  gameCategory: {
    type: String,
    required: true,
    enum: Object.values(GAME_CATEGORIES),
  },
  wagerXpAmount: {
    type: Number,
    required: true,
  },
});

const SettingsSchema = new Schema<ISettings>({
  depositMinAmount: {
    type: Number,
    required: true,
    default: 10, // default deposit minimum amount
  },
  withdrawMinAmount: {
    type: Number,
    required: true,
    default: 10, // default withdrawal minimum amount
  },
  withdrawMaxAmount: {
    type: Number,
    required: true,
    default: 10000, // default withdrawal maximum amount
  },
  termsCondition: {
    type: String,
  },
  xpSetting: {
    status: {
      type: String,
      required: true,
      enum: Object.values(XP_SETTING_STATUS.ACTIVE),
      default: XP_SETTING_STATUS.ACTIVE,
    },
    depositXpAmount: {
      type: Number,
      required: true,
      default: 100,
    },
    lossXpAmount: {
      type: Number,
      required: true,
      default: 100,
    },
    wagerXpSetting: {
      type: [wagerXpSettingSchema],
      required: true,
    },
  },
  allowedCountries: {
    type: [String],
    default: [],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  socialMediaSetting: {
    logo: {
      type: String,
      required: true,
      trim: true,
      comment: 'The logo',
    },
    logoSymbol: {
      type: String,
      required: true,
      trim: true,
      comment: 'The logo symbol',
    },
    logoStyle: {
      type: Object,
      required: true,
      default: {
        height: 48,
        top: 0,
        left: 0,
      },
    },
    logoSymbolStyle: {
      type: Object,
      required: true,
      default: {
        height: 48,
        top: 0,
        left: 0,
      },
    },
    title: {
      type: String,
      required: true,
      trim: true,
      comment: 'The title',
    },
    slogan: {
      type: String,
      trim: true,
      comment: 'The Slogan',
    },
    instagram: {
      type: String,
      trim: true,
      comment: 'The instagram',
    },
    facebook: {
      type: String,
      trim: true,
      comment: 'The facebook',
    },
    twitter: {
      type: String,
      trim: true,
      comment: 'The twitter',
    },
    whatsapp: {
      type: String,
      trim: true,
      comment: 'The whatspp',
    },
    telegram: {
      type: String,
      trim: true,
      comment: 'The telegram',
    },
    discord: {
      type: String,
      trim: true,
      comment: 'The discord',
    },
  },
});

// Automatically update timestamp when updating
SettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

SettingsSchema.statics.getXpSettingStatus = async function () {
  const xpSetting = await this.findOne({ 'xpSetting.status': { $exists: true } });
  return xpSetting;
};

SettingsSchema.statics.getWagerXpMultiplier = async function (gameCategory: SettingsGameCategory) {
  const settings = await this.findOne({ 'xpSetting.wagerXpSetting': { $elemMatch: { gameCategory } } });
  if (!settings) return null;
  return settings.xpSetting.wagerXpSetting.find((setting: IWagerXpSetting) => setting.gameCategory === gameCategory);
};

SettingsSchema.statics.getDepositXpMultiplier = async function () {
  const depositXpMultiplier = await this.findOne({ 'xpSetting.depositXpAmount': { $exists: true } });
  return depositXpMultiplier.xpSetting.depositXpAmount;
};

SettingsSchema.statics.getLossXpMultiplier = async function () {
  const lossXpMultiplier = await this.findOne({ 'xpSetting.lossXpAmount': { $exists: true } });
  return lossXpMultiplier;
};

SettingsSchema.statics.getDepositSettings = async function () {
  const depositSettings = await this.findOne({ depositMinAmount: { $exists: true } });
  return depositSettings;
};

export default mongoose.model<ISettings, ISettingsModel>('Settings', SettingsSchema);
