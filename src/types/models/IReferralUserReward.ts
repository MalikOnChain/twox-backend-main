type ReferralUserRewardStatus = 1 | 0;

interface IReferralUserReward extends Mongoose.Document {
  name: string;
  type: 'referral';
  amount: number;
  description: string;
  requiredReferralCount: number;
  claimMethod: 'auto' | 'manual';
  status: ReferralUserRewardStatus;
  createdAt: Date;
  updatedAt: Date;
}
