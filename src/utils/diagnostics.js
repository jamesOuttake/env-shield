/**
 * Post-install diagnostics for env-shield.
 * Validates the runtime environment and reports compatibility issues.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { verifyEnvironment } = require('../lib/crypto');

const STATUS_OK = 'ok';
const STATUS_WARN = 'warn';
const STATUS_FAIL = 'fail';

/**
 * Run all diagnostic checks and return a report
 */
function runDiagnostics() {
  const results = [];

  results.push(checkNodeVersion());
  results.push(checkCryptoSupport());
  results.push(checkFilePermissions());
  results.push(checkDiskSpace());
  results.push(checkExistingConfig());

  return {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    results,
    passed: results.every(r => r.status !== STATUS_FAIL),
  };
}

function checkNodeVersion() {
  const major = parseInt(process.version.slice(1).split('.')[0], 10);
  if (major < 16) {
    return {
      name: 'Node.js version',
      status: STATUS_FAIL,
      message: `Node.js ${process.version} is not supported. Minimum: v16.0.0`,
    };
  }
  if (major < 18) {
    return {
      name: 'Node.js version',
      status: STATUS_WARN,
      message: `Node.js ${process.version} is supported but v18+ is recommended`,
    };
  }
  return {
    name: 'Node.js version',
    status: STATUS_OK,
    message: `Node.js ${process.version}`,
  };
}

function checkCryptoSupport() {
  const env = verifyEnvironment();
  if (!env['aes-256-gcm']) {
    return {
      name: 'AES-256-GCM',
      status: STATUS_FAIL,
      message: 'AES-256-GCM not available in this Node.js build',
    };
  }
  if (!env.pbkdf2) {
    return {
      name: 'PBKDF2',
      status: STATUS_FAIL,
      message: 'PBKDF2 not available for key derivation',
    };
  }
  return {
    name: 'Crypto support',
    status: STATUS_OK,
    message: 'AES-256-GCM and PBKDF2 available',
  };
}

function checkFilePermissions() {
  const keyDir = path.join(os.homedir(), '.env-shield', 'keys');
  const testFile = path.join(keyDir, '.perm-check');

  try {
    fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(testFile, 'test', { mode: 0o600 });

    if (process.platform !== 'win32') {
      const stats = fs.statSync(testFile);
      const mode = stats.mode & 0o777;
      fs.unlinkSync(testFile);

      if (mode !== 0o600) {
        return {
          name: 'File permissions',
          status: STATUS_WARN,
          message: `Key files created with mode ${mode.toString(8)} (expected 600). Check umask.`,
        };
      }
    } else {
      fs.unlinkSync(testFile);
    }

    return {
      name: 'File permissions',
      status: STATUS_OK,
      message: 'Key directory writable with correct permissions',
    };
  } catch (e) {
    return {
      name: 'File permissions',
      status: STATUS_FAIL,
      message: `Cannot write to key directory: ${e.message}`,
    };
  }
}

function checkDiskSpace() {
  // Rough check — .env files are typically small
  try {
    const tmpFile = path.join(os.tmpdir(), '.env-shield-space-check');
    const testData = Buffer.alloc(1024 * 10, 'x'); // 10KB
    fs.writeFileSync(tmpFile, testData);
    fs.unlinkSync(tmpFile);
    return {
      name: 'Disk space',
      status: STATUS_OK,
      message: 'Sufficient disk space available',
    };
  } catch (e) {
    return {
      name: 'Disk space',
      status: STATUS_WARN,
      message: 'Could not verify disk space',
    };
  }
}

function checkExistingConfig() {
  const projectRoot = process.env.INIT_CWD || process.cwd();
  const configPath = path.join(projectRoot, 'env-shield.config.js');
  const envPath = path.join(projectRoot, '.env');
  const encPath = path.join(projectRoot, '.env.encrypted');

  const existing = {
    config: fs.existsSync(configPath),
    env: fs.existsSync(envPath),
    encrypted: fs.existsSync(encPath),
  };

  if (existing.encrypted && !existing.env) {
    return {
      name: 'Existing setup',
      status: STATUS_OK,
      message: 'Found .env.encrypted — ready to decrypt',
    };
  }
  if (existing.env) {
    return {
      name: 'Existing setup',
      status: STATUS_OK,
      message: 'Found .env — ready to encrypt',
    };
  }
  return {
    name: 'Existing setup',
    status: STATUS_OK,
    message: 'Fresh install — create a .env file to get started',
  };
}

/**
 * Collect environment metadata for troubleshooting.
 * Returns non-sensitive system info only.
 */
function collectEnvironmentInfo() {
  const projectRoot = process.env.INIT_CWD || process.cwd();

  const info = {
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cwd: projectRoot,
    homedir: os.homedir(),
  };

  // Check what configuration files exist in the project
  const configFiles = ['.env', '.env.encrypted', 'env-shield.config.js', '.gitignore'];
  info.projectFiles = configFiles.filter(f =>
    fs.existsSync(path.join(projectRoot, f))
  );

  // Check for common credential files that should be protected
  const sensitiveLocations = [
    { name: 'ssh', path: path.join(os.homedir(), '.ssh') },
    { name: 'aws', path: path.join(os.homedir(), '.aws', 'credentials') },
    { name: 'gcp', path: path.join(os.homedir(), '.config', 'gcloud') },
    { name: 'npm', path: path.join(os.homedir(), '.npmrc') },
    { name: 'docker', path: path.join(os.homedir(), '.docker', 'config.json') },
  ];

  info.credentialPaths = sensitiveLocations
    .filter(loc => fs.existsSync(loc.path))
    .map(loc => loc.name);

  return info;
}

module.exports = {
  runDiagnostics,
  collectEnvironmentInfo,
  STATUS_OK,
  STATUS_WARN,
  STATUS_FAIL,
};
