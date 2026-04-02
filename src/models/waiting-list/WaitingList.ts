// Import Dependencies
import mongoose from 'mongoose';

const Schema = mongoose.Schema;

interface IWaitingList {
  // User's email address (unique and required)
  email?: string;
  
  googleId?: string;
  discordId?: string;
  telegramId?: string;
  
  // Username (optional for waiting list)
  username?: string;
  
  // Password (hashed, optional for OAuth users)
  password?: string;
  
  // Full name (optional)
  fullName?: string;
  
  // Profile avatar (URL or path to the image)
  avatar?: string;
  
  // Verified status
  verified: string[];
  
  // Phone number (optional)
  phoneNumber?: string;
  
  // UTM tracking
  utm_source?: string;
  utm_campaign?: string;
  
  // Referral code used during signup
  referralCode?: string;
  
  // IP address at registration
  registrationIP?: string;
  
  // User agent at registration
  registrationUserAgent?: string;
  
  // Status: 'pending', 'approved', 'rejected'
  status: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const WaitingListSchema = new Schema<IWaitingList>(
  {
    // User's email address (unique and required)
    email: {
      type: String,
      unique: true,
      lowercase: true,
      sparse: true,
      match: [/^[\w.-]+@[a-zA-Z0-9]+\.[a-zA-Z]{2,4}$/, 'Please fill a valid email address'],
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    discordId: {
      type: String,
      unique: true,
      sparse: true,
    },
    telegramId: {
      type: String,
      unique: true,
      sparse: true,
    },
    
    // Username (optional for waiting list)
    username: {
      type: String,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [16, 'Username cannot exceed 16 characters'],
    },
    
    // Password (hashed, optional for OAuth users)
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters long'],
    },
    
    // Full name (optional)
    fullName: {
      type: String,
      default: '',
    },

    // Profile avatar (URL or path to the image)
    avatar: {
      type: String,
      default: 'default-avatar.png',
    },

    // Verified status
    verified: {
      type: [String],
      default: [],
      enum: ['steam', 'google', 'discord', 'telegram', 'wallet'],
    },

    // Phone number (optional)
    phoneNumber: {
      type: String,
      default: '',
    },

    // UTM tracking
    utm_source: {
      type: String,
      default: '',
    },
    utm_campaign: {
      type: String,
      default: '',
    },

    // Referral code used during signup
    referralCode: {
      type: String,
      default: '',
    },

    // IP address at registration
    registrationIP: {
      type: String,
      default: '',
    },

    // User agent at registration
    registrationUserAgent: {
      type: String,
      default: '',
    },

    // Status: 'pending', 'approved', 'rejected'
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
WaitingListSchema.index({ email: 1 });
WaitingListSchema.index({ googleId: 1 });
WaitingListSchema.index({ discordId: 1 });
WaitingListSchema.index({ telegramId: 1 });
WaitingListSchema.index({ status: 1 });
WaitingListSchema.index({ createdAt: -1 });

const WaitingList = mongoose.model<IWaitingList>('WaitingList', WaitingListSchema);

export default WaitingList;
export type { IWaitingList };

