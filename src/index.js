/**
 * env-shield — Zero-config environment variable encryption for Node.js.
 * Drop-in replacement for dotenv.
 *
 * @module env-shield
 */

const fs = require('fs');
const path = require('path');
const { encrypt, decrypt, generateKey } = require('./lib/crypto');
const { parse, serialize } = require('./lib/parser');
const { LocalKeyStore, RemoteKeyStore } = require('./lib/keystore');
const { ensureIgnored } = require('./utils/gitignore');
const { logger } = require('./utils/logger');

/**
 * Load and decrypt environment variables.
 * Drop-in replacement for require('dotenv').config()
 *
 * @param {Object} options
 * @param {string} options.envPath - Path to .env file (default: '.env')
 * @param {string} options.encryptedPath - Path to encrypted file (default: '.env.encrypted')
 * @param {string} options.encoding - File encoding (default: 'utf8')
 * @param {boolean} options.override - Override existing process.env values (default: false)
 * @returns {{ parsed: Object }}
 */
function config(options = {}) {
  const envPath = path.resolve(options.envPath || '.env');
  const encryptedPath = path.resolve(options.encryptedPath || '.env.encrypted');
  const encoding = options.encoding || 'utf8';
  const override = options.override || false;

  const store = new LocalKeyStore();

  // If plaintext .env exists and encrypted doesn't, do initial encryption
  if (fs.existsSync(envPath) && !fs.existsSync(encryptedPath)) {
    logger.info('First run detected — encrypting .env file...');

    const key = store.get() || (() => {
      const newKey = generateKey();
      store.set(newKey);
      return newKey;
    })();

    const content = fs.readFileSync(envPath, encoding);
    const encrypted = encrypt(content, key);
    fs.writeFileSync(encryptedPath, encrypted);

    ensureIgnored('.env');
    logger.success(`Encrypted ${path.basename(envPath)} → ${path.basename(encryptedPath)}`);

    return loadIntoEnv(parse(content), override);
  }

  // Decrypt .env.encrypted and load
  if (fs.existsSync(encryptedPath)) {
    const key = store.get();
    if (!key) {
      logger.error('No encryption key found. Cannot decrypt.');
      return { parsed: {} };
    }

    const encrypted = fs.readFileSync(encryptedPath, encoding);
    try {
      const content = decrypt(encrypted, key);
      return loadIntoEnv(parse(content), override);
    } catch (err) {
      logger.error('Failed to decrypt. Wrong key or corrupted file.');
      logger.debug(err.message);
      return { parsed: {} };
    }
  }

  // Fallback: load .env directly (backwards compat with dotenv)
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, encoding);
    return loadIntoEnv(parse(content), override);
  }

  logger.debug('No .env or .env.encrypted found');
  return { parsed: {} };
}

/**
 * Load parsed variables into process.env
 */
function loadIntoEnv(parsed, override) {
  for (const [key, value] of Object.entries(parsed)) {
    if (override || !(key in process.env)) {
      process.env[key] = value;
    }
  }
  return { parsed };
}

/**
 * Rotate the encryption key
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

  const store = new LocalKeyStore();
  store.set(newKey);

  logger.success('Key rotated. Old file backed up to .env.encrypted.bak');
  return reEncrypted;
}

module.exports = {
  config,
  encrypt,
  decrypt,
  generateKey,
  rotateKey,
};
