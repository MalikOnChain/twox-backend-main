// Require Dependencies
import mongoose from 'mongoose';

const EmailTemplateSchema = new mongoose.Schema<IEmailTemplate>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ['verifyEmail', 'forgotPassword'],
    },
    subject: {
      type: String,
      required: true,
    },
    html: {
      type: String,
      required: true,
    },
    requiredVariables: [
      {
        type: String,
        required: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IEmailTemplate>('EmailTemplate', EmailTemplateSchema);
