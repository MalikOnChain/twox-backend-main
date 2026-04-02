import mongoose, { Document, Schema } from 'mongoose';

import { BlueOceanGameProviders, BlueOceanGameTypes } from '@/types/casino/blueocean/blueocean-provider';

// Interface for the document
export interface IBlueOceanGameDocument extends Document {
  // Core game information
  gameId: string; // BlueOcean game ID
  name: string;
  type: BlueOceanGameTypes;
  subcategory: string;
  category: string;
  system: string;
  provider: BlueOceanGameProviders;
  providerName: string;

  // Game details
  details: string;
  licence: string;
  gamename: string;
  report: string;

  // Game metadata
  isNewGame: boolean;
  position: number;
  plays: number;
  rtp: string;
  wagering: string | null;

  // Platform support
  mobile: boolean;
  playForFunSupported: boolean;
  freeroundsSupported: boolean;
  featurebuySupported: boolean;
  hasJackpot: boolean;

  // Dates
  releaseDate: Date;
  showDate: Date;
  hideDate: Date | null;

  // Identifiers
  idHash: string;
  idParent: string;
  idHashParent: string;
  lottie: string | null;

  // Images
  image: string;
  imagePreview: string;
  imageFilled: string;
  imagePortrait: string;
  imageSquare: string;
  imageBackground: string;
  imageLottie: string;
  imagePortraitLottie: string;
  imageSquareLottie: string;
  imageBw: string;

  // Status and management
  status: 'active' | 'inactive' | 'hidden';
  isEnabled: boolean;
  isFeatured: boolean;
  order: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date;
}

const blueOceanGameSchema = new Schema<IBlueOceanGameDocument>(
  {
    // Core game information
    gameId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    subcategory: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    system: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    providerName: {
      type: String,
      required: true,
      trim: true,
    },

    // Game details
    details: {
      type: String,
      default: '{}',
    },
    licence: {
      type: String,
      default: '',
    },
    gamename: {
      type: String,
      default: '',
    },
    report: {
      type: String,
      required: true,
      trim: true,
    },

    isNewGame: {
      type: Boolean,
      default: false,
      index: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    plays: {
      type: Number,
      default: 0,
    },
    rtp: {
      type: String,
      default: '0',
    },
    wagering: {
      type: String,
      default: null,
    },

    // Platform support
    mobile: {
      type: Boolean,
      default: false,
      index: true,
    },
    playForFunSupported: {
      type: Boolean,
      default: false,
    },
    freeroundsSupported: {
      type: Boolean,
      default: false,
    },
    featurebuySupported: {
      type: Boolean,
      default: false,
    },
    hasJackpot: {
      type: Boolean,
      default: false,
    },

    // Dates
    releaseDate: {
      type: Date,
      default: null,
    },
    showDate: {
      type: Date,
      default: null,
    },
    hideDate: {
      type: Date,
      default: null,
    },

    // Identifiers
    idHash: {
      type: String,
      required: true,
      trim: true,
    },
    idParent: {
      type: String,
      default: '0',
    },
    idHashParent: {
      type: String,
      default: '',
    },
    lottie: {
      type: String,
      default: null,
    },

    // Images
    image: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|jpe|webp|gif|svg)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid image URL!`,
      },
    },
    imagePreview: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|jpe|webp|gif|svg)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid image URL!`,
      },
    },
    imageFilled: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|jpe|webp|gif|svg)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid image URL!`,
      },
    },
    imagePortrait: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|jpe|webp|gif|svg)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid image URL!`,
      },
    },
    imageSquare: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|jpe|webp|gif|svg)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid image URL!`,
      },
    },
    imageBackground: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|jpe|webp|gif|svg)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid image URL!`,
      },
    },
    imageLottie: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(lottie|json)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid lottie URL!`,
      },
    },
    imagePortraitLottie: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(lottie|json)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid lottie URL!`,
      },
    },
    imageSquareLottie: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(lottie|json)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid lottie URL!`,
      },
    },
    imageBw: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|jpe|webp|gif|svg)(\?.*)?$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid image URL!`,
      },
    },

    // Status and management
    status: {
      type: String,
      enum: ['active', 'inactive', 'hidden'],
      default: 'active',
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },

    // Timestamps
    lastSyncAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Virtual for generating full game information
blueOceanGameSchema.virtual('fullInfo').get(function (this: IBlueOceanGameDocument) {
  return `${this.name} (${this.gameId}) - ${this.providerName}`;
});

// Virtual for checking if game is available
blueOceanGameSchema.virtual('isAvailable').get(function (this: IBlueOceanGameDocument) {
  const now = new Date();
  return (
    this.status === 'active' &&
    this.isEnabled &&
    (!this.showDate || this.showDate <= now) &&
    (!this.hideDate || this.hideDate > now)
  );
});

// Middleware to format data before saving
blueOceanGameSchema.pre('save', function (this: IBlueOceanGameDocument, next) {
  // Ensure provider and category are lowercase
  if (this.isModified('provider')) {
    this.provider = this.provider as BlueOceanGameProviders;
  }
  if (this.isModified('category')) {
    this.category = this.category.toLowerCase();
  }
  if (this.isModified('type')) {
    this.type = this.type as BlueOceanGameTypes;
  }
  if (this.isModified('system')) {
    this.system = this.system.toLowerCase();
  }

  // Update lastSyncAt when game data changes
  if (this.isModified()) {
    this.lastSyncAt = new Date();
  }

  next();
});

// Create the model
const BlueOceanGame = mongoose.model<IBlueOceanGameDocument>('BlueOceanGames', blueOceanGameSchema);

export default BlueOceanGame;
