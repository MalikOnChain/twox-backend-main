import mongoose, { Schema, Document } from 'mongoose';

export interface IBlueOceanGameSession extends Document {
  session_id: string;
  user_id: mongoose.Types.ObjectId;
  remote_id: string;
  game_id: string;
  game_name: string;
  started_at: Date;
  last_activity: Date;
}

const BlueOceanGameSessionSchema = new Schema<IBlueOceanGameSession>({
  session_id: { type: String, required: true, unique: true, index: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  remote_id: { type: String, required: true, index: true },
  game_id: { type: String, required: true, index: true },
  game_name: { type: String, required: true },
  started_at: { type: Date, default: Date.now },
  last_activity: { type: Date, default: Date.now },
});

// TTL index - auto-delete sessions older than 24 hours
BlueOceanGameSessionSchema.index({ last_activity: 1 }, { expireAfterSeconds: 86400 });

const BlueOceanGameSession = mongoose.model<IBlueOceanGameSession>(
  'BlueOceanGameSession',
  BlueOceanGameSessionSchema
);

export default BlueOceanGameSession;

