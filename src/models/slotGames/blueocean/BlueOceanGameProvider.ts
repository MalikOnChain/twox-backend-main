import mongoose, { Document, Schema } from 'mongoose';

// Interface for the document
export interface IBlueOceanGameProviderDocument extends Document {
  // Provider information
  provider: string;
  providerName: string;
  image: string;
  name: string;
  system: string;
  imageBlack: string;
  imageWhite: string;
  imageColored: string;
  imageSmallColor: string;
  imageSmallGray: string;
  type: string;
  status?: number; // 0 = disabled, 1 = enabled (optional, defaults to 1)

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const blueOceanGameProviderSchema = new Schema<IBlueOceanGameProviderDocument>(
  {
    // Provider information
    provider: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    providerName: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    system: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    imageBlack: {
      type: String,
      trim: true,
    },
    imageWhite: {
      type: String,
      trim: true,
    },
    imageColored: {
      type: String,
      trim: true,
    },
    imageSmallColor: {
      type: String,
      trim: true,
    },
    imageSmallGray: {
      type: String,
      trim: true,
    },
    status: {
      type: Number,
      default: 1, // 0 = disabled, 1 = enabled
      min: 0,
      max: 1,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Middleware to format data before saving
blueOceanGameProviderSchema.pre('save', function (this: IBlueOceanGameProviderDocument, next) {
  // Ensure provider is lowercase
  if (this.isModified('provider')) {
    this.provider = this.provider.toLowerCase();
  }

  next();
});

// Create the model
const BlueOceanGameProvider = mongoose.model<IBlueOceanGameProviderDocument>(
  'BlueOceanGameProviders',
  blueOceanGameProviderSchema
);

export default BlueOceanGameProvider;
