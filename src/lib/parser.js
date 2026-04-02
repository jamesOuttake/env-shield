/**
 * .env file parser with support for comments, multiline values,
 * variable expansion, and quoted strings.
 */

const fs = require('fs');

const LINE_REGEX = /^\s*([\w.-]+)\s*=\s*(.*)\s*$/;
const EXPANSION_REGEX = /\$\{([^}]+)\}/g;

/**
 * Parse a .env file or string into a key-value object.
 */
function parse(input, options = {}) {
  const content = typeof input === 'string' && fs.existsSync(input)
    ? fs.readFileSync(input, options.encoding || 'utf8')
    : input;

  const result = {};
  const lines = content.split('\n');
  let multilineKey = null;
  let multilineValue = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle multiline continuation
    if (multilineKey) {
      if (trimmed.endsWith('"') || trimmed.endsWith("'")) {
        multilineValue += '\n' + trimmed.slice(0, -1);
        result[multilineKey] = multilineValue;
        multilineKey = null;
        multilineValue = '';
      } else {
        multilineValue += '\n' + line;
      }
      continue;
    }

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }

    // Handle export prefix
    const exportMatch = trimmed.match(/^export\s+(.*)/);
    const effectiveLine = exportMatch ? exportMatch[1] : trimmed;

    const match = effectiveLine.match(LINE_REGEX);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    // Handle quoted values
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (value.startsWith('"') || value.startsWith("'")) {
      // Start of multiline value
      multilineKey = key;
      multilineValue = value.slice(1);
      continue;
    }

    // Handle inline comments (only for unquoted values)
    if (!match[2].trim().startsWith('"') && !match[2].trim().startsWith("'")) {
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    result[key] = value;
  }

  // Handle variable expansion if enabled
  if (options.expand !== false) {
    expandVariables(result);
  }

  return result;
}

/**
 * Expand ${VAR} references within values
 */
function expandVariables(parsed) {
  const maxDepth = 10;

  function resolve(value, depth = 0) {
    if (depth > maxDepth) return value;

    return value.replace(EXPANSION_REGEX, (_, varName) => {
      if (varName in parsed) {
        return resolve(parsed[varName], depth + 1);
      }
      if (varName in process.env) {
        return process.env[varName];
      }
      return '';
    });
  }

  for (const key of Object.keys(parsed)) {
    if (typeof parsed[key] === 'string') {
      parsed[key] = resolve(parsed[key]);
    }
  }
}

/**
 * Serialize a key-value object back to .env format
 */
function serialize(obj, options = {}) {
  const lines = [];

  if (options.header) {
    lines.push(`# ${options.header}`);
    lines.push('');
  }

  for (const [key, value] of Object.entries(obj)) {
    const strValue = String(value);

    // Quote values that contain special characters
    if (strValue.includes(' ') || strValue.includes('#') ||
        strValue.includes('\n') || strValue.includes('"')) {
      lines.push(`${key}="${strValue.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}=${strValue}`);
    }
  }

  return lines.join('\n') + '\n';
}

module.exports = {
  parse,
  serialize,
  expandVariables,
};
