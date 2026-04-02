import nacl from 'tweetnacl';

/**
 * Recursively sort object keys for stable JSON (matches Fystack / SDK canonicalization).
 */
export function canonicalizeJSON(inputObject: Record<string, unknown>): string {
  if (typeof inputObject !== 'object' || inputObject === null) {
    throw new Error('Input must be a non-null object.');
  }
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(sortKeys);
    }
    if (value && typeof value === 'object' && value.constructor === Object) {
      return Object.keys(value as object)
        .sort()
        .reduce((sortedObj: Record<string, unknown>, key: string) => {
          sortedObj[key] = sortKeys((value as Record<string, unknown>)[key]);
          return sortedObj;
        }, {});
    }
    return value;
  };
  return JSON.stringify(sortKeys(inputObject));
}

/**
 * Verify x-webhook-signature (hex-encoded Ed25519 signature) over canonicalized body.
 * Set FYSTACK_WEBHOOK_PUBLIC_KEY_HEX to the workspace verification key (64-char hex).
 */
export function verifyFystackWebhookEd25519(body: Record<string, unknown>, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const canonical = canonicalizeJSON(body);
    const msg = new TextEncoder().encode(canonical);
    const sig = Buffer.from(signatureHex.replace(/^0x/i, ''), 'hex');
    const pk = Buffer.from(publicKeyHex.replace(/^0x/i, ''), 'hex');
    if (sig.length !== 64 || pk.length !== 32) {
      return false;
    }
    return nacl.sign.detached.verify(msg, sig, pk);
  } catch {
    return false;
  }
}
