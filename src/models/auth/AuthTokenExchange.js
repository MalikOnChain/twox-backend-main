import mongoose from 'mongoose';

/**
 * Short-lived storage for login/register OAuth → exchange-token handoff.
 * Replaces in-memory TOKEN_STATE so multiple API instances (e.g. Render) share state.
 */
const AuthTokenExchangeSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
  },
  { timestamps: true }
);

AuthTokenExchangeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

const AuthTokenExchange = mongoose.model('AuthTokenExchange', AuthTokenExchangeSchema);

export default AuthTokenExchange;
