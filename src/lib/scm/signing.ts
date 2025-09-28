/**
 * SCM-lite signing module
 * Simple HMAC signing and verification for manifests
 */

import * as crypto from 'crypto';

/**
 * Sign a manifest with HMAC-SHA256
 */
export function signManifest(manifest: any, signingKey: string): string {
  const hmac = crypto.createHmac('sha256', signingKey);
  const content = JSON.stringify(manifest, Object.keys(manifest).sort());
  hmac.update(content);
  return hmac.digest('hex');
}

/**
 * Verify a manifest signature
 */
export function verifyManifest(manifest: any, signature: string, signingKey: string): boolean {
  // Remove signature from manifest for verification
  const manifestCopy = { ...manifest };
  delete manifestCopy.signature;

  const expectedSignature = signManifest(manifestCopy, signingKey);
  return signature === expectedSignature;
}

/**
 * Check if signing is enabled
 */
export function isSigningEnabled(): boolean {
  return !!process.env.SCM_SIGNING_KEY;
}