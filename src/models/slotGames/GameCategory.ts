import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const gameCategorySchema = new Schema<IGameCategory>(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    gameIds: {
      type: [String],
      required: true,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },

    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const GameCategory = mongoose.model<IGameCategory>('GameCategories', gameCategorySchema);

export default GameCategory;
