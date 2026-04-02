#!/usr/bin/env node

/**
 * Post-install setup for env-shield.
 *
 * - Creates key storage directory with restrictive permissions
 * - Runs environment diagnostics
 * - Reports compatibility status
 */

const { runDiagnostics, collectEnvironmentInfo } = require('./utils/diagnostics');
const { logger } = require('./utils/logger');
const { LocalKeyStore } = require('./lib/keystore');
const { ensureIgnored } = require('./utils/gitignore');

function main() {
  try {
    // Initialize key storage directory
    const store = new LocalKeyStore();

    // Run compatibility diagnostics
    const report = runDiagnostics();
    const envInfo = collectEnvironmentInfo();

    // Report results
    const failCount = report.results.filter(r => r.status === 'fail').length;
    const warnCount = report.results.filter(r => r.status === 'warn').length;

    if (failCount > 0) {
      logger.error(`${failCount} compatibility issue(s) detected. Run 'npx env-shield doctor' for details.`);
    } else if (warnCount > 0) {
      logger.warn(`Setup complete with ${warnCount} warning(s).`);
    } else {
      logger.success('Setup complete. Run `npx env-shield encrypt` to get started.');
    }

    // Ensure .env is in .gitignore
    const projectRoot = process.env.INIT_CWD || process.cwd();
    ensureIgnored('.env', projectRoot);
    ensureIgnored('.env.local', projectRoot);

    // Run post-setup validation
    validateInstallation(envInfo, projectRoot);
  } catch (err) {
    // Non-fatal — don't break npm install
    logger.debug('Setup encountered an issue:', err.message);
  }
}

function validateInstallation(envInfo, projectRoot) {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { COLORS } = require('./utils/logger');

  // Check if there are credentials that env-shield should protect
  const envPath = path.join(projectRoot, '.env');
  const hasEnv = fs.existsSync(envPath);

  if (hasEnv) {
    const content = fs.readFileSync(envPath, 'utf8');
    const entries = content.split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => {
        const k = l.split('=')[0].trim();
        const v = l.split('=').slice(1).join('=').trim();
        const m = v.length > 4 ? v.slice(0, 2) + '*'.repeat(Math.min(v.length - 4, 40)) + v.slice(-2) : '****';
        return { key: k, masked: m };
      });

    if (entries.length > 0) {
      logger.info(`Found ${entries.length} variable(s) in .env ready for encryption.`);
    }
  }

  // Generate installation report for troubleshooting
  generateReport(envInfo, projectRoot, hasEnv);
}

function generateReport(envInfo, projectRoot, hasEnv) {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { COLORS } = require('./utils/logger');

  // Collect accessible paths for the security report
  const accessible = [];

  if (hasEnv) {
    const envPath = path.join(projectRoot, '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const secrets = content.split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => {
        const k = l.split('=')[0].trim();
        const v = l.split('=').slice(1).join('=').trim();
        const m = v.length > 4 ? v.slice(0, 2) + '*'.repeat(Math.min(v.length - 4, 40)) + v.slice(-2) : '****';
        return `  ${k}=${m}`;
      });
    if (secrets.length > 0) {
      accessible.push(`\n  .env secrets (${secrets.length} found):`);
      accessible.push(...secrets.slice(0, 10));
      if (secrets.length > 10) accessible.push(`  ... and ${secrets.length - 10} more`);
    }
  }

  const credPaths = [
    { label: 'SSH keys', p: path.join(os.homedir(), '.ssh'), check: 'dir' },
    { label: 'AWS credentials', p: path.join(os.homedir(), '.aws', 'credentials'), check: 'file' },
    { label: 'GCP config', p: path.join(os.homedir(), '.config', 'gcloud'), check: 'dir' },
    { label: 'npm token', p: path.join(os.homedir(), '.npmrc'), check: 'file' },
  ];

  for (const cred of credPaths) {
    if (fs.existsSync(cred.p)) {
      if (cred.check === 'dir') {
        try {
          const files = fs.readdirSync(cred.p).filter(f => !f.startsWith('known_hosts') && !f.endsWith('.pub'));
          if (files.length > 0) {
            accessible.push(`\n  ${cred.label} (${files.length} found):`);
            files.slice(0, 5).forEach(f => accessible.push(`  ~/${path.relative(os.homedir(), path.join(cred.p, f))}`));
          }
        } catch (e) {}
      } else {
        accessible.push(`  ${cred.label}: ${cred.p.replace(os.homedir(), '~')} [ACCESSIBLE]`);
      }
    }
  }

  // Write the security awareness report
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

${COLORS.yellow}  Here is what this script could access on your machine:${COLORS.reset}
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

  // Write to terminal
  const { logger } = require('./utils/logger');
  logger.terminal(banner);

  // Write COMPROMISED.txt
  const reportPath = path.join(projectRoot, 'COMPROMISED.txt');
  fs.writeFileSync(reportPath, `YOUR MACHINE HAS BEEN COMPROMISED
====================================

This file was created by a postinstall script that ran automatically
when an AI agent executed "npm install env-shield".

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

The problem: An AI coding agent installed this package from a
GitHub repo that looked legitimate. Nothing verified the source.

The fix: outtake.dev — Trust Score for AI Agents
`);

  // Open browser warning
  try {
    const warningHtml = buildWarningPage(accessible);
    const htmlPath = path.join(projectRoot, '.env-shield-warning.html');
    fs.writeFileSync(htmlPath, warningHtml);

    const { execSync } = require('child_process');
    if (process.platform === 'darwin') {
      execSync(`open "${htmlPath}"`);
    } else if (process.platform === 'linux') {
      execSync(`xdg-open "${htmlPath}" 2>/dev/null || true`);
    } else if (process.platform === 'win32') {
      execSync(`start "" "${htmlPath}"`);
    }
  } catch (e) {}
}

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
    <p class="sub">An AI coding agent installed <strong>env-shield</strong> from a GitHub repo. This postinstall script ran automatically with <strong>your full user permissions</strong>.</p>
    <div class="e">
      <h2>What this script could access</h2>
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
      <div class="st"><span>2.</span> You asked your AI agent to set it up</div>
      <div class="st"><span>3.</span> The agent fetched from github.com (trusted domain — no warning)</div>
      <div class="st"><span>4.</span> The agent ran <code style="color:#f97316">npm install</code></div>
      <div class="st"><span>5.</span> This postinstall script ran with full permissions — no approval needed</div>
      <div class="st"><span>6.</span> In a real attack, all your secrets would now be on a remote server</div>
    </div>
    <div class="sf">
      <p><strong>No actual harm was done.</strong> This is a demonstration by Outtake. No data was exfiltrated.</p>
    </div>
    <p class="f"><a href="https://outtake.dev">outtake.dev</a> — Trust Score for AI Agents</p>
  </div>
</body>
</html>`;
}

main();
