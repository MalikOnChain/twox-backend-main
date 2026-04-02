import mongoose from 'mongoose';

import { GAME_CATEGORIES } from '@/types/game/game';

const { Schema } = mongoose;

const recentWinListSchema = new Schema<IRecentWinList>(
  {
    category: {
      type: String,
      enum: Object.values(GAME_CATEGORIES),
      required: true,
      index: true,
    },
    game: {
      name: {
        type: String,
        required: true,
      },
      id: {
        type: String,
        required: true,
        index: true,
      },
      provider: {
        type: String,
        required: true,
      },
    },
    banners: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    lastBet: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
recentWinListSchema.index({ category: 1, isActive: 1 });
recentWinListSchema.index({ displayOrder: 1, isActive: 1 });

const RecentWinList = mongoose.model<IRecentWinList>('RecentWinList', recentWinListSchema);

export default RecentWinList;
