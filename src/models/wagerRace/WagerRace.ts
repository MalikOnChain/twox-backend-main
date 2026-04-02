import mongoose from 'mongoose';

import { GAME_CATEGORIES } from '../../types/game/game';
import {
  DELAY_TYPE,
  PARTICIPANT_TYPE,
  PAYMENT_STATUS,
  PAYOUT_TYPE,
  WAGER_RACE_STATUS,
} from '../../types/wager-race/wager-race';

const { Schema } = mongoose;

const wagerSchema = new Schema<IWager>({
  gameId: { type: String, required: true },
  gameType: { type: String, required: true },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  transactionId: { type: String, required: true },
});

const participantSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  totalWagered: { type: Number, required: true, default: 0 },
  wagers: [wagerSchema], // Array of individual wagers
  lastWagerAt: { type: Date },
  status: {
    type: String,
    enum: ['active', 'completed', 'disqualified'],
    default: 'active',
  },
});

const WagerRaceSchema = new mongoose.Schema<IWagerRace>(
  {
    title: { type: String, required: true },
    description: { type: String },
    period: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    eligibleGames: {
      type: [String],
      enum: Object.values(GAME_CATEGORIES),
      required: true,
    },
    minWager: { type: Number, required: true },
    prize: {
      type: { type: String, enum: ['Fixed', 'Percentage'], required: true },
      amounts: {
        type: [Number],
        required: true,
      },
    },
    participants: {
      type: {
        type: String,
        enum: Object.values(PARTICIPANT_TYPE),
        required: true,
      },
      code: { type: String },
      tiers: { type: [Schema.Types.ObjectId], ref: 'VipTier' },
      users: { type: [participantSchema], default: [] },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(WAGER_RACE_STATUS),
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },
    payoutType: {
      type: String,
      enum: Object.values(PAYOUT_TYPE),
      default: PAYOUT_TYPE.AUTO,
    },
    delay: {
      type: {
        type: String,
        enum: Object.values(DELAY_TYPE),
        default: DELAY_TYPE.HOUR,
      },
      value: {
        type: Number,
        default: 0,
      },
    },
    winners: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
  },
  {
    timestamps: true, // Automatically manage `createdAt` and `updatedAt`
  }
);

WagerRaceSchema.statics.getActiveRacesByUserId = async function (userId) {
  const races = await this.find({
    status: WAGER_RACE_STATUS.ACTIVE,
    'participants.users': { $elemMatch: { userId } },
  });
  return races;
};

const WagerRace = mongoose.model<IWagerRace, IWagerRaceModel>('WagerRace', WagerRaceSchema);

export default WagerRace;
