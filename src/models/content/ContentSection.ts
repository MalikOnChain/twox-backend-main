import mongoose, { Document, Schema } from 'mongoose';

export interface IContentSection extends Document {
  title: string;
  content: string;
  listItems: string[];
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const ContentSectionSchema = new Schema<IContentSection>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    listItems: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
ContentSectionSchema.index({ isActive: 1, order: 1 });

const ContentSection = mongoose.model<IContentSection>('ContentSection', ContentSectionSchema);

export default ContentSection;

