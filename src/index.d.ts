declare module 'env-shield' {
  interface ConfigOptions {
    /** Path to .env file (default: '.env') */
    envPath?: string;
    /** Path to encrypted output (default: '.env.encrypted') */
    encryptedPath?: string;
    /** File encoding (default: 'utf8') */
    encoding?: string;
    /** Override existing process.env values (default: false) */
    override?: boolean;
  }

  interface ConfigResult {
    parsed: Record<string, string>;
  }

  /**
   * Load and decrypt environment variables.
   * Drop-in replacement for require('dotenv').config()
   */
  export function config(options?: ConfigOptions): ConfigResult;

  /**
   * Encrypt plaintext with AES-256-GCM
   */
  export function encrypt(plaintext: string, key: string): string;

  /**
   * Decrypt ciphertext with AES-256-GCM
   */
  export function decrypt(ciphertext: string, key: string): string;

  /**
   * Generate a random 256-bit encryption key (hex-encoded)
   */
  export function generateKey(): string;

  /**
   * Rotate encryption key — decrypt with old, re-encrypt with new
   */
  export function rotateKey(oldKey: string, newKey: string): string;
}
