interface IUTMVisitor extends Mongoose.Document {
  utm_source: UTMSource;
  utm_campaign: Mongoose.ObjectId;
  ip_address: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
