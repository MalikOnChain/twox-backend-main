import mongoose from 'mongoose';

const Schema = mongoose.Schema;

/**
 * UserLogin Schema
 * Used to track user login events and determine first login
 */
const UserLoginSchema = new Schema<IUserLogin>(
  {
    // User who logged in
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // IP address of the login (optional)
    ipAddress: {
      type: String,
    },

    // IP data (optional)
    ipInfo: {
      type: Object,
    },

    // User agent information (optional)
    userAgent: {
      type: String,
    },

    // Device information (optional)
    device: {
      type: String,
    },
    // Fingerprint data (optional)
    fingerprint: {
      visitorId: {
        type: String,
        index: true,
      },
      fingerprintData: {
        type: Schema.Types.Mixed,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    // Login method (e.g., password, Google, Steam)
    // loginMethod: {
    //   type: String,
    //   enum: ['password', 'google', 'steam', 'wallet'],
    //   default: 'password',
    // },
  },
  { timestamps: true }
);

// Create indexes for common queries
UserLoginSchema.index({ userId: 1, createdAt: -1 });

// Static method to get a user's login history
UserLoginSchema.statics.getUserLoginHistory = async function (userId, limit = 10) {
  return this.find({ userId }).sort({ createdAt: -1 }).limit(limit);
};

// Static method to check if user has ever logged in
UserLoginSchema.statics.hasUserEverLoggedIn = async function (userId) {
  const count = await this.countDocuments({ userId });
  return count > 0;
};

const UserLogin = mongoose.model<IUserLogin, IUserLoginModel>('UserLogin', UserLoginSchema);

export default UserLogin;
