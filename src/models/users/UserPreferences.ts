import mongoose from 'mongoose';

interface IUserPreferences extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  language: string;
  timezone: string;
  currency: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const userPreferencesSchema = new mongoose.Schema<IUserPreferences>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    language: {
      type: String,
      // Allow any string for flexibility with different languages
      default: 'english',
    },
    timezone: {
      type: String,
      default: 'utc+00:00',
    },
    currency: {
      type: String,
      default: 'USD',
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get or create preferences for a user
userPreferencesSchema.statics.getOrCreatePreferences = async function(userId: mongoose.Types.ObjectId) {
  let preferences = await this.findOne({ userId });
  
  if (!preferences) {
    preferences = await this.create({ userId });
  }
  
  return preferences;
};

// Export model
const UserPreferences = mongoose.model<IUserPreferences>('UserPreferences', userPreferencesSchema);

export default UserPreferences;

