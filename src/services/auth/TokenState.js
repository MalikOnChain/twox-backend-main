import AuthTokenExchange from '@/models/auth/AuthTokenExchange.js';

export async function addTokenToState(identifier, accessToken, refreshToken) {
  await AuthTokenExchange.create({ identifier, accessToken, refreshToken });
}

/**
 * Atomically load and delete one exchange row (single-use token handoff).
 * @returns {Promise<{ identifier: string, accessToken: string, refreshToken: string } | null>}
 */
export async function takeTokenStateByIdentifier(identifier) {
  const doc = await AuthTokenExchange.findOneAndDelete({ identifier }).lean();
  if (!doc) return null;
  return {
    identifier: doc.identifier,
    accessToken: doc.accessToken,
    refreshToken: doc.refreshToken,
  };
}
