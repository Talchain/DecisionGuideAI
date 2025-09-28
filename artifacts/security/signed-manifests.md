# Signed Snapshot Manifest v1

Cryptographic provenance system for snapshot bundles to ensure authenticity and integrity.

## Overview

The Signed Snapshot Manifest system adds cryptographic provenance to snapshot ZIP files without altering existing contents. It provides tamper detection, file integrity verification, and optional cryptographic signing for audit trails.

**Default State**: **OFF** - Requires explicit configuration to enable.

## Features

- **File Integrity**: SHA256 checksums for all files in the snapshot
- **Tamper Detection**: HMAC-SHA256 signatures detect any modifications
- **Provenance Tracking**: Records engine code hash and creation timestamp
- **Non-Intrusive**: Adds `manifest.json` without changing existing files
- **Backwards Compatible**: Snapshots work normally when signing is disabled

## Configuration

### Enable Signing

Set the `SNAPSHOT_SIGNING_KEY` environment variable:

```bash
# Development
export SNAPSHOT_SIGNING_KEY="your-64-character-hex-key"

# Production (use a secure key)
export SNAPSHOT_SIGNING_KEY="$(openssl rand -hex 32)"
```

### Generate a Signing Key

For development and testing:

```javascript
import { generateSampleSigningKey } from './src/lib/signed-snapshot-manifest.js';

const key = generateSampleSigningKey();
console.log('Generated key:', key);
```

Or using OpenSSL:

```bash
openssl rand -hex 32
```

### Check Signing Status

```javascript
import { getSigningStatus } from './src/lib/signed-snapshot-manifest.js';

const status = getSigningStatus();
console.log('Signing enabled:', status.enabled);
console.log('Key configured:', status.key_configured);
```

## Manifest Format

When signing is enabled, a `manifest.json` file is added to each snapshot with the following structure:

```json
{
  "version": "1.0",
  "created_at": "2025-09-27T16:00:00.000Z",
  "engine_code_hash": "a1b2c3d4e5f6...",
  "run_id": "run-12345-abcdef",
  "files": {
    "scenario.json": {
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "size": 1024
    },
    "report.json": {
      "sha256": "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
      "size": 2048
    }
  },
  "signature": "hmac-sha256-signature-here"
}
```

### Manifest Fields

- **version**: Manifest format version (`1.0`)
- **created_at**: ISO timestamp of snapshot creation
- **engine_code_hash**: Hash identifying the engine version/code
- **run_id**: Unique identifier for the analysis run
- **files**: Map of filename to file metadata
  - **sha256**: SHA256 hash of file contents
  - **size**: File size in bytes
- **signature**: HMAC-SHA256 signature of the manifest

## Verification

### Verify a Snapshot

```javascript
import { verifySignedManifest } from './src/lib/signed-snapshot-manifest.js';

// Extract files from snapshot (implementation-specific)
const files = extractFilesFromSnapshot(snapshotBuffer);
const manifestContent = files['manifest.json'];
const manifest = JSON.parse(manifestContent.toString());

// Verify the manifest
const result = verifySignedManifest(manifest, files, signingKey);

if (result.valid) {
  console.log('✅ Snapshot is authentic and unmodified');
} else {
  console.log('❌ Verification failed:');
  result.errors.forEach(error => console.log(`  - ${error}`));
}
```

### Manual Verification Steps

1. **Extract Manifest**:
   ```bash
   unzip snapshot.zip manifest.json
   cat manifest.json | jq .
   ```

2. **Verify File Hashes**:
   ```bash
   # For each file in manifest.files
   sha256sum scenario.json
   # Compare with manifest.files["scenario.json"].sha256
   ```

3. **Verify Signature** (requires signing key):
   ```javascript
   // Create canonical manifest (without signature)
   const { signature, ...unsignedManifest } = manifest;
   const canonical = JSON.stringify(unsignedManifest, Object.keys(unsignedManifest).sort());

   // Calculate expected signature
   const expectedSignature = crypto
     .createHmac('sha256', signingKey)
     .update(canonical)
     .digest('hex');

   console.log('Valid signature:', signature === expectedSignature);
   ```

## Security Model

### What is Protected

- **File Integrity**: Any modification to snapshot files is detected
- **File Completeness**: Missing or extra files are detected
- **Manifest Authenticity**: Signature ensures manifest hasn't been tampered with
- **Provenance**: Links snapshot to specific engine version and run

### What is NOT Protected

- **Confidentiality**: Files are not encrypted, only signed
- **Key Management**: Signing key must be protected separately
- **Replay Protection**: Same files will produce same hashes
- **Timestamp Authority**: Timestamps are self-asserted

### Threat Model

**Protected Against**:
- Accidental file corruption
- Malicious modification of snapshot contents
- Substitution of different files
- Unsigned snapshots being passed off as signed

**NOT Protected Against**:
- Compromise of the signing key
- Social engineering attacks
- Side-channel attacks on the verification process
- Attacks on the underlying ZIP format

## Integration

### Automatic Integration

The system automatically integrates with existing snapshot creation:

```javascript
// Existing code - no changes needed
const snapshot = createSnapshotBundle(runSnapshot, correlationId);

// If SNAPSHOT_SIGNING_KEY is set:
// - manifest.json is automatically added
// - All files are hashed and signed
// - ZIP contains original files + manifest.json

// If SNAPSHOT_SIGNING_KEY is not set:
// - ZIP contains only original files
// - No manifest.json is added
// - Backwards compatible operation
```

### Manual Integration

For custom snapshot creation:

```javascript
import { addSignedManifestToBundle } from './src/lib/signed-snapshot-manifest.js';

// Prepare your files
const files = {
  'data.json': Buffer.from('{"data": "here"}'),
  'report.txt': Buffer.from('Analysis results...')
};

// Add signed manifest (only if signing enabled)
const filesWithManifest = addSignedManifestToBundle(files, 'run-id-123');

// Create ZIP with the resulting files
const zipBuffer = createZip(filesWithManifest);
```

## Examples

### Development Setup

```bash
# Generate a development key
export SNAPSHOT_SIGNING_KEY="$(node -e 'const crypto = require("crypto"); console.log(crypto.randomBytes(32).toString("hex"))')"

# Create a signed snapshot
npm run test:snapshots

# Verify the snapshot was signed
unzip -l latest-snapshot.zip | grep manifest.json
```

### Production Setup

```bash
# Generate a secure production key
export SNAPSHOT_SIGNING_KEY="$(openssl rand -hex 32)"

# Store the key securely (example)
echo $SNAPSHOT_SIGNING_KEY | gpg --encrypt --recipient admin@company.com > signing-key.gpg

# Deploy with signing enabled
docker run -e SNAPSHOT_SIGNING_KEY="$SNAPSHOT_SIGNING_KEY" decision-guide-ai
```

### Verification Example

```bash
#!/bin/bash
# verify-snapshot.sh

SIGNING_KEY="your-key-here"
SNAPSHOT_FILE="$1"

if [ ! -f "$SNAPSHOT_FILE" ]; then
  echo "Usage: $0 <snapshot.zip>"
  exit 1
fi

# Extract manifest
unzip -q "$SNAPSHOT_FILE" manifest.json -d /tmp/verify/

if [ ! -f "/tmp/verify/manifest.json" ]; then
  echo "❌ No manifest found - snapshot is unsigned"
  exit 1
fi

# Verify files exist and hashes match
node verify-snapshot.js "/tmp/verify/manifest.json" "$SNAPSHOT_FILE" "$SIGNING_KEY"

# Clean up
rm -rf /tmp/verify/
```

## Troubleshooting

### Common Issues

**Manifest not found in snapshot**:
- Check if `SNAPSHOT_SIGNING_KEY` is set
- Verify signing was enabled when snapshot was created

**Signature verification fails**:
- Ensure you're using the correct signing key
- Check if manifest or files have been modified
- Verify manifest JSON is valid

**Hash mismatch errors**:
- Files have been modified since signing
- Different line endings (CRLF vs LF) can cause hash differences
- Ensure binary mode when extracting files

### Debug Commands

```bash
# Check if signing is enabled
node -e "console.log('Signing enabled:', !!process.env.SNAPSHOT_SIGNING_KEY)"

# Generate test manifest
node -e "
const { createSignedManifest } = require('./src/lib/signed-snapshot-manifest.js');
const files = { 'test.txt': Buffer.from('test') };
console.log(createSignedManifest(files, 'test-123'));
"

# Verify manifest structure
cat manifest.json | jq 'keys'
```

## Best Practices

### Key Management

1. **Generate Unique Keys**: Use different keys for different environments
2. **Secure Storage**: Store keys in environment variables or secure vaults
3. **Key Rotation**: Plan for periodic key rotation
4. **Access Control**: Limit who has access to signing keys

### Verification Workflow

1. **Always Verify**: Check signatures on all production snapshots
2. **Automated Checks**: Include verification in CI/CD pipelines
3. **Log Verification**: Record verification results for audit trails
4. **Handle Failures**: Have clear procedures for verification failures

### Development

1. **Test Both Modes**: Test with signing enabled and disabled
2. **Mock Keys**: Use consistent test keys for development
3. **Version Control**: Never commit signing keys to version control
4. **Documentation**: Document key requirements for deployment

## Migration

### Enabling Signing on Existing System

1. **Deploy Code**: Deploy signed manifest support (inactive by default)
2. **Test Configuration**: Verify system works without signing key
3. **Generate Key**: Create production signing key securely
4. **Enable Signing**: Set `SNAPSHOT_SIGNING_KEY` environment variable
5. **Verify Operation**: Confirm new snapshots contain manifests
6. **Monitor**: Watch for any issues with snapshot creation/verification

### Disabling Signing

To disable signing:

```bash
unset SNAPSHOT_SIGNING_KEY
```

New snapshots will be created without manifests. Existing signed snapshots remain valid and can still be verified if you have the key.

---

*The Signed Snapshot Manifest system provides optional cryptographic provenance without breaking existing functionality. It's designed to be secure by default (disabled) and only active when explicitly configured.*