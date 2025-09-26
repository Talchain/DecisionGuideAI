/**
 * SARB Redaction Test
 * Validates redaction of sensitive data from SARB bundles
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { redactSarbBundle } from '../../../tools/sarb-redact';

describe('SARB Redaction', () => {
  const testBundlePath = path.resolve('test-bundle.json');
  const testRedactedPath = path.resolve('test-bundle-redacted.json');

  const sampleBundle = {
    meta: {
      bundleId: 'test-001',
      created: '2025-09-26T08:00:00.000Z',
      seed: 42,
      duration: 5000,
      apiKey: 'sk-test123456',
      userAgent: 'TestAgent/1.0',
      ipAddress: '192.168.1.1'
    },
    sessions: [{
      sessionId: 'sess-001',
      userId: 'user@example.com',
      secret: 'super-secret',
      traces: [{
        timestamp: '2025-09-26T08:00:01.000Z',
        data: {
          input: 'Test input',
          authorization: 'Bearer token-123'
        }
      }]
    }]
  };

  beforeAll(async () => {
    // Create test bundle
    await fs.writeFile(testBundlePath, JSON.stringify(sampleBundle, null, 2));
  });

  it('should remove sensitive fields', async () => {
    await redactSarbBundle(testBundlePath, testRedactedPath);

    const redactedData = await fs.readFile(testRedactedPath, 'utf8');
    const redacted = JSON.parse(redactedData);

    // Should remove sensitive fields
    expect(redacted.meta.apiKey).toBeUndefined();
    expect(redacted.meta.userAgent).toBeUndefined();
    expect(redacted.meta.ipAddress).toBeUndefined();
    expect(redacted.sessions[0].userId).toBeUndefined();
    expect(redacted.sessions[0].secret).toBeUndefined();
    expect(redacted.sessions[0].traces[0].data.authorization).toBeUndefined();
  });

  it('should preserve safe metadata', async () => {
    const redactedData = await fs.readFile(testRedactedPath, 'utf8');
    const redacted = JSON.parse(redactedData);

    // Should preserve safe fields
    expect(redacted.meta.bundleId).toBe('test-001');
    expect(redacted.meta.created).toBe('2025-09-26T08:00:00.000Z');
    expect(redacted.meta.seed).toBe(42);
    expect(redacted.meta.duration).toBe(5000);
    expect(redacted.sessions[0].sessionId).toBe('sess-001');
    expect(redacted.sessions[0].traces[0].data.input).toBe('Test input');
  });

  it('should generate redaction note', async () => {
    const notePath = testRedactedPath.replace('.json', '.redaction-note.md');

    const noteExists = await fs.access(notePath).then(() => true).catch(() => false);
    expect(noteExists).toBe(true);

    const noteContent = await fs.readFile(notePath, 'utf8');
    expect(noteContent).toContain('SARB Redaction Note');
    expect(noteContent).toContain('Removed Fields');
    expect(noteContent).toContain('Preserved Fields');
  });

  // Cleanup
  afterAll(async () => {
    try {
      await fs.unlink(testBundlePath);
      await fs.unlink(testRedactedPath);
      await fs.unlink(testRedactedPath.replace('.json', '.redaction-note.md'));
    } catch {
      // Ignore cleanup errors
    }
  });
});