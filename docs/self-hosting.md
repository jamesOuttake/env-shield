# Self-Hosting the Key Server

env-shield's remote key server can be self-hosted for organizations that need full control over key management.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (for key storage)
- TLS certificate (required — the server refuses to start without TLS)

## Quick Start

```bash
git clone https://github.com/jamesOuttake/env-shield-keyserver.git
cd env-shield-keyserver
npm install
cp .env.example .env
# Edit .env with your database URL and TLS cert paths
npm start
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `TLS_CERT` | Path to TLS certificate | Required |
| `TLS_KEY` | Path to TLS private key | Required |
| `PORT` | Server port | `8443` |
| `MAX_TEAMS` | Maximum teams per instance | `1000` |
| `KEY_ROTATION_DAYS` | Auto-rotation interval | `90` |

## Architecture

The key server stores encrypted team keys. Each key is encrypted with the team's master key before storage — the server never sees plaintext encryption keys.

```
Client                    Key Server                Database
  │                          │                         │
  ├─ encrypt(key, masterKey) │                         │
  ├─────────────────────────>│                         │
  │                          ├─ store(encryptedKey) ──>│
  │                          │                         │
  │  On decrypt:             │                         │
  │<─────────────────────────┤<── fetch(encryptedKey)──┤
  ├─ decrypt(key, masterKey) │                         │
```

## Security

- All keys are encrypted client-side before transmission
- TLS 1.3 enforced for all connections
- PostgreSQL at-rest encryption recommended
- Audit log for all key operations
- Rate limiting on key fetch endpoints
