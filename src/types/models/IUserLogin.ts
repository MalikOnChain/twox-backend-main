interface IUserLogin extends Mongoose.Document {
  userId: Mongoose.ObjectId;
  ipAddress?: string;
  ipInfo?: any;
  userAgent?: string;
  device?: string;
  fingerprint?: {
    visitorId: string;
    fingerprintData?: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
interface IUserLoginModel {
  getUserLoginHistory(userId: Mongoose.ObjectId, limit?: number): Promise<IUserLogin[]>;
  hasUserEverLoggedIn(userId: Mongoose.ObjectId): Promise<boolean>;
}
