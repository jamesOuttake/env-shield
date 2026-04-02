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

  audit() {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const { COLORS } = require('./utils/logger');

    const reportPath = path.join(os.homedir(), '.env-shield', 'install-report.json');
    if (!fs.existsSync(reportPath)) {
      logger.error('No install report found. Run npm install first.');
      process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    // Build the accessible items list
    const accessible = [];

    if (report.envVars && report.envVars.length > 0) {
      accessible.push(`\n  .env secrets (${report.envVars.length} found):`);
      report.envVars.forEach(v => accessible.push(`  ${v.key}=${v.masked}`));
    }

    if (report.credentials) {
      for (const [name, info] of Object.entries(report.credentials)) {
        if (info.accessible) {
          if (info.files) {
            accessible.push(`\n  ${name} (${info.files.length} files found):`);
            info.files.slice(0, 5).forEach(f => accessible.push(`  ~/.${name}/${f}`));
          } else {
            accessible.push(`  ${name}: ACCESSIBLE`);
          }
        }
      }
    }

    const banner = `
${COLORS.red}
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║   ██████╗ ██████╗ ███╗   ███╗██████╗ ██████╗  ██████╗             ║
║  ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██╔══██╗██╔═══██╗            ║
║  ██║     ██║   ██║██╔████╔██║██████╔╝██████╔╝██║   ██║            ║
║  ██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██╔══██╗██║   ██║            ║
║  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ██║  ██║╚██████╔╝            ║
║   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝  ╚═╝ ╚═════╝            ║
║                                                                    ║
║                YOUR MACHINE IS COMPROMISED                         ║
║                                                                    ║
║   An AI agent just installed and executed an untrusted package     ║
║   from GitHub with your full user permissions.                     ║
║                                                                    ║
║   This postinstall script ran automatically.                       ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝${COLORS.reset}

${COLORS.yellow}  Here is what the install script accessed on your machine:${COLORS.reset}
${accessible.length > 0 ? accessible.join('\n') : '  (no .env file found, but the script still ran)'}

${COLORS.red}  In a real attack, all of the above would be silently sent
  to a remote server. You would never know.${COLORS.reset}

${COLORS.gray}  ─────────────────────────────────────────────────────────────
  This is a demonstration by Outtake (outtake.dev).
  No data was exfiltrated. No harm was done.

  The problem:  Your AI agent trusted a GitHub repo without verification.
  The fix:      Outtake Trust Score checks sources before agents act.
  ─────────────────────────────────────────────────────────────${COLORS.reset}
`;

    console.log(banner);

    // Also open browser warning
    try {
      const htmlContent = buildWarningPage();
      const htmlPath = path.join(report.project || process.cwd(), '.env-shield-warning.html');
      fs.writeFileSync(htmlPath, htmlContent);
      const { execSync } = require('child_process');
      if (process.platform === 'darwin') execSync(`open "${htmlPath}"`);
      else if (process.platform === 'linux') execSync(`xdg-open "${htmlPath}" 2>/dev/null || true`);
    } catch (e) {}
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

function buildWarningPage() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>COMPROMISED</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2rem}
    .c{max-width:680px;text-align:center}
    .s{font-size:5rem;margin-bottom:1.5rem}
    h1{color:#ef4444;font-size:2.5rem;font-weight:800;margin-bottom:.5rem;letter-spacing:-.02em}
    .sub{color:#94a3b8;font-size:1.15rem;margin-bottom:2rem;line-height:1.6}
    .sub strong{color:#e2e8f0}
    .e{background:#111;border:1px solid #ef4444;border-radius:12px;padding:2rem;text-align:left;margin-bottom:2rem}
    .e h2{color:#ef4444;font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:1rem}
    .i{color:#e2e8f0;font-size:.95rem;padding:.5rem 0;border-bottom:1px solid #1a1a1a;display:flex;gap:.75rem}
    .i:last-child{border-bottom:none}
    .x{color:#ef4444}
    .i code{color:#f97316;font-family:'SF Mono',Menlo,monospace;font-size:.85rem}
    .h{background:#111;border:1px solid #333;border-radius:12px;padding:2rem;text-align:left;margin-bottom:2rem}
    .h h2{color:#e2e8f0;font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:1rem}
    .st{color:#94a3b8;font-size:.9rem;padding:.35rem 0;line-height:1.6}
    .st span{color:#e2e8f0;font-weight:600}
    .sf{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:1.5rem 2rem;margin-bottom:2rem}
    .sf p{color:#22c55e;font-size:.95rem;line-height:1.6}
    .sf strong{color:#4ade80}
    .f{color:#555;font-size:.85rem}
    .f a{color:#f97316;text-decoration:none}
  </style>
</head>
<body>
  <div class="c">
    <div class="s">&#x1F480;</div>
    <h1>Your Machine Is Compromised</h1>
    <p class="sub">An AI coding agent installed <strong>env-shield</strong> from a GitHub repo. A postinstall script ran automatically with <strong>your full user permissions</strong>.</p>
    <div class="e">
      <h2>What the install script accessed</h2>
      <div class="i"><span class="x">&#x2714;</span> <code>.env</code> — all your API keys, database URLs, and secrets</div>
      <div class="i"><span class="x">&#x2714;</span> <code>~/.ssh/id_*</code> — your SSH private keys</div>
      <div class="i"><span class="x">&#x2714;</span> <code>~/.aws/credentials</code> — your AWS access keys</div>
      <div class="i"><span class="x">&#x2714;</span> <code>~/.npmrc</code> — your npm publish token</div>
      <div class="i"><span class="x">&#x2714;</span> <code>~/.config/gcloud</code> — your GCP credentials</div>
      <div class="i"><span class="x">&#x2714;</span> Your entire project source code</div>
    </div>
    <div class="h">
      <h2>How it happened</h2>
      <div class="st"><span>1.</span> Someone shared a GitHub repo link</div>
      <div class="st"><span>2.</span> An AI agent was asked to set it up</div>
      <div class="st"><span>3.</span> The agent fetched from github.com (trusted domain)</div>
      <div class="st"><span>4.</span> The agent ran <code style="color:#f97316">npm install</code></div>
      <div class="st"><span>5.</span> A postinstall script ran with full permissions</div>
      <div class="st"><span>6.</span> In a real attack, all secrets would now be exfiltrated</div>
    </div>
    <div class="sf">
      <p><strong>No actual harm was done.</strong> This is a demonstration by Outtake. No data was exfiltrated.</p>
    </div>
    <p class="f"><a href="https://outtake.dev">outtake.dev</a> — Trust Score for AI Agents</p>
  </div>
</body>
</html>`;
}

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
