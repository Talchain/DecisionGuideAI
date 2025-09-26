# SARB Redaction Guide

## Overview

SARB (Scenario Analysis Recording Bundle) Redaction creates public-safe copies of analysis bundles by removing sensitive information while preserving deterministic metadata for replay and analysis.

## Quick Start

### 1. Redact a Bundle
```bash
npm run sarb:redact -- input.sarb.zip output-redacted.sarb.zip
```

### 2. Verify Redacted Bundle
```bash
npm run sarb:verify -- output-redacted.sarb.zip
```

## What Gets Removed

### Sensitive Fields
- **API Keys**: `apiKey`, `api_key` and similar patterns
- **Secrets**: `secret`, `password`, `token` fields
- **Personal Data**: `userId`, `email`, IP addresses
- **Authentication**: `authorization`, `bearer` tokens
- **System Info**: `userAgent`, browser/system details

### Path-Based Removal
Fields containing these patterns are removed:
- `secret`, `password`, `auth`, `private`
- `api`, `user`, `ip`
- Email patterns (containing `@`)

## What Gets Preserved

### Essential Metadata
- **Determinism**: `seed`, `created`, `bundleId`
- **Performance**: `duration`, timing data
- **Analysis**: `model`, `route`, `deterministic` flag
- **Costs**: `totalTokens`, `costUsd` (if not sensitive)

### Structure
- Session structure and trace flow
- Event timestamps and sequencing
- Input/output content (after redaction)

## Example Workflow

```bash
# 1. Check original bundle
npm run sarb:verify -- original.sarb.zip
# Shows: "Has Sensitive Data: ⚠️ Yes"

# 2. Create redacted version
npm run sarb:redact -- original.sarb.zip public-safe.sarb.zip
# Creates: public-safe.sarb.zip + public-safe.sarb.redaction-note.md

# 3. Verify redacted bundle
npm run sarb:verify -- public-safe.sarb.zip
# Shows: "Has Sensitive Data: ✅ No"

# 4. Review what was removed
cat public-safe.sarb.redaction-note.md
```

## Redaction Notes

Each redaction generates a `.redaction-note.md` file containing:

- **Summary**: What was removed and preserved
- **Removed Fields**: Complete list of sensitive fields
- **Preserved Fields**: Safe metadata that was kept
- **Verification**: Command to verify the output
- **Safety Assessment**: Whether bundle is public-safe

## Verification Results

The `sarb:verify` tool provides:

- **Status**: VALID/INVALID bundle structure
- **Sensitive Data Check**: Whether bundle contains potential secrets
- **Redaction Detection**: Whether bundle appears redacted
- **Size & Sessions**: Basic bundle metrics
- **Recommendations**: Next steps based on findings

## Safety Guidelines

### ✅ Safe for Sharing
- Bundles verified as "Has Sensitive Data: ✅ No"
- Complete redaction notes available
- Deterministic metadata preserved for replay

### ⚠️ Review Required
- Bundles with warnings from verification
- Custom fields not in standard patterns
- Domain-specific sensitive data

### ❌ Not Safe
- Original bundles with API keys
- Failed verification
- Missing redaction notes

## Integration

### CI/CD Usage
```bash
# Verify before sharing
npm run sarb:verify -- bundle.sarb.zip || exit 1

# Auto-redact for demos
npm run sarb:redact -- internal.sarb.zip demo.sarb.zip
```

### Testing
```bash
# Test redaction with sample bundle
npm run sarb:redact -- artifacts/runs/test-sample.sarb.zip test-redacted.sarb.zip
npm run sarb:verify -- test-redacted.sarb.zip
```

## Troubleshooting

### "Still Contains Sensitive Data"
- Check the redaction note for fields that were missed
- Custom sensitive fields may need tool updates
- Review bundle manually for domain-specific data

### "Bundle Structure Invalid"
- Original bundle may be malformed
- Check JSON syntax and required fields
- Verify bundle was generated correctly

### "Redaction Too Aggressive"
- Some fields may be incorrectly classified as sensitive
- Update `PRESERVE_FIELDS` if needed for your use case
- Review redaction rules in `tools/sarb-redact.ts`

## Advanced Configuration

The redaction rules can be customized by modifying:
- `SENSITIVE_FIELDS`: Exact field names to remove
- `PRESERVE_FIELDS`: Fields to keep even if they match sensitive patterns
- `shouldRemoveField()`: Custom logic for field removal

---
*Part of the DecisionGuide AI Evidence Pack*