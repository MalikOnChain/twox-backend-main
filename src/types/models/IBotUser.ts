interface IBotUser extends Mongoose.Document {
  username: string;
  avatar: string;
  wager: number;
  rank: string;
  maxMultiplier: number;
  minMultiplier: number;
  maxBet: number;
  minBet: number;
  createdAt: Date;
  updatedAt: Date;
}
