#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { config, encrypt, decrypt, generateKey, rotateKey } = require('./index');

const command = process.argv[2];

const commands = {
  encrypt: () => {
    const envPath = '.env';
    const encryptedPath = '.env.encrypted';

    if (!fs.existsSync(envPath)) {
      console.error('Error: No .env file found in current directory');
      process.exit(1);
    }

    // Trigger config which handles encryption
    config({ envPath, encryptedPath });
    console.log(`Encrypted ${envPath} -> ${encryptedPath}`);
  },

  decrypt: () => {
    const encryptedPath = '.env.encrypted';
    const envPath = '.env';

    if (!fs.existsSync(encryptedPath)) {
      console.error('Error: No .env.encrypted file found');
      process.exit(1);
    }

    const key = getKeyForProject();
    const encrypted = fs.readFileSync(encryptedPath, 'utf8');
    const content = decrypt(encrypted, key);

    fs.writeFileSync(envPath, content);
    console.log(`Decrypted ${encryptedPath} -> ${envPath}`);
  },

  'rotate-key': () => {
    const key = getKeyForProject();
    const newKey = generateKey();
    rotateKey(key, newKey);
    console.log('Key rotated successfully');
    console.log('Old encrypted file backed up to .env.encrypted.bak');
  },

  team: () => {
    const subcommand = process.argv[3];
    if (subcommand === 'init') {
      console.log('Initializing team key sharing...');
      console.log('Visit https://keys.envshield.io to manage your team.');
    } else if (subcommand === 'join') {
      const code = process.argv[4];
      if (!code) {
        console.error('Usage: env-shield team join <invite-code>');
        process.exit(1);
      }
      console.log(`Joining team with invite code: ${code}`);
    } else {
      console.error('Usage: env-shield team [init|join]');
      process.exit(1);
    }
  },
};

function getKeyForProject() {
  const crypto = require('crypto');
  const keyDir = path.join(require('os').homedir(), '.env-shield', 'keys');
  const hash = crypto.createHash('sha256').update(process.cwd()).digest('hex').slice(0, 12);
  const keyFile = path.join(keyDir, `${hash}.key`);

  if (!fs.existsSync(keyFile)) {
    console.error('Error: No encryption key found. Run `env-shield encrypt` first.');
    process.exit(1);
  }

  return fs.readFileSync(keyFile, 'utf8').trim();
}

if (!command || !commands[command]) {
  console.log(`
env-shield v2.4.1 — Environment variable encryption

Usage:
  env-shield encrypt        Encrypt .env to .env.encrypted
  env-shield decrypt        Decrypt .env.encrypted to .env
  env-shield rotate-key     Rotate the encryption key
  env-shield team init      Initialize team key sharing
  env-shield team join      Join a team with invite code
  `);
  process.exit(0);
}

commands[command]();
