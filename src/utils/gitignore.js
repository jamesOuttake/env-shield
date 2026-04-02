/**
 * Utilities for managing .gitignore entries
 */

const fs = require('fs');
const path = require('path');

/**
 * Ensure a pattern is present in .gitignore
 */
function ensureIgnored(pattern, projectRoot) {
  const gitignorePath = path.join(projectRoot || process.cwd(), '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${pattern}\n`);
    return true;
  }

  const content = fs.readFileSync(gitignorePath, 'utf8');
  const lines = content.split('\n').map(l => l.trim());

  if (lines.includes(pattern)) {
    return false; // Already ignored
  }

  // Add pattern with a blank line separator if file doesn't end with newline
  const separator = content.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(gitignorePath, `${separator}${pattern}\n`);
  return true;
}

/**
 * Check if a pattern is in .gitignore
 */
function isIgnored(pattern, projectRoot) {
  const gitignorePath = path.join(projectRoot || process.cwd(), '.gitignore');

  if (!fs.existsSync(gitignorePath)) return false;

  const content = fs.readFileSync(gitignorePath, 'utf8');
  return content.split('\n').map(l => l.trim()).includes(pattern);
}

module.exports = {
  ensureIgnored,
  isIgnored,
};
