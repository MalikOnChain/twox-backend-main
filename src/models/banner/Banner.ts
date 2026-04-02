import mongoose from 'mongoose';

const { Schema } = mongoose;

const bannerSchema = new Schema<IBanner>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      // comment: "The title of the banner", // Comments are not used in JS schema
    },
    image: {
      type: String,
      required: true,
    },
    position: {
      type: String,
      required: true,
    },
    language: {
      code: {
        type: String,
        required: true,
        enum: ['en', 'es', 'fr', 'de', 'it', 'ar', 'pt', 'zh'],
      },
      name: {
        type: String,
        required: true,
        enum: ['English', 'Spanish', 'French', 'German', 'Italian', 'Arabic', 'Portuguese', 'Chinese'],
      },
    },
    device: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet', 'smartwatch'],
      required: true,
    },
    section: {
      type: String,
      enum: [
        'home',
        'promotions',
        'games',
        'sports',
        'casino',
        'bonuses',
        'responsible-gambling',
        'new-user-registration',
        'payment-methods',
        'mobile-app',
        'live-betting',
        'vip-program',
        'events',
        'affiliate',
        'blog-news',
        'footer',
      ],
      required: true,
    },
    bannerData: {
      title: {
        type: String,
        trim: true,
      },
      subtitle: {
        type: String,
        trim: true,
      },
      highlight: {
        type: String,
        trim: true,
      },
      features: {
        type: [String],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

const Banner = mongoose.model<IBanner>('Banners', bannerSchema);

export default Banner;
