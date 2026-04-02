import mongoose from 'mongoose';

import { BonusType, ClaimMethod, ReferralUserRewardStatus } from '../../types/bonus/bonus';

const ReferralUserRewardSchema = new mongoose.Schema<IReferralUserReward>(
  {
    name: { type: String, required: true, unique: true },
    type: { type: String, enum: [BonusType.REFERRAL], default: BonusType.REFERRAL },
    amount: { type: Number, required: true },
    description: { type: String, default: '' },
    requiredReferralCount: { type: Number, required: true, unique: true },
    claimMethod: { type: String, enum: [ClaimMethod.AUTO, ClaimMethod.MANUAL], default: ClaimMethod.AUTO },
    status: { type: Number, enum: [...Object.values(ReferralUserRewardStatus)] },
  },
  {
    timestamps: true,
  }
);

const ReferralUserReward = mongoose.model<IReferralUserReward>('ReferralUserReward', ReferralUserRewardSchema);

export default ReferralUserReward;
