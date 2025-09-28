# Contract Drift Sentry

The contract drift sentry monitors changes to API contracts and schema stamps, detecting breaking changes before they impact clients.

## Quick Start

```bash
# Run contract drift check
npm run contract:drift

# CI/CD integration
npm run contract:drift || exit 1
```

## How It Works

The drift sentry compares current contracts against the last release baseline:

1. **OpenAPI Analysis**: Compares current OpenAPI specs with baseline
2. **Schema Stamp Extraction**: Scans code for schema version stamps
3. **Change Categorisation**: Classifies changes as breaking, additive, or modifications
4. **Impact Assessment**: Determines if changes are safe for release
5. **Exit Code**: Returns appropriate exit code for CI/CD pipelines

## Change Categories

### Breaking Changes ❌
Changes that may break existing clients:
- Removed API endpoints
- Removed properties from responses
- Changed property types
- Removed schema versions
- Modified required fields

### Additive Changes ✅
Safe additions that extend functionality:
- New API endpoints
- New optional properties
- New schema versions
- Additional enum values
- New documentation

### Modifications ⚠️
Changes that modify existing values:
- Updated descriptions
- Changed default values
- Modified examples
- Version number updates

## Usage

### Command Line

```bash
# Basic check
node scripts/contract-drift.mjs

# With npm script
npm run contract:drift

# Check exit code
npm run contract:drift && echo "Safe to release" || echo "Breaking changes detected"
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Check Contract Drift
  run: npm run contract:drift
  continue-on-error: false

- name: Upload Drift Report
  uses: actions/upload-artifact@v3
  with:
    name: contract-drift-report
    path: artifacts/reports/contract-drift.md
```

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "contract:drift": "node scripts/contract-drift.mjs",
    "prerelease": "npm run contract:drift"
  }
}
```

## Output and Reports

### Console Output

```
🔍 Checking Contract Drift...

📊 CONTRACT DRIFT ANALYSIS COMPLETE
❌ Breaking changes: 0
✅ Additive changes: 3
⚠️  Modifications: 1
📄 Report: artifacts/reports/contract-drift.md

✅ Safe changes detected - Ready for release
```

### Markdown Report

Generated at `artifacts/reports/contract-drift.md`:

```markdown
# Contract Drift Report

**Generated:** 2025-01-16T12:34:56.789Z
**Status:** ✅ SAFE CHANGES DETECTED

## Summary

- **Breaking Changes:** 0
- **Additive Changes:** 3
- **Modifications:** 1

## ✅ Additive Changes

- **property_added** at `paths./new-endpoint`
- **schema_added** at `schema_stamps` (added: "newFeature.v1")
```

### Exit Codes

- **0**: No breaking changes (safe to release)
- **1**: Breaking changes detected (review required)
- **2**: Script error or configuration issue

## Configuration

### Baseline Management

The sentry automatically maintains baselines:

```
artifacts/
├── contract-baseline/          # Current baseline for comparison
│   ├── openapi.yaml           # Baseline OpenAPI spec
│   └── schema-stamps.json     # Baseline schema stamps
└── reports/
    └── contract-drift.md      # Latest drift report
```

### Schema Stamp Detection

The tool scans for schema version patterns:

```typescript
// Detected patterns
{ "schema": "report.v1" }
{ schema: "diff.v1" }
export const SCHEMA = "lint.v1";
```

### File Locations

Checks these locations:
- `artifacts/openapi.yaml` - Current OpenAPI spec
- `src/**/*.{ts,js,tsx,jsx}` - Source code for schema stamps
- `artifacts/release/openapi.yaml` - Release baseline (if exists)
- `artifacts/release/schema-stamps.json` - Release baseline stamps

## Advanced Usage

### Custom Baselines

To compare against a specific release:

```bash
# Copy specific release as baseline
cp releases/v1.2.0/openapi.yaml artifacts/contract-baseline/
cp releases/v1.2.0/schema-stamps.json artifacts/contract-baseline/

# Run comparison
npm run contract:drift
```

### Filtering Changes

The script categorises all changes, but you can filter the output:

```bash
# Show only breaking changes
npm run contract:drift | grep "Breaking Changes" -A 20

# Count changes by type
npm run contract:drift 2>&1 | grep -E "(Breaking|Additive|Modifications):"
```

### Integration with Release Process

```bash
#!/bin/bash
# release.sh

echo "Checking contracts..."
if npm run contract:drift; then
  echo "✅ Contracts are safe"
  npm run build
  npm run test
  npm run release
else
  echo "❌ Breaking changes detected!"
  echo "Review artifacts/reports/contract-drift.md"
  exit 1
fi
```

## Common Scenarios

### First Release

When no baseline exists:

```
ℹ️  No baseline OpenAPI found - this may be the first release
📁 Baseline saved to artifacts/contract-baseline/
🎯 No contract changes - Stable for release
```

### Breaking Change Detected

```
💥 BREAKING CHANGES DETECTED - Review required before release!

## ❌ Breaking Changes

- **property_removed** at `paths./old-endpoint` (was: {...})
- **schema_removed** at `schema_stamps` (was: "deprecated.v1")
```

### Safe Changes

```
✅ Safe changes detected - Ready for release

## ✅ Additive Changes

- **property_added** at `paths./new-feature`
- **schema_added** at `schema_stamps` (added: "feature.v2")
```

## Best Practices

### For Developers

1. **Run locally before commits** to catch changes early
2. **Review drift reports** to understand contract evolution
3. **Use semantic versioning** aligned with change types
4. **Document breaking changes** in release notes

### For Release Management

1. **Integrate into CI/CD** as a required check
2. **Block releases** on breaking changes without approval
3. **Archive baselines** for each release
4. **Monitor drift trends** over time

### For API Design

1. **Favour additive changes** over breaking ones
2. **Version schemas explicitly** (v1, v2, etc.)
3. **Deprecate before removing** features
4. **Maintain backwards compatibility** when possible

## Troubleshooting

### False Positives

If the tool reports breaking changes that aren't actually breaking:

1. Check if the baseline is correct
2. Review the specific changes reported
3. Update the baseline if needed
4. Consider if the change is truly safe

### Missing Changes

If expected changes aren't detected:

1. Ensure files are in scanned locations
2. Check schema stamp patterns match expected format
3. Verify OpenAPI files are valid JSON/YAML
4. Run with verbose logging if available

### Baseline Issues

To reset baselines:

```bash
# Remove old baselines
rm -rf artifacts/contract-baseline/

# Run drift check to create new baseline
npm run contract:drift
```

## Extending the Tool

The drift sentry can be extended for specific needs:

1. **Custom change rules** - Add organisation-specific breaking change detection
2. **Additional file types** - Scan GraphQL schemas, protobuf definitions, etc.
3. **Integration hooks** - Send notifications, create tickets, etc.
4. **Historical tracking** - Maintain drift history over time

## Limitations

- **Static analysis only** - Cannot detect runtime contract changes
- **Pattern-based detection** - May miss non-standard schema patterns
- **No semantic analysis** - Focuses on structural changes
- **Baseline dependency** - Requires proper baseline management