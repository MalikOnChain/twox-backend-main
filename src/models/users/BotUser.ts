import mongoose from 'mongoose';

// Define the schema for BotUser
const BotUserSchema = new mongoose.Schema<IBotUser>(
  {
    username: {
      type: String,
      required: true, // Ensuring the username is required
    },
    avatar: {
      type: String,
      required: true, // Ensuring the avatar is required (could be a URL or file path)
    },
    wager: {
      type: Number,
      required: true, // Ensuring the wager is required
    },
    rank: {
      type: String,
      required: true, // Ensuring the rank is required
    },
    maxMultiplier: {
      type: Number,
      required: true,
      default: 50,
    },
    minMultiplier: {
      type: Number,
      required: true,
      default: 1.1,
    },
    maxBet: {
      type: Number,
      required: true,
      default: 20,
    },
    minBet: {
      type: Number,
      required: true,
      default: 0.2,
    },
  },
  {
    timestamps: true, // This will automatically add createdAt and updatedAt fields
  }
);

// Create a model from the schema
const BotUser = mongoose.model<IBotUser>('BotUser', BotUserSchema);

export default BotUser;
