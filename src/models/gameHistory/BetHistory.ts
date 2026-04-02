import mongoose from 'mongoose';

const { Schema } = mongoose;

const betHistorySchema = new mongoose.Schema<IBetHistory>(
  {
    playerId: {
      type: String,
      required: true,
    },
    betAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    payout: {
      type: Number,
      required: true,
      min: 0,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      required: true,
    },
    time: {
      type: Date,
      default: Date.now,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    collection: 'betHistory', // Explicitly set collection name
  }
);

// Create indexes for common queries
betHistorySchema.index({ username: 1 });
betHistorySchema.index({ time: -1 });
betHistorySchema.index({ category: 1 });

// Create compound index for username and time
betHistorySchema.index({ username: 1, time: -1 });

// Static method to create bet history
betHistorySchema.statics.createHistory = async function (betData) {
  try {
    const history = new this({
      playerId: betData.playerId,
      betAmount: betData.betAmount,
      payout: betData.payout,
      username: betData.username,
      avatar: betData.avatar,
      time: betData.time || new Date(),
      category: betData.category,
      metadata: betData.metadata,
    });

    const newHistory = await history.save();
    return newHistory;
  } catch (error: any) {
    throw new Error(`Error creating bet history: ${error.message}`);
  }
};

const BetHistory = mongoose.model<IBetHistory, IBetHistoryModel>('BetHistory', betHistorySchema);

export default BetHistory;
