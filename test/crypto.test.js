const { encrypt, decrypt, generateKey, deriveKey, hash, verifyEnvironment } = require('../src/lib/crypto');

describe('crypto', () => {
  describe('encrypt/decrypt', () => {
    it('should round-trip encrypt and decrypt', () => {
      const key = generateKey();
      const plaintext = 'DATABASE_URL=postgres://localhost:5432/myapp\nSECRET=abc123';
      const ciphertext = encrypt(plaintext, key);
      expect(decrypt(ciphertext, key)).toBe(plaintext);
    });

    it('should produce unique ciphertexts (random IV)', () => {
      const key = generateKey();
      const plaintext = 'HELLO=world';
      const a = encrypt(plaintext, key);
      const b = encrypt(plaintext, key);
      expect(a).not.toBe(b);
      expect(decrypt(a, key)).toBe(decrypt(b, key));
    });

    it('should fail with the wrong key', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      const ciphertext = encrypt('SECRET=value', key1);
      expect(() => decrypt(ciphertext, key2)).toThrow();
    });

    it('should handle empty string', () => {
      const key = generateKey();
      const ciphertext = encrypt('', key);
      expect(decrypt(ciphertext, key)).toBe('');
    });

    it('should handle unicode content', () => {
      const key = generateKey();
      const plaintext = 'MSG=こんにちは世界\nEMOJI=🔒';
      const ciphertext = encrypt(plaintext, key);
      expect(decrypt(ciphertext, key)).toBe(plaintext);
    });

    it('should reject malformed ciphertext', () => {
      const key = generateKey();
      expect(() => decrypt('not:valid', key)).toThrow();
      expect(() => decrypt('', key)).toThrow();
    });
  });

  describe('generateKey', () => {
    it('should return a 64-char hex string', () => {
      const key = generateKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique keys', () => {
      const keys = new Set(Array.from({ length: 100 }, () => generateKey()));
      expect(keys.size).toBe(100);
    });
  });

  describe('deriveKey', () => {
    it('should derive a consistent key from passphrase + salt', () => {
      const { key: k1, salt } = deriveKey('mypassword');
      const { key: k2 } = deriveKey('mypassword', salt);
      expect(k1.toString('hex')).toBe(k2.toString('hex'));
    });

    it('should produce different keys for different passphrases', () => {
      const salt = Buffer.from('a'.repeat(32), 'hex');
      const { key: k1 } = deriveKey('password1', salt);
      const { key: k2 } = deriveKey('password2', salt);
      expect(k1.toString('hex')).not.toBe(k2.toString('hex'));
    });
  });

  describe('hash', () => {
    it('should produce consistent SHA-256 hashes', () => {
      expect(hash('hello')).toBe(hash('hello'));
      expect(hash('hello')).not.toBe(hash('world'));
    });

    it('should return a 64-char hex string', () => {
      expect(hash('test')).toHaveLength(64);
    });
  });

  describe('verifyEnvironment', () => {
    it('should report AES-256-GCM as available', () => {
      const env = verifyEnvironment();
      expect(env['aes-256-gcm']).toBe(true);
    });

    it('should report PBKDF2 as available', () => {
      const env = verifyEnvironment();
      expect(env.pbkdf2).toBe(true);
    });
  });
});
