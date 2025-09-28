/**
 * Signed Snapshot Manifest v1
 * Adds cryptographic provenance to snapshot bundles without altering existing contents
 */

import { createHash, createHmac } from 'crypto';

export interface SignedManifest {
  version: '1.0';
  created_at: string;
  engine_code_hash: string;
  run_id: string;
  files: {
    [filename: string]: {
      sha256: string;
      size: number;
    };
  };
  signature: string;
}

/**
 * Check if snapshot signing is enabled
 */
function isSnapshotSigningEnabled(): boolean {
  return !!process.env.SNAPSHOT_SIGNING_KEY;
}

/**
 * Get the signing key from environment
 */
function getSigningKey(): string | null {
  return process.env.SNAPSHOT_SIGNING_KEY || null;
}

/**
 * Generate a mock engine code hash for the current codebase
 */
function generateEngineCodeHash(): string {
  // In production, this would hash the actual engine code
  // For PoC, we'll create a deterministic hash based on timestamp and version
  const version = process.env.npm_package_version || '0.1.0-pilot';
  const timestamp = Date.now();
  const mockCodeIdentifier = `decision-guide-ai-${version}-${timestamp}`;

  return createHash('sha256')
    .update(mockCodeIdentifier)
    .digest('hex');
}

/**
 * Calculate SHA256 hash of file content
 */
function calculateFileHash(content: Buffer): string {
  return createHash('sha256')
    .update(content)
    .digest('hex');
}

/**
 * Sign the manifest using HMAC-SHA256
 */
function signManifest(manifest: Omit<SignedManifest, 'signature'>, signingKey: string): string {
  // Create a canonical representation for signing
  const canonicalData = JSON.stringify(manifest, Object.keys(manifest).sort());

  return createHmac('sha256', signingKey)
    .update(canonicalData)
    .digest('hex');
}

/**
 * Create a signed manifest for the given files
 */
export function createSignedManifest(
  files: { [filename: string]: Buffer },
  runId: string
): SignedManifest | null {
  if (!isSnapshotSigningEnabled()) {
    return null;
  }

  const signingKey = getSigningKey();
  if (!signingKey) {
    return null;
  }

  // Create file hashes
  const fileHashes: { [filename: string]: { sha256: string; size: number } } = {};

  for (const [filename, content] of Object.entries(files)) {
    fileHashes[filename] = {
      sha256: calculateFileHash(content),
      size: content.length
    };
  }

  // Create unsigned manifest
  const unsignedManifest: Omit<SignedManifest, 'signature'> = {
    version: '1.0',
    created_at: new Date().toISOString(),
    engine_code_hash: generateEngineCodeHash(),
    run_id: runId,
    files: fileHashes
  };

  // Sign the manifest
  const signature = signManifest(unsignedManifest, signingKey);

  return {
    ...unsignedManifest,
    signature
  };
}

/**
 * Verify a signed manifest
 */
export function verifySignedManifest(
  manifest: SignedManifest,
  files: { [filename: string]: Buffer },
  signingKey: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Extract signature and create unsigned manifest for verification
    const { signature, ...unsignedManifest } = manifest;

    // Verify the signature
    const expectedSignature = signManifest(unsignedManifest, signingKey);
    if (signature !== expectedSignature) {
      errors.push('Invalid manifest signature');
    }

    // Verify file hashes and sizes
    for (const [filename, fileInfo] of Object.entries(manifest.files)) {
      const fileBuffer = files[filename];

      if (!fileBuffer) {
        errors.push(`Missing file: ${filename}`);
        continue;
      }

      const actualHash = calculateFileHash(fileBuffer);
      if (actualHash !== fileInfo.sha256) {
        errors.push(`Hash mismatch for ${filename}: expected ${fileInfo.sha256}, got ${actualHash}`);
      }

      if (fileBuffer.length !== fileInfo.size) {
        errors.push(`Size mismatch for ${filename}: expected ${fileInfo.size}, got ${fileBuffer.length}`);
      }
    }

    // Check for unexpected files
    for (const filename of Object.keys(files)) {
      if (filename === 'manifest.json') continue; // Skip the manifest itself

      if (!manifest.files[filename]) {
        errors.push(`Unexpected file: ${filename}`);
      }
    }

  } catch (error) {
    errors.push(`Verification error: ${error.message}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Add signed manifest to existing ZIP-like file structure
 */
export function addSignedManifestToBundle(
  files: { [filename: string]: Buffer },
  runId: string
): { [filename: string]: Buffer } {
  if (!isSnapshotSigningEnabled()) {
    return files; // Return unchanged if signing not enabled
  }

  // Create signed manifest
  const manifest = createSignedManifest(files, runId);
  if (!manifest) {
    return files; // Return unchanged if manifest creation failed
  }

  // Add manifest to files
  const manifestJson = JSON.stringify(manifest, null, 2);
  const filesWithManifest = {
    ...files,
    'manifest.json': Buffer.from(manifestJson, 'utf-8')
  };

  return filesWithManifest;
}

/**
 * Get signing status for debugging
 */
export function getSigningStatus(): {
  enabled: boolean;
  key_configured: boolean;
  algorithm: string;
  manifest_version: string;
} {
  return {
    enabled: isSnapshotSigningEnabled(),
    key_configured: !!getSigningKey(),
    algorithm: 'HMAC-SHA256',
    manifest_version: '1.0'
  };
}

/**
 * Generate a sample signing key for development
 */
export function generateSampleSigningKey(): string {
  return createHash('sha256')
    .update(`snapshot-signing-key-${Date.now()}-${Math.random()}`)
    .digest('hex');
}