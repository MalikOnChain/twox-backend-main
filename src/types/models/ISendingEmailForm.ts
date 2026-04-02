interface ISendingEmailForm extends Mongoose.Document {
  content: string;
  title: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
