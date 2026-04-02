import mongoose, { Schema, Document } from 'mongoose';

export interface IWinnersFeedSettings extends Document {
  isEnabled: boolean;
  inclusionCriteria: {
    minWinAmount: number;
    minBetAmount?: number;
    gameCategories?: string[];
    excludeGameIds?: string[];
    excludeProviderIds?: string[];
    timeRange?: {
      hours: number; // Only show winners from last N hours
    };
  };
  maskRules: {
    maskUsername: boolean;
    maskPattern?: 'partial' | 'full'; // partial: show first 2 chars, full: show only ***
    showAmount: boolean;
    showGame: boolean;
    showTime: boolean;
  };
  displaySettings: {
    maxItems: number;
    refreshInterval?: number; // seconds
    featuredWinners?: mongoose.Schema.Types.ObjectId[]; // Manually featured winners
    hiddenWinners?: mongoose.Schema.Types.ObjectId[]; // Manually hidden winners
  };
  analytics: {
    totalDisplayed: number;
    lastUpdated: Date;
    views?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const WinnersFeedSettingsSchema = new Schema<IWinnersFeedSettings>(
  {
    isEnabled: {
      type: Boolean,
      default: true,
    },
    inclusionCriteria: {
      minWinAmount: {
        type: Number,
        required: true,
        default: 0,
      },
      minBetAmount: Number,
      gameCategories: [String],
      excludeGameIds: [String],
      excludeProviderIds: [String],
      timeRange: {
        hours: Number,
      },
    },
    maskRules: {
      maskUsername: {
        type: Boolean,
        default: false,
      },
      maskPattern: {
        type: String,
        enum: ['partial', 'full'],
        default: 'partial',
      },
      showAmount: {
        type: Boolean,
        default: true,
      },
      showGame: {
        type: Boolean,
        default: true,
      },
      showTime: {
        type: Boolean,
        default: true,
      },
    },
    displaySettings: {
      maxItems: {
        type: Number,
        default: 50,
      },
      refreshInterval: Number,
      featuredWinners: [
        {
          type: Schema.Types.ObjectId,
          ref: 'GameTransaction',
        },
      ],
      hiddenWinners: [
        {
          type: Schema.Types.ObjectId,
          ref: 'GameTransaction',
        },
      ],
    },
    analytics: {
      totalDisplayed: {
        type: Number,
        default: 0,
      },
      lastUpdated: Date,
      views: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
WinnersFeedSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const WinnersFeedSettings = mongoose.model<IWinnersFeedSettings>(
  'WinnersFeedSettings',
  WinnersFeedSettingsSchema
);

export default WinnersFeedSettings;





