// Import Dependencies
import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const promotionSchema = new Schema<IPromotion>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      comment: 'The name of the Promotion',
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      comment: 'The summary of the Promotion',
    },
    colorTheme: {
      type: Number,
      enum: [0, 1, 2],
      default: 0,
      comment: 'The color theme of the Promotion',
    },
    highlightText: {
      type: String,
      trim: true,
      comment: 'The highlight text of the Promotion',
    },
    badge: {
      type: String,
      trim: true,
      comment: 'The badge of the Promotion',
    },
    buttons: [
      {
        text: {
          type: String,
          required: true,
          trim: true,
        },
        link: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    image: {
      type: String,
      required: true,
      comment: 'The image for the Promotion',
    },
    description: {
      type: String,
      required: true,
      comment: 'The description for the Promotion is rich text',
    },
    bonusId: {
      type: Schema.Types.ObjectId,
      ref: 'Bonus',
      comment: 'The bonus for the Promotion',
    },
    isPublic: {
      type: Boolean,
      default: false,
      comment: 'Whether the promotion is public',
    },
  },
  {
    timestamps: true,
  }
);

// Create the model
const Promotion = mongoose.model<IPromotion>('Promotion', promotionSchema);

export default Promotion;
