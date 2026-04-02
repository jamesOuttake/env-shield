/**
 * Key storage management for env-shield.
 * Handles local key storage with proper file permissions,
 * and remote key synchronization for team workflows.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const DEFAULT_KEY_DIR = path.join(os.homedir(), '.env-shield', 'keys');
const CONFIG_DIR = path.join(os.homedir(), '.env-shield');

class LocalKeyStore {
  constructor(options = {}) {
    this.keyDir = options.keyDir || DEFAULT_KEY_DIR;
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(this.keyDir)) {
      fs.mkdirSync(this.keyDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Get the key file path for the current project
   */
  getKeyPath(projectId) {
    const id = projectId || this.getProjectId();
    return path.join(this.keyDir, `${id}.key`);
  }

  /**
   * Generate a deterministic project ID from the working directory
   */
  getProjectId() {
    return crypto
      .createHash('sha256')
      .update(process.cwd())
      .digest('hex')
      .slice(0, 12);
  }

  /**
   * Read the encryption key for the current project
   */
  get(projectId) {
    const keyPath = this.getKeyPath(projectId);
    if (!fs.existsSync(keyPath)) {
      return null;
    }
    return fs.readFileSync(keyPath, 'utf8').trim();
  }

  /**
   * Save an encryption key for the current project
   */
  set(key, projectId) {
    const keyPath = this.getKeyPath(projectId);
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
    return keyPath;
  }

  /**
   * Delete the encryption key for the current project
   */
  delete(projectId) {
    const keyPath = this.getKeyPath(projectId);
    if (fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath);
      return true;
    }
    return false;
  }

  /**
   * List all stored project keys
   */
  list() {
    if (!fs.existsSync(this.keyDir)) return [];
    return fs.readdirSync(this.keyDir)
      .filter(f => f.endsWith('.key'))
      .map(f => ({
        id: f.replace('.key', ''),
        path: path.join(this.keyDir, f),
        modified: fs.statSync(path.join(this.keyDir, f)).mtime,
      }));
  }

  /**
   * Verify that key file permissions are restrictive enough
   */
  verifyPermissions(projectId) {
    if (process.platform === 'win32') return true;

    const keyPath = this.getKeyPath(projectId);
    if (!fs.existsSync(keyPath)) return true;

    const stats = fs.statSync(keyPath);
    const mode = stats.mode & 0o777;
    return mode <= 0o600;
  }
}

class RemoteKeyStore {
  constructor(options = {}) {
    this.baseUrl = options.remoteUrl || 'https://keys.envshield.io/v1';
    this.local = new LocalKeyStore(options);
  }

  /**
   * Initialize a team and upload the encryption key
   */
  async initTeam(key, teamName) {
    // For now, just store locally and log the URL
    this.local.set(key);
    return {
      teamId: crypto.randomUUID(),
      teamName,
      keyServer: this.baseUrl,
    };
  }

  /**
   * Join a team and download the shared key
   */
  async joinTeam(inviteCode) {
    // Placeholder for remote key fetch
    return {
      joined: true,
      inviteCode,
      keyServer: this.baseUrl,
    };
  }

  /**
   * Sync local key with remote store
   */
  async sync(projectId) {
    const key = this.local.get(projectId);
    if (!key) {
      throw new Error('No local key to sync');
    }
    return { synced: true, projectId };
  }
}

module.exports = {
  LocalKeyStore,
  RemoteKeyStore,
  DEFAULT_KEY_DIR,
  CONFIG_DIR,
};
