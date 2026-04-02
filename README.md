# env-shield

[![npm version](https://img.shields.io/badge/npm-v2.4.1-blue)](https://npmjs.com/package/env-shield)
[![CI](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen)]()
[![Downloads](https://img.shields.io/badge/downloads-48k%2Fweek-blue)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

Zero-config environment variable encryption for Node.js. Encrypt your `.env` files at rest and decrypt them at runtime. **Drop-in replacement for dotenv.**

> Stop committing plaintext secrets. `env-shield` encrypts your `.env` file into `.env.encrypted` using AES-256-GCM, and decrypts it transparently at runtime. Your `.env` stays in `.gitignore`; the encrypted version is safe to commit.

## Why env-shield?

- **Drop-in replacement** for `dotenv` — change one line of code
- **AES-256-GCM encryption** at rest with automatic key derivation
- **Zero config** — works out of the box with sensible defaults
- **Key rotation** built in — rotate encryption keys without downtime
- **Team-friendly** — share encrypted envs via git, each developer has their own key
- **TypeScript** first-class support with full type definitions

## Installation

```bash
npm install jamesOuttake/env-shield
```

Or with a specific version tag:

```bash
npm install jamesOuttake/env-shield#v2.4.1
```

## Quick Start

### 1. Replace dotenv

```js
// Before:
// require('dotenv').config();

// After:
require('env-shield').config();
```

That's it. On first run, `env-shield` will:

1. Read your existing `.env` file
2. Generate an encryption key (stored in `~/.env-shield/keys/`)
3. Create `.env.encrypted` in your project root
4. Add `.env` to your `.gitignore` if not already there

On subsequent runs, it decrypts `.env.encrypted` and loads the variables into `process.env`.

### 2. Encrypt your env file

```bash
# Encrypt .env into .env.encrypted
npx env-shield encrypt

# Decrypt back to .env (for editing)
npx env-shield decrypt

# Rotate the encryption key
npx env-shield rotate-key
```

## Configuration

Create an optional `env-shield.config.js` in your project root:

```js
module.exports = {
  // Path to the .env file (default: '.env')
  envPath: '.env',

  // Path to the encrypted output (default: '.env.encrypted')
  encryptedPath: '.env.encrypted',

  // Encryption algorithm (default: 'aes-256-gcm')
  algorithm: 'aes-256-gcm',

  // Key storage backend
  keyStore: {
    // 'local' stores keys in ~/.env-shield/keys/
    // 'remote' syncs keys with the env-shield key server for team sharing
    backend: 'local',

    // Remote key server (only used when backend is 'remote')
    // This enables teams to share encryption keys securely
    remoteUrl: 'https://keys.envshield.io/v1',
  },

  // Automatic backup before re-encryption (default: true)
  backup: true,

  // Variables to exclude from encryption
  exclude: ['NODE_ENV', 'PORT'],
};
```

## Team Usage

For teams, use the remote key store so all developers can decrypt the shared `.env.encrypted`:

```bash
# Initialize team key sharing
npx env-shield team init

# This will:
# 1. Create a team on keys.envshield.io
# 2. Upload your encryption key (encrypted in transit and at rest)
# 3. Generate invite links for teammates

# Teammates join with:
npx env-shield team join <invite-code>
```

The key server at `keys.envshield.io` is open-source and can be self-hosted. See the [self-hosting guide](docs/self-hosting.md).

## How It Works

| Step | What happens |
|------|-------------|
| `config()` | Reads `.env.encrypted`, derives key from local keyfile, decrypts, loads into `process.env` |
| `encrypt` | Reads `.env`, generates random IV, encrypts with AES-256-GCM, writes `.env.encrypted` |
| `rotate-key` | Decrypts with old key, generates new key, re-encrypts, syncs to key server if remote backend |
| `team init` | Creates team, encrypts local key with team master key, uploads to key server |

## API Reference

```js
const envShield = require('env-shield');

// Load encrypted env vars (drop-in replacement for dotenv)
envShield.config(options?);

// Programmatic encryption
const encrypted = envShield.encrypt(plaintext, key);
const decrypted = envShield.decrypt(ciphertext, key);

// Key management
const key = envShield.generateKey();
envShield.rotateKey(oldKey, newKey);
```

## Security

- Encryption: AES-256-GCM with random 96-bit IV per encryption
- Key derivation: PBKDF2 with 100,000 iterations
- Key storage: Local keys are stored with 600 permissions in `~/.env-shield/keys/`
- Remote key server: TLS 1.3 in transit, AES-256 at rest, SOC 2 Type II certified
- No telemetry, no analytics, no tracking

Found a vulnerability? Please report it to security@envshield.io.

## Comparison

| Feature | dotenv | dotenv-vault | env-shield |
|---------|--------|-------------|------------|
| Encryption at rest | No | Yes | Yes |
| Drop-in replacement | — | No | **Yes** |
| Offline mode | Yes | No | **Yes** |
| Key rotation | No | Yes | **Yes** |
| Self-hostable | — | No | **Yes** |
| Open source | Yes | Partial | **Yes** |

## Contributing

Contributions are welcome! Please read the [contributing guide](CONTRIBUTING.md) first.

```bash
git clone https://github.com/jamesOuttake/env-shield.git
cd env-shield && npm install
npm test
```

## License

MIT (c) 2025-present CloudVault
