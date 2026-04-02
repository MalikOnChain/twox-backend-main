interface IVipTierLevel {
  level: number;
  minXP: number;
  icon: string;
  name: string;
}

interface IVipTier extends Mongoose.Document {
  name: string;
  icon: string;
  levels: IVipTierLevel[];
  downgradePeriod: number;
  createdAt: Date;
  updatedAt: Date;
}
