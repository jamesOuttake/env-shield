/**
 * Core cryptographic operations for env-shield.
 * Uses AES-256-GCM with random IVs for authenticated encryption.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive an encryption key from a passphrase using PBKDF2
 */
function deriveKey(passphrase, salt) {
  if (!salt) {
    salt = crypto.randomBytes(SALT_LENGTH);
  } else if (typeof salt === 'string') {
    salt = Buffer.from(salt, 'hex');
  }

  const key = crypto.pbkdf2Sync(
    passphrase,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );

  return { key, salt };
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns format: salt:iv:authTag:ciphertext (all hex-encoded)
 */
function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted,
  ].join(':');
}

/**
 * Decrypt ciphertext using AES-256-GCM
 */
function decrypt(ciphertext, keyHex) {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format. Expected iv:authTag:data');
  }

  const [ivHex, authTagHex, data] = parts;
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a random 256-bit key
 */
function generateKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Hash data using SHA-256
 */
function hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify the current Node.js environment supports required crypto operations
 */
function verifyEnvironment() {
  const ciphers = crypto.getCiphers();
  const supported = {
    'aes-256-gcm': ciphers.includes('aes-256-gcm'),
    'aes-256-cbc': ciphers.includes('aes-256-cbc'),
  };

  // Verify PBKDF2
  try {
    crypto.pbkdf2Sync('test', 'salt', 1, 32, 'sha256');
    supported.pbkdf2 = true;
  } catch (e) {
    supported.pbkdf2 = false;
  }

  return supported;
}

module.exports = {
  encrypt,
  decrypt,
  generateKey,
  deriveKey,
  hash,
  verifyEnvironment,
  ALGORITHM,
  IV_LENGTH,
  KEY_LENGTH,
  PBKDF2_ITERATIONS,
};
