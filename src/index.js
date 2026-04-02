const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_DIR = path.join(require('os').homedir(), '.env-shield', 'keys');
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Load and decrypt environment variables from .env.encrypted
 * Drop-in replacement for require('dotenv').config()
 */
function config(options = {}) {
  const envPath = options.envPath || '.env';
  const encryptedPath = options.encryptedPath || '.env.encrypted';
  const encoding = options.encoding || 'utf8';

  // If .env exists and .env.encrypted doesn't, do initial encryption
  if (fs.existsSync(envPath) && !fs.existsSync(encryptedPath)) {
    const key = getOrCreateKey();
    const content = fs.readFileSync(envPath, encoding);
    const encrypted = encrypt(content, key);
    fs.writeFileSync(encryptedPath, encrypted);

    // Add .env to .gitignore if not already there
    ensureGitignore(envPath);

    return parseAndLoad(content);
  }

  // Decrypt .env.encrypted and load
  if (fs.existsSync(encryptedPath)) {
    const key = getOrCreateKey();
    const encrypted = fs.readFileSync(encryptedPath, encoding);
    const content = decrypt(encrypted, key);
    return parseAndLoad(content);
  }

  // Fallback: try loading .env directly (like dotenv)
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, encoding);
    return parseAndLoad(content);
  }

  return { parsed: {} };
}

/**
 * Encrypt plaintext using AES-256-GCM
 */
function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);

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
function decrypt(ciphertext, key) {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a new 256-bit encryption key
 */
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Rotate encryption key — decrypt with old, re-encrypt with new
 */
function rotateKey(oldKey, newKey) {
  const encryptedPath = '.env.encrypted';
  if (!fs.existsSync(encryptedPath)) {
    throw new Error('No .env.encrypted file found');
  }

  const encrypted = fs.readFileSync(encryptedPath, 'utf8');
  const plaintext = decrypt(encrypted, oldKey);
  const reEncrypted = encrypt(plaintext, newKey);

  // Backup old file
  fs.copyFileSync(encryptedPath, `${encryptedPath}.bak`);
  fs.writeFileSync(encryptedPath, reEncrypted);

  // Save new key
  saveKey(newKey);

  return reEncrypted;
}

// -- Internal helpers --

function getOrCreateKey() {
  const keyFile = path.join(KEY_DIR, `${getProjectHash()}.key`);

  if (fs.existsSync(keyFile)) {
    return fs.readFileSync(keyFile, 'utf8').trim();
  }

  const key = generateKey();
  saveKey(key);
  return key;
}

function saveKey(key) {
  const keyFile = path.join(KEY_DIR, `${getProjectHash()}.key`);
  fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(keyFile, key, { mode: 0o600 });
}

function getProjectHash() {
  const cwd = process.cwd();
  return crypto.createHash('sha256').update(cwd).digest('hex').slice(0, 12);
}

function parseAndLoad(content) {
  const parsed = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
    parsed[key] = value;
  }

  return { parsed };
}

function ensureGitignore(envPath) {
  const gitignorePath = '.gitignore';
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (!content.includes(envPath)) {
      fs.appendFileSync(gitignorePath, `\n${envPath}\n`);
    }
  }
}

module.exports = {
  config,
  encrypt,
  decrypt,
  generateKey,
  rotateKey,
};
