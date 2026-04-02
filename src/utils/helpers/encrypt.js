import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY.trim(), 'base64'); // 32 bytes (256 bits) for AES-256
const IV = Buffer.from(process.env.IV.trim(), 'base64'); // 16 bytes IV for AES-CBC mode
const SALT = process.env.COMMON_SALT.trim();

// const ENCRYPTION_KEY = crypto.randomBytes(32);
// const IV = crypto.randomBytes(16);

// Ensure both ENCRYPTION_KEY and IV are defined
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be a 32-byte value (256 bits)');
}

if (!IV || IV.length !== 16) {
  throw new Error('IV must be a 16-byte value');
}

// Function to encrypt
export function encrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Function to decrypt
export function decrypt(encryptedText) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateHash(text, SALT_ROUNDS = 3) {
  let hash = crypto.createHash('sha256').update(text).digest('hex');

  for (let i = 0; i < SALT_ROUNDS; i++) {
    hash = crypto.createHash('sha256').update(`${hash}:${SALT}:${i}`).digest('hex');
  }

  return hash;
}

export function hashCode(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}
