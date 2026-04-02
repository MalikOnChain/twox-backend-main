import mongoose from 'mongoose';

const Schema = mongoose.Schema;

/**
 * Fingerprint Schema
 * Used to track browser fingerprints for security and fraud detection
 */
const fingerprintSchema = new Schema(
  {
    // Visitor ID from FingerprintJS
    visitorId: {
      type: String,
      required: true,
      index: true,
    },
    
    // User ID (optional, for authenticated users)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    
    // Full fingerprint data from FingerprintJS
    fingerprintData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    
    // Action/Event type
    action: {
      type: String,
      enum: ['login', 'register', 'bonus_claim', 'deposit', 'withdraw', 'game_launch', 'promo_redeem', 'other'],
      required: true,
      index: true,
    },
    
    // Additional metadata
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    
    // IP address
    ipAddress: {
      type: String,
      index: true,
    },
    
    // User agent
    userAgent: {
      type: String,
    },
    
    // Risk score (calculated)
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    
    // Flags
    isSuspicious: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
fingerprintSchema.index({ visitorId: 1, createdAt: -1 });
fingerprintSchema.index({ userId: 1, createdAt: -1 });
fingerprintSchema.index({ action: 1, createdAt: -1 });
fingerprintSchema.index({ visitorId: 1, userId: 1 });

// Static method to get fingerprints by visitor ID
fingerprintSchema.statics.getFingerprintsByVisitorId = async function (visitorId, limit = 50) {
  return this.find({ visitorId }).sort({ createdAt: -1 }).limit(limit).lean();
};

// Static method to get fingerprints by user ID
fingerprintSchema.statics.getFingerprintsByUserId = async function (userId, limit = 50) {
  return this.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
};

// Static method to check if visitor ID is associated with multiple users
fingerprintSchema.statics.getUsersByVisitorId = async function (visitorId) {
  const fingerprints = await this.find({ visitorId, userId: { $exists: true } })
    .distinct('userId')
    .lean();
  return fingerprints;
};

// Static method to check if user has multiple visitor IDs
fingerprintSchema.statics.getVisitorIdsByUserId = async function (userId) {
  const fingerprints = await this.find({ userId })
    .distinct('visitorId')
    .lean();
  return fingerprints;
};

const Fingerprint = mongoose.model('Fingerprint', fingerprintSchema);

export default Fingerprint;


