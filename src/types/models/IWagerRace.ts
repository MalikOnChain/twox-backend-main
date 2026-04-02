type WagerStatus = 'pending' | 'completed' | 'failed';

type ParticipantStatus = 'active' | 'completed' | 'disqualified';

type PrizeType = 'Fixed' | 'Percentage';

type ParticipantType = 'all' | 'vip' | 'referral' | 'custom';

type WagerRaceStatus2 = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled' | string;

type PaymentStatus = 'unpaid' | 'paid' | 'processing' | string;

type PayoutType = 'auto' | 'manual' | string;

type DelayType = 'hour' | 'day' | 'week' | string;

interface IWager {
  gameId: string;
  gameType: string;
  amount: number;
  timestamp: Date;
  status: WagerStatus;
  transactionId: string;
}

interface Participant {
  userId: Mongoose.ObjectId;
  totalWagered: number;
  wagers: IWager[];
  lastWagerAt?: Date;
  status: ParticipantStatus;
}

interface Prize {
  type: PrizeType;
  amounts: number[];
}

interface Participants {
  type: ParticipantType;
  code?: string;
  tiers?: Mongoose.ObjectId[];
  users: Participant[];
}

interface Delay {
  type: DelayType;
  value: number;
}

interface IWagerRace extends Mongoose.Document {
  title: string;
  description?: string;
  period: {
    start: Date;
    end: Date;
  };
  eligibleGames: string[];
  minWager: number;
  prize: Prize;
  participants: Participants;
  status: WagerRaceStatus2;
  paymentStatus: PaymentStatus;
  payoutType: PayoutType;
  delay: Delay;
  winners: Mongoose.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
interface IWagerRaceModel extends Mongoose.Model<IWagerRace> {
  getActiveRacesByUserId(userId: Mongoose.ObjectId): Promise<IWagerRace[]>;
}
