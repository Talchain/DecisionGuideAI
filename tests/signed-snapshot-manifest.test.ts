/**
 * Test suite for Signed Snapshot Manifest v1
 * Tests cryptographic provenance functionality for snapshot bundles
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createSignedManifest,
  verifySignedManifest,
  addSignedManifestToBundle,
  getSigningStatus,
  generateSampleSigningKey
} from '../src/lib/signed-snapshot-manifest';

describe('Signed Snapshot Manifest v1', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('createSignedManifest', () => {
    it('should return null when signing is disabled', () => {
      delete process.env.SNAPSHOT_SIGNING_KEY;

      const files = {
        'test.json': Buffer.from('{"test": true}', 'utf-8')
      };

      const manifest = createSignedManifest(files, 'test-run-123');

      expect(manifest).toBeNull();
    });

    it('should create signed manifest when signing is enabled', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const files = {
        'scenario.json': Buffer.from('{"scenario": "test"}', 'utf-8'),
        'report.json': Buffer.from('{"report": "data"}', 'utf-8')
      };

      const manifest = createSignedManifest(files, 'test-run-123');

      expect(manifest).toBeTruthy();
      expect(manifest!.version).toBe('1.0');
      expect(manifest!.run_id).toBe('test-run-123');
      expect(manifest!.created_at).toBeTruthy();
      expect(manifest!.engine_code_hash).toBeTruthy();
      expect(manifest!.signature).toBeTruthy();
      expect(manifest!.files).toHaveProperty('scenario.json');
      expect(manifest!.files).toHaveProperty('report.json');
    });

    it('should include correct file hashes and sizes', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const testContent = '{"test": "content"}';
      const files = {
        'test.json': Buffer.from(testContent, 'utf-8')
      };

      const manifest = createSignedManifest(files, 'test-run-123');

      expect(manifest!.files['test.json'].size).toBe(testContent.length);
      expect(manifest!.files['test.json'].sha256).toBeTruthy();
      expect(manifest!.files['test.json'].sha256).toHaveLength(64); // SHA256 hex length
    });

    it('should create different signatures for different content', async () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const files1 = {
        'test.json': Buffer.from('{"test": "content1"}', 'utf-8')
      };

      const manifest1 = createSignedManifest(files1, 'test-run-123');

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const files2 = {
        'test.json': Buffer.from('{"test": "content2"}', 'utf-8')
      };

      const manifest2 = createSignedManifest(files2, 'test-run-123');

      expect(manifest1!.signature).not.toBe(manifest2!.signature);
      expect(manifest1!.files['test.json'].sha256).not.toBe(manifest2!.files['test.json'].sha256);
    });
  });

  describe('verifySignedManifest', () => {
    it('should verify valid manifest successfully', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const files = {
        'test.json': Buffer.from('{"test": "content"}', 'utf-8')
      };

      const manifest = createSignedManifest(files, 'test-run-123');
      const verification = verifySignedManifest(manifest!, files, 'test-key-12345');

      expect(verification.valid).toBe(true);
      expect(verification.errors).toHaveLength(0);
    });

    it('should detect invalid signature', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const files = {
        'test.json': Buffer.from('{"test": "content"}', 'utf-8')
      };

      const manifest = createSignedManifest(files, 'test-run-123');
      manifest!.signature = 'invalid-signature';

      const verification = verifySignedManifest(manifest!, files, 'test-key-12345');

      expect(verification.valid).toBe(false);
      expect(verification.errors).toContain('Invalid manifest signature');
    });

    it('should detect file content tampering', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const originalFiles = {
        'test.json': Buffer.from('{"test": "content"}', 'utf-8')
      };

      const tamperedFiles = {
        'test.json': Buffer.from('{"test": "tampered"}', 'utf-8')
      };

      const manifest = createSignedManifest(originalFiles, 'test-run-123');
      const verification = verifySignedManifest(manifest!, tamperedFiles, 'test-key-12345');

      expect(verification.valid).toBe(false);
      expect(verification.errors.some(err => err.includes('Hash mismatch'))).toBe(true);
    });

    it('should detect missing files', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const originalFiles = {
        'test1.json': Buffer.from('{"test": "content1"}', 'utf-8'),
        'test2.json': Buffer.from('{"test": "content2"}', 'utf-8')
      };

      const incompleteFiles = {
        'test1.json': Buffer.from('{"test": "content1"}', 'utf-8')
      };

      const manifest = createSignedManifest(originalFiles, 'test-run-123');
      const verification = verifySignedManifest(manifest!, incompleteFiles, 'test-key-12345');

      expect(verification.valid).toBe(false);
      expect(verification.errors.some(err => err.includes('Missing file: test2.json'))).toBe(true);
    });

    it('should detect unexpected files', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const originalFiles = {
        'test.json': Buffer.from('{"test": "content"}', 'utf-8')
      };

      const extendedFiles = {
        'test.json': Buffer.from('{"test": "content"}', 'utf-8'),
        'extra.json': Buffer.from('{"extra": "file"}', 'utf-8')
      };

      const manifest = createSignedManifest(originalFiles, 'test-run-123');
      const verification = verifySignedManifest(manifest!, extendedFiles, 'test-key-12345');

      expect(verification.valid).toBe(false);
      expect(verification.errors.some(err => err.includes('Unexpected file: extra.json'))).toBe(true);
    });

    it('should ignore manifest.json in unexpected files check', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const originalFiles = {
        'test.json': Buffer.from('{"test": "content"}', 'utf-8')
      };

      const filesWithManifest = {
        'test.json': Buffer.from('{"test": "content"}', 'utf-8'),
        'manifest.json': Buffer.from('{"manifest": "data"}', 'utf-8')
      };

      const manifest = createSignedManifest(originalFiles, 'test-run-123');
      const verification = verifySignedManifest(manifest!, filesWithManifest, 'test-key-12345');

      // Should not complain about manifest.json being unexpected
      expect(verification.errors.some(err => err.includes('Unexpected file: manifest.json'))).toBe(false);
    });
  });

  describe('addSignedManifestToBundle', () => {
    it('should return unchanged files when signing is disabled', () => {
      delete process.env.SNAPSHOT_SIGNING_KEY;

      const files = {
        'test.json': Buffer.from('{"test": "content"}', 'utf-8')
      };

      const result = addSignedManifestToBundle(files, 'test-run-123');

      expect(result).toEqual(files);
      expect(result).not.toHaveProperty('manifest.json');
    });

    it('should add manifest.json when signing is enabled', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const files = {
        'test.json': Buffer.from('{"test": "content"}', 'utf-8')
      };

      const result = addSignedManifestToBundle(files, 'test-run-123');

      expect(result).toHaveProperty('manifest.json');
      expect(result['manifest.json']).toBeInstanceOf(Buffer);

      // Parse the manifest to verify it's valid JSON
      const manifestJson = result['manifest.json'].toString('utf-8');
      const manifest = JSON.parse(manifestJson);

      expect(manifest.version).toBe('1.0');
      expect(manifest.run_id).toBe('test-run-123');
      expect(manifest.signature).toBeTruthy();
    });

    it('should preserve original files when adding manifest', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const files = {
        'scenario.json': Buffer.from('{"scenario": "data"}', 'utf-8'),
        'report.json': Buffer.from('{"report": "data"}', 'utf-8')
      };

      const result = addSignedManifestToBundle(files, 'test-run-123');

      expect(result['scenario.json']).toEqual(files['scenario.json']);
      expect(result['report.json']).toEqual(files['report.json']);
      expect(result).toHaveProperty('manifest.json');
    });
  });

  describe('getSigningStatus', () => {
    it('should return disabled status when no key is configured', () => {
      delete process.env.SNAPSHOT_SIGNING_KEY;

      const status = getSigningStatus();

      expect(status.enabled).toBe(false);
      expect(status.key_configured).toBe(false);
      expect(status.algorithm).toBe('HMAC-SHA256');
      expect(status.manifest_version).toBe('1.0');
    });

    it('should return enabled status when key is configured', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-key-12345';

      const status = getSigningStatus();

      expect(status.enabled).toBe(true);
      expect(status.key_configured).toBe(true);
      expect(status.algorithm).toBe('HMAC-SHA256');
      expect(status.manifest_version).toBe('1.0');
    });
  });

  describe('generateSampleSigningKey', () => {
    it('should generate a valid signing key', () => {
      const key = generateSampleSigningKey();

      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
      expect(key).toHaveLength(64); // SHA256 hex length
    });

    it('should generate different keys on each call', () => {
      const key1 = generateSampleSigningKey();
      const key2 = generateSampleSigningKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('integration with snapshots', () => {
    it('should maintain manifest integrity through full cycle', () => {
      process.env.SNAPSHOT_SIGNING_KEY = 'test-integration-key';

      const originalFiles = {
        'scenario.json': Buffer.from('{"scenario": "integration-test"}', 'utf-8'),
        'report.json': Buffer.from('{"report": "integration-data"}', 'utf-8'),
        'seed.txt': Buffer.from('42', 'utf-8')
      };

      // Add manifest to bundle
      const bundleWithManifest = addSignedManifestToBundle(originalFiles, 'integration-run-123');

      // Extract manifest
      const manifestJson = bundleWithManifest['manifest.json'].toString('utf-8');
      const manifest = JSON.parse(manifestJson);

      // Verify the manifest against the original files (excluding manifest.json)
      const verification = verifySignedManifest(manifest, originalFiles, 'test-integration-key');

      expect(verification.valid).toBe(true);
      expect(verification.errors).toHaveLength(0);
    });
  });
});