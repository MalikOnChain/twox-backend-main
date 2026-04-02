import mongoose from 'mongoose';

const gameListSchema = new mongoose.Schema<IGameLists>(
  {
    id: {
      type: Number,
      required: true,
    },
    game_code: {
      type: String,
      required: true,
      trim: true,
    },
    provider_code: {
      type: String,
      required: true,
      trim: true,
    },
    game_name: {
      type: String,
      required: true,
      trim: true,
    },
    banner: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|jpe|webp)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid image URL!`,
      },
    },
    type: {
      type: String,
      required: true,
      enum: ['slot', 'live'],
    },
    status: {
      type: Number,
      required: true,
      enum: [0, 1],
      default: 1,
      index: true,
    },
    order: {
      type: Number,
      default: null,
    },
    is_pinned: {
      type: Boolean,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Virtual for generating full game information
gameListSchema.virtual('fullInfo').get(function () {
  return `${this.game_name} (${this.game_code})`;
});

// Static method to find active games
gameListSchema.statics.findActive = function () {
  return this.find({ status: 1 }).sort('game_name');
};

// Create model
const GameList = mongoose.model<IGameLists>('GameLists', gameListSchema);

export default GameList;
