import mongoose from 'mongoose';

const favoriteGameSchema = new mongoose.Schema<IFavoriteGame>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// Prevent duplicate favorite (same user & game)
favoriteGameSchema.index({ user: 1, game: 1 }, { unique: true });

const FavoriteGame = mongoose.model<IFavoriteGame>('FavoriteGame', favoriteGameSchema);

export default FavoriteGame;
