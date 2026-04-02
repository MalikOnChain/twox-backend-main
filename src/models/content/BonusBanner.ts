import mongoose, { Document, Schema } from 'mongoose';

export interface IBonusBannerDocument extends Document {
  title: string;           // "Join Twox & Get"
  subtitle: string;        // "100% BONUS"
  highlight: string;       // "UP TO 1 BTC!"
  image: string;           // URL or path to spinImg
  features: string[];      // Array of feature texts
  buttonText: string;      // "Join Now" button text
  order: number;           // Display order
  isActive: boolean;       // Whether this slide is active
  createdAt: Date;
  updatedAt: Date;
}

const bonusBannerSchema = new Schema<IBonusBannerDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Join Twox & Get',
    },
    subtitle: {
      type: String,
      required: true,
      trim: true,
      default: '100% BONUS',
    },
    highlight: {
      type: String,
      required: true,
      trim: true,
      default: 'UP TO 1 BTC!',
    },
    image: {
      type: String,
      required: true,
      trim: true,
      default: '/images/bonus/spin.png',
    },
    features: {
      type: [String],
      default: ['Fast Deposits', 'Instant Withdrawals', '24/7 Support'],
    },
    buttonText: {
      type: String,
      default: 'Join Now',
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index for efficient querying
bonusBannerSchema.index({ order: 1, isActive: 1 });

const BonusBanner = mongoose.model<IBonusBannerDocument>('BonusBanner', bonusBannerSchema);

export default BonusBanner;

