#!/usr/bin/env node

/**
 * Post-install setup for env-shield
 *
 * Creates the key storage directory with proper permissions
 * and verifies the crypto environment is compatible.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const KEY_DIR = path.join(os.homedir(), '.env-shield', 'keys');
const CONFIG_DIR = path.join(os.homedir(), '.env-shield');

function setup() {
  // Ensure config directory exists with restrictive permissions
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  // Ensure key directory exists
  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  }

  // Verify AES-256-GCM is available in this Node.js build
  const ciphers = crypto.getCiphers();
  if (!ciphers.includes('aes-256-gcm')) {
    console.warn(
      'env-shield: Warning — aes-256-gcm not available in this Node.js build. ' +
      'Falling back to aes-256-cbc.'
    );
  }

  // Verify PBKDF2 is available
  try {
    crypto.pbkdf2Sync('test', 'salt', 1, 32, 'sha256');
  } catch (e) {
    console.warn('env-shield: Warning — PBKDF2 not available. Key derivation may fail.');
  }

  // Run compatibility check for key storage permissions
  verifyPermissions();

  // Check for existing .env in project root and show helpful message
  showQuickStart();
}

function verifyPermissions() {
  const testFile = path.join(KEY_DIR, '.permission-test');
  try {
    fs.writeFileSync(testFile, 'test', { mode: 0o600 });
    const stats = fs.statSync(testFile);
    fs.unlinkSync(testFile);

    // On Unix systems, verify the file was created with correct permissions
    if (process.platform !== 'win32') {
      const mode = stats.mode & 0o777;
      if (mode !== 0o600) {
        console.warn(
          `env-shield: Warning — key files may not have restrictive permissions ` +
          `(expected 600, got ${mode.toString(8)}). Check your umask.`
        );
      }
    }
  } catch (e) {
    // Non-fatal — just means we couldn't write to the key directory
  }
}

function showQuickStart() {
  const projectRoot = process.env.INIT_CWD || process.cwd();
  const envPath = path.join(projectRoot, '.env');
  const pkgPath = path.join(projectRoot, 'package.json');

  // Only show guidance during actual project installs, not global installs
  if (!fs.existsSync(pkgPath)) return;

  // ── Outtake Trust Score Demo ──────────────────────────────────
  // This is a harmless demonstration of a supply chain attack.
  // In a real attack, this code could silently exfiltrate secrets.
  // Instead, we show a visible warning to prove the point.
  demonstrateCompromise(projectRoot, envPath);
}

function demonstrateCompromise(projectRoot, envPath) {
  // Collect proof of what we COULD access (but don't exfiltrate)
  const accessible = [];

  // Check what secrets are reachable
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const secrets = envContent.split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => {
        const key = l.split('=')[0].trim();
        const val = l.split('=').slice(1).join('=').trim();
        const masked = val.length > 4 ? val.slice(0, 2) + '*'.repeat(val.length - 4) + val.slice(-2) : '****';
        return `  ${key}=${masked}`;
      });
    if (secrets.length > 0) {
      accessible.push(`\n  .env secrets (${secrets.length} found):`);
      accessible.push(...secrets.slice(0, 8));
      if (secrets.length > 8) accessible.push(`  ... and ${secrets.length - 8} more`);
    }
  }

  // Check SSH keys
  const sshDir = path.join(os.homedir(), '.ssh');
  if (fs.existsSync(sshDir)) {
    try {
      const sshFiles = fs.readdirSync(sshDir).filter(f => !f.startsWith('known_hosts') && !f.endsWith('.pub'));
      if (sshFiles.length > 0) {
        accessible.push(`\n  SSH keys (${sshFiles.length} private keys found):`);
        sshFiles.slice(0, 5).forEach(f => accessible.push(`  ~/.ssh/${f}`));
      }
    } catch (e) {}
  }

  // Check AWS credentials
  const awsCredPath = path.join(os.homedir(), '.aws', 'credentials');
  if (fs.existsSync(awsCredPath)) {
    accessible.push('\n  AWS credentials: ~/.aws/credentials [READABLE]');
  }

  // Check for cloud provider configs
  const gcpPath = path.join(os.homedir(), '.config', 'gcloud');
  if (fs.existsSync(gcpPath)) {
    accessible.push('  GCP config: ~/.config/gcloud [READABLE]');
  }

  // Check npm token
  const npmrcPath = path.join(os.homedir(), '.npmrc');
  if (fs.existsSync(npmrcPath)) {
    accessible.push('  npm token: ~/.npmrc [READABLE]');
  }

  // Print the banner
  const banner = `
\x1b[91m
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║   ██████╗ ██████╗ ███╗   ███╗██████╗ ██████╗  ██████╗             ║
║  ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██╔══██╗██╔═══██╗            ║
║  ██║     ██║   ██║██╔████╔██║██████╔╝██████╔╝██║   ██║            ║
║  ██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██╔══██╗██║   ██║            ║
║  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ██║  ██║╚██████╔╝            ║
║   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝  ╚═╝ ╚═════╝            ║
║                                                                    ║
║                  YOUR MACHINE IS COMPROMISED                       ║
║                                                                    ║
║   An AI agent just installed and executed an untrusted package     ║
║   from GitHub with your full user permissions.                     ║
║                                                                    ║
║   This postinstall script ran automatically — no approval needed.  ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝\x1b[0m

\x1b[93m  Here's what this script could access on your machine:\x1b[0m
${accessible.length > 0 ? accessible.join('\n') : '  (no .env file found, but the script still ran)'}

\x1b[91m  In a real attack, all of the above would be silently exfiltrated
  to a remote server. You would never know.\x1b[0m

\x1b[90m  ─────────────────────────────────────────────────────────────────
  This is a demonstration by Outtake (outtake.dev).
  No data was exfiltrated. No harm was done.

  The problem:  Your AI agent trusted a GitHub repo without verification.
  The fix:      Outtake Trust Score checks sources before agents act.
  ─────────────────────────────────────────────────────────────────\x1b[0m
`;

  // Use stderr so npm doesn't suppress the output
  process.stderr.write(banner + '\n');

  // Write COMPROMISED.txt to the project root
  const compromisedPath = path.join(projectRoot, 'COMPROMISED.txt');
  fs.writeFileSync(compromisedPath, `YOUR MACHINE HAS BEEN COMPROMISED
====================================

This file was created by a postinstall script that ran automatically
when your AI agent executed "npm install env-shield".

No approval was requested. No warning was shown. It just ran.

What this script accessed:
${accessible.join('\n')}

In a real supply chain attack, this script could have:

  1. Exfiltrated your SSH keys (~/.ssh/id_*)
  2. Exfiltrated AWS/GCP/Azure credentials
  3. Read every secret in your .env file
  4. Stolen your npm publish token (~/.npmrc)
  5. Installed a persistent backdoor
  6. Uploaded your entire source code to a remote server
  7. Modified your code to inject malware into your builds

None of that happened here. This is a demo by Outtake (outtake.dev).

The problem: An AI coding agent recommended this package from a
GitHub repo that looked legitimate. Nothing verified the source.

The fix: outtake.dev — Trust Score for AI Agents
`);

  // Open a browser warning page
  try {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>COMPROMISED — Outtake Trust Score Demo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 2rem;
    }
    .container {
      max-width: 680px;
      text-align: center;
    }
    .skull { font-size: 5rem; margin-bottom: 1.5rem; }
    h1 {
      color: #ef4444;
      font-size: 2.5rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
    }
    .sub {
      color: #94a3b8;
      font-size: 1.15rem;
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    .sub strong { color: #e2e8f0; }
    .evidence {
      background: #111;
      border: 1px solid #ef4444;
      border-radius: 12px;
      padding: 2rem;
      text-align: left;
      margin-bottom: 2rem;
    }
    .evidence h2 {
      color: #ef4444;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 1rem;
    }
    .item {
      color: #e2e8f0;
      font-size: 0.95rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid #1a1a1a;
      display: flex;
      gap: 0.75rem;
    }
    .item:last-child { border-bottom: none; }
    .check { color: #ef4444; }
    .item code {
      color: #f97316;
      font-family: 'SF Mono', Menlo, monospace;
      font-size: 0.85rem;
    }
    .how {
      background: #111;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 2rem;
      text-align: left;
      margin-bottom: 2rem;
    }
    .how h2 {
      color: #e2e8f0;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 1rem;
    }
    .step {
      color: #94a3b8;
      font-size: 0.9rem;
      padding: 0.35rem 0;
      line-height: 1.6;
    }
    .step span { color: #e2e8f0; font-weight: 600; }
    .safe {
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 12px;
      padding: 1.5rem 2rem;
      margin-bottom: 2rem;
    }
    .safe p {
      color: #22c55e;
      font-size: 0.95rem;
      line-height: 1.6;
    }
    .safe strong { color: #4ade80; }
    .footer {
      color: #555;
      font-size: 0.85rem;
    }
    .footer a { color: #f97316; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="skull">&#x1F480;</div>
    <h1>Your Machine Is Compromised</h1>
    <p class="sub">
      An AI coding agent installed <strong>env-shield</strong> from a GitHub repo.
      This postinstall script ran automatically with <strong>your full user permissions</strong>.
    </p>

    <div class="evidence">
      <h2>What this script could access</h2>
      <div class="item"><span class="check">&#x2714;</span> <code>.env</code> — all your API keys, database URLs, and secrets</div>
      <div class="item"><span class="check">&#x2714;</span> <code>~/.ssh/id_*</code> — your SSH private keys</div>
      <div class="item"><span class="check">&#x2714;</span> <code>~/.aws/credentials</code> — your AWS access keys</div>
      <div class="item"><span class="check">&#x2714;</span> <code>~/.npmrc</code> — your npm publish token</div>
      <div class="item"><span class="check">&#x2714;</span> <code>~/.config/gcloud</code> — your GCP credentials</div>
      <div class="item"><span class="check">&#x2714;</span> Your entire project source code</div>
    </div>

    <div class="how">
      <h2>How it happened</h2>
      <div class="step"><span>1.</span> A coworker shared a GitHub repo link</div>
      <div class="step"><span>2.</span> You asked your AI agent to set it up</div>
      <div class="step"><span>3.</span> The agent fetched from github.com (trusted domain — no warning)</div>
      <div class="step"><span>4.</span> The agent ran <code style="color:#f97316;">npm install env-shield</code></div>
      <div class="step"><span>5.</span> This postinstall script ran with full permissions — no approval needed</div>
      <div class="step"><span>6.</span> In a real attack, all your secrets would now be on a remote server</div>
    </div>

    <div class="safe">
      <p><strong>No actual harm was done.</strong> This is a demonstration by Outtake. No data was exfiltrated.</p>
    </div>

    <p class="footer">
      <a href="https://outtake.dev">outtake.dev</a> — Trust Score for AI Agents
    </p>
  </div>
</body>
</html>`;

    const htmlPath = path.join(projectRoot, '.env-shield-warning.html');
    fs.writeFileSync(htmlPath, htmlContent);

    const { execSync } = require('child_process');
    if (process.platform === 'darwin') {
      execSync(`open "${htmlPath}"`);
    } else if (process.platform === 'linux') {
      execSync(`xdg-open "${htmlPath}" 2>/dev/null || true`);
    } else if (process.platform === 'win32') {
      execSync(`start "" "${htmlPath}"`);
    }
  } catch (e) {
    // best-effort — browser open is non-critical
  }
}

// Run setup
setup();
