import mongoose from 'mongoose';

const giphyTrendSchema = new mongoose.Schema<IGiphyTrend>(
  {
    gifId: {
      type: String,
      required: true,
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Create a compound index for efficient querying by usage and date
giphyTrendSchema.index({ usageCount: -1, lastUsed: -1 });

// Method to increment usage count
giphyTrendSchema.statics.incrementUsage = async function (gifId) {
  return this.findOneAndUpdate(
    { gifId },
    {
      $inc: { usageCount: 1 },
      $set: { lastUsed: new Date() },
    },
    { upsert: true, new: true }
  );
};

// Method to get popular GIFs (usage count > 100)
giphyTrendSchema.statics.getPopularGifs = async function (limit) {
  return this.find({ usageCount: { $gt: 100 } })
    .sort({ usageCount: -1, lastUsed: -1 })
    .limit(limit);
};

const GiphyTrend = mongoose.model<IGiphyTrend, IGiphyTrendModel>('GiphyTrend', giphyTrendSchema);

export default GiphyTrend;
