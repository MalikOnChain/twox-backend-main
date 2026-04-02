import mongoose from 'mongoose';

const gameProviderSchema = new mongoose.Schema<IGameProvider>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['slot', 'live'],
      lowercase: true,
    },
    status: {
      type: Number,
      required: true,
      enum: [0, 1],
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
gameProviderSchema.index({ type: 1 });
gameProviderSchema.index({ status: 1 });

// Add custom method to get active providers
gameProviderSchema.statics.getActiveProviders = function () {
  return this.find({ status: 1 });
};

// Create the model
const GameProvider = mongoose.model<IGameProvider, IGameProviderModel>('GameProviders', gameProviderSchema);

export default GameProvider;
