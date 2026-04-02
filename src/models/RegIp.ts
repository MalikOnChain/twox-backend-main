// Require Dependencies
import mongoose from 'mongoose';

const RegIpSchema = new mongoose.Schema<IRegIp>({
  ip_address: String,

  // When this ip was used to register
  used: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model<IRegIp>('RegIp', RegIpSchema);
