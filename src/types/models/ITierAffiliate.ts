interface ITierAffiliate extends Mongoose.Document {
  name: string;
  referralCode: string;
  wagerCommissionRate: number;
  lossCommissionRate: number;
  assigner: Mongoose.ObjectId;
  createdAt: Date;
}
