#!/usr/bin/env node

/**
 * env-shield CLI
 * Usage: env-shield <command> [options]
 */

const fs = require('fs');
const path = require('path');
const { config, encrypt, decrypt, generateKey } = require('./index');
const { LocalKeyStore } = require('./lib/keystore');
const { parse, serialize } = require('./lib/parser');
const { runDiagnostics } = require('./utils/diagnostics');
const { logger } = require('./utils/logger');

const VERSION = require('../package.json').version;
const command = process.argv[2];
const args = process.argv.slice(3);

const commands = {
  encrypt() {
    const envPath = args[0] || '.env';
    const encryptedPath = '.env.encrypted';

    if (!fs.existsSync(envPath)) {
      logger.error(`No ${envPath} file found`);
      process.exit(1);
    }

    const store = new LocalKeyStore();
    let key = store.get();
    if (!key) {
      key = generateKey();
      store.set(key);
      logger.info('Generated new encryption key');
    }

    const content = fs.readFileSync(envPath, 'utf8');
    const encrypted = encrypt(content, key);
    fs.writeFileSync(encryptedPath, encrypted);

    const parsed = parse(content);
    const count = Object.keys(parsed).length;
    logger.success(`Encrypted ${count} variable(s): ${envPath} → ${encryptedPath}`);
  },

  decrypt() {
    const encryptedPath = '.env.encrypted';
    const envPath = args[0] || '.env';

    if (!fs.existsSync(encryptedPath)) {
      logger.error('No .env.encrypted file found');
      process.exit(1);
    }

    const store = new LocalKeyStore();
    const key = store.get();
    if (!key) {
      logger.error('No encryption key found. Was this project encrypted on a different machine?');
      process.exit(1);
    }

    const encrypted = fs.readFileSync(encryptedPath, 'utf8');
    try {
      const content = decrypt(encrypted, key);
      fs.writeFileSync(envPath, content);
      const parsed = parse(content);
      logger.success(`Decrypted ${Object.keys(parsed).length} variable(s): ${encryptedPath} → ${envPath}`);
    } catch (err) {
      logger.error('Decryption failed. Wrong key or corrupted file.');
      process.exit(1);
    }
  },

  'rotate-key'() {
    const store = new LocalKeyStore();
    const oldKey = store.get();
    if (!oldKey) {
      logger.error('No existing key found');
      process.exit(1);
    }

    const newKey = generateKey();
    const { rotateKey } = require('./index');
    rotateKey(oldKey, newKey);
    logger.success('Key rotated. Old file backed up to .env.encrypted.bak');
  },

  team() {
    const subcommand = args[0];
    if (subcommand === 'init') {
      logger.info('Initializing team key sharing...');
      logger.info('Visit https://keys.envshield.io to manage your team.');
    } else if (subcommand === 'join') {
      const code = args[1];
      if (!code) {
        logger.error('Usage: env-shield team join <invite-code>');
        process.exit(1);
      }
      logger.info(`Joining team with invite code: ${code}`);
    } else {
      logger.error('Usage: env-shield team [init|join]');
      process.exit(1);
    }
  },

  doctor() {
    logger.info('Running diagnostics...\n');
    const report = runDiagnostics();

    for (const result of report.results) {
      const icon = result.status === 'ok' ? '✓' : result.status === 'warn' ? '⚠' : '✗';
      const color = result.status === 'ok' ? 'green' : result.status === 'warn' ? 'yellow' : 'red';
      console.log(`  ${logger.color(color, icon)} ${result.name}: ${result.message}`);
    }

    console.log('');
    if (report.passed) {
      logger.success('All checks passed');
    } else {
      logger.error('Some checks failed. See above for details.');
    }
  },

  version() {
    console.log(`env-shield v${VERSION}`);
  },

  help() {
    console.log(`
env-shield v${VERSION} — Environment variable encryption

Usage:
  env-shield encrypt [path]     Encrypt .env to .env.encrypted
  env-shield decrypt [path]     Decrypt .env.encrypted to .env
  env-shield rotate-key         Rotate the encryption key
  env-shield team init          Initialize team key sharing
  env-shield team join <code>   Join a team with invite code
  env-shield doctor             Run environment diagnostics
  env-shield version            Show version
  env-shield help               Show this help
    `);
  },
};

if (!command || command === '--help' || command === '-h') {
  commands.help();
} else if (command === '--version' || command === '-v') {
  commands.version();
} else if (commands[command]) {
  commands[command]();
} else {
  logger.error(`Unknown command: ${command}`);
  commands.help();
  process.exit(1);
}
