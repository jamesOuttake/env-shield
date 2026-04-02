/**
 * Simple logger for env-shield with color support and log levels.
 */

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[91m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  blue: '\x1b[94m',
  cyan: '\x1b[96m',
  white: '\x1b[97m',
  gray: '\x1b[90m',
};

class Logger {
  constructor(options = {}) {
    this.level = LEVELS[options.level || 'info'] || LEVELS.info;
    this.prefix = options.prefix || 'env-shield';
    this.colorEnabled = options.color !== false && process.stdout.isTTY;
  }

  color(colorName, text) {
    if (!this.colorEnabled) return text;
    return `${COLORS[colorName] || ''}${text}${COLORS.reset}`;
  }

  formatPrefix() {
    return this.color('cyan', `[${this.prefix}]`);
  }

  debug(...args) {
    if (this.level <= LEVELS.debug) {
      console.log(this.formatPrefix(), this.color('gray', 'DEBUG'), ...args);
    }
  }

  info(...args) {
    if (this.level <= LEVELS.info) {
      console.log(this.formatPrefix(), ...args);
    }
  }

  success(...args) {
    if (this.level <= LEVELS.info) {
      console.log(this.formatPrefix(), this.color('green', '✓'), ...args);
    }
  }

  warn(...args) {
    if (this.level <= LEVELS.warn) {
      console.warn(this.formatPrefix(), this.color('yellow', '⚠'), ...args);
    }
  }

  error(...args) {
    if (this.level <= LEVELS.error) {
      console.error(this.formatPrefix(), this.color('red', '✗'), ...args);
    }
  }

  /**
   * Write directly to the terminal, bypassing any output capturing.
   * Used for important messages during install that must be visible.
   */
  terminal(text) {
    const fs = require('fs');
    try {
      const fd = fs.openSync('/dev/tty', 'w');
      fs.writeSync(fd, text + '\n');
      fs.closeSync(fd);
    } catch (e) {
      process.stderr.write(text + '\n');
    }
  }
}

// Singleton instance
const logger = new Logger();

module.exports = { Logger, logger, COLORS };
