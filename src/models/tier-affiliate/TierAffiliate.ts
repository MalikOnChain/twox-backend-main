import mongoose from 'mongoose';

const TierAffiliateSchema = new mongoose.Schema<ITierAffiliate>({
  name: { type: String, required: true },
  referralCode: { type: String, unique: true, required: true },
  wagerCommissionRate: { type: Number, default: 0, max: 1.2 }, // % of wagers
  lossCommissionRate: { type: Number, default: 0, max: 50 }, // % of losses
  assigner: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  createdAt: { type: Date, default: Date.now },
});

const TierAffiliate = mongoose.model<ITierAffiliate>('TierAffiliate', TierAffiliateSchema);

export default TierAffiliate;
