import mongoose from 'mongoose';

const WheelBonusSchema = new mongoose.Schema<IWheelBonus>(
  {
    status: {
      type: String,
      enum: ['inactive', 'active'],
      default: 'inactive',
    },
    validTo: {
      type: Date,
      default: null,
    },
    validFrom: {
      type: Date,
      default: null,
    },
    wheelBonusAmounts: {
      type: [Number],
      default: [5, 10, 20, 30, 50, 100, 200, 500],
    },
    wheelBonusWeights: {
      type: [Number],
      default: [1, 1, 1, 1, 1, 1, 1, 1],
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to check if bonus is expired
WheelBonusSchema.virtual('isExpired').get(function () {
  return this.validTo && new Date() > this.validTo;
});

// Create the Bonus model from the schema
const WheelBonus = mongoose.model<IWheelBonus>('WheelBonus', WheelBonusSchema);

export default WheelBonus;
