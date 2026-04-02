type WheelBonusStatus = 'inactive' | 'active';

interface IWheelBonus extends Mongoose.Document {
  status: WheelBonusStatus;
  validTo?: Date;
  validFrom?: Date;
  wheelBonusAmounts: number[];
  wheelBonusWeights: number[];
  createdAt: Date;
  updatedAt: Date;

  // Virtual Properties
  isExpired: boolean;
}
