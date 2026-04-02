const { encrypt, decrypt, generateKey, config } = require('../src/index');
const fs = require('fs');
const path = require('path');

describe('env-shield', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string', () => {
      const key = generateKey();
      const plaintext = 'DATABASE_URL=postgres://localhost:5432/myapp\nAPI_KEY=sk-test-123';

      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same input', () => {
      const key = generateKey();
      const plaintext = 'SECRET=hello';

      const encrypted1 = encrypt(plaintext, key);
      const encrypted2 = encrypt(plaintext, key);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should fail with wrong key', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      const plaintext = 'SECRET=hello';

      const encrypted = encrypt(plaintext, key1);

      expect(() => decrypt(encrypted, key2)).toThrow();
    });
  });

  describe('generateKey', () => {
    it('should generate a 64-char hex string (256 bits)', () => {
      const key = generateKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('config', () => {
    const testDir = path.join(__dirname, '.test-env');

    beforeEach(() => {
      fs.mkdirSync(testDir, { recursive: true });
      process.chdir(testDir);
    });

    afterEach(() => {
      process.chdir(__dirname);
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should load variables from .env file', () => {
      fs.writeFileSync('.env', 'TEST_VAR=hello\nANOTHER=world');

      delete process.env.TEST_VAR;
      delete process.env.ANOTHER;

      const result = config();

      expect(result.parsed.TEST_VAR).toBe('hello');
      expect(result.parsed.ANOTHER).toBe('world');
      expect(process.env.TEST_VAR).toBe('hello');

      delete process.env.TEST_VAR;
      delete process.env.ANOTHER;
    });

    it('should skip comments and empty lines', () => {
      fs.writeFileSync('.env', '# This is a comment\n\nVALID=yes');

      delete process.env.VALID;

      const result = config();

      expect(Object.keys(result.parsed)).toHaveLength(1);
      expect(result.parsed.VALID).toBe('yes');

      delete process.env.VALID;
    });

    it('should handle quoted values', () => {
      fs.writeFileSync('.env', 'QUOTED="hello world"\nSINGLE=\'test\'');

      delete process.env.QUOTED;
      delete process.env.SINGLE;

      const result = config();

      expect(result.parsed.QUOTED).toBe('hello world');
      expect(result.parsed.SINGLE).toBe('test');

      delete process.env.QUOTED;
      delete process.env.SINGLE;
    });
  });
});
