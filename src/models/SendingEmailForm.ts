// Import Dependencies
import mongoose from 'mongoose';

// Setup User Schema
const SendingEmailFormSchema = new mongoose.Schema<ISendingEmailForm>(
  {
    content: String,
    title: String,
  },
  {
    timestamps: true,
  }
);

// Create and export the new model
export default mongoose.model<ISendingEmailForm>('SendingEmailForm', SendingEmailFormSchema);
