# Fixture Auto-Generator

The fixture auto-generator creates deterministic test data for UI development and testing.

## Quick Start

```bash
# Generate fixtures with a specific seed
node scripts/fixtures-gen.mjs --seed 42

# Generate with custom scenario
node scripts/fixtures-gen.mjs --seed 42 --scenario ./my-scenario.json

# Generate with scenario ID
node scripts/fixtures-gen.mjs --seed 42 --scenario scenario-001
```

## How It Works

The generator performs these steps:

1. **Start Primary Run**: Creates a scenario run with the specified seed
2. **Capture Stream**: Records the complete NDJSON event stream
3. **Get Report**: Fetches the final report data
4. **Start Comparison Run**: Creates a second run with seed+1 for comparison
5. **Generate Compare Data**: Creates diff/comparison data between the two runs
6. **Save Artifacts**: Writes all data to timestamped directory

## Output Structure

```
artifacts/seed/auto/
├── 2025-01-16T12-34-56/
│   ├── stream.ndjson      # Complete event stream
│   ├── report.json        # Final report data
│   ├── compare.json       # Comparison between runs
│   └── metadata.json      # Generation metadata
└── latest/                # Symlink to most recent
```

## File Formats

### stream.ndjson
Newline-delimited JSON containing all SSE events:
```
{"type":"hello","data":{"runId":"abc123"}}
{"type":"token","data":{"token":"Starting analysis"}}
{"type":"cost","data":{"tokens":15,"cost":0.001}}
{"type":"done","data":{"status":"completed"}}
```

### report.json
Complete report in `report.v1` schema:
```json
{
  "schema": "report.v1",
  "meta": {
    "seed": 42,
    "runId": "abc123"
  },
  "status": "completed",
  "summary": {...}
}
```

### compare.json
Comparison data in standard schema:
```json
{
  "schema": "compare.v1",
  "left": {...},
  "right": {...},
  "delta": {...}
}
```

### metadata.json
Generation metadata and statistics:
```json
{
  "generated": "2025-01-16T12:34:56.789Z",
  "seed": 42,
  "scenario": {...},
  "runs": {
    "primary": "abc123",
    "comparison": "def456"
  },
  "files": {
    "stream": "stream.ndjson",
    "report": "report.json",
    "compare": "compare.json"
  },
  "stats": {
    "streamEvents": 25,
    "reportStatus": "completed",
    "compareSchema": "compare.v1"
  }
}
```

## Environment Variables

- `BASE_URL` - API endpoint (default: `http://localhost:3001`)

## Usage in Windsurf

Use generated fixtures for UI development:

```typescript
// Load stream events for real-time simulation
import streamData from './artifacts/seed/auto/latest/stream.ndjson';

// Load report for final state display
import reportData from './artifacts/seed/auto/latest/report.json';

// Load comparison for diff views
import compareData from './artifacts/seed/auto/latest/compare.json';
```

## Deterministic Generation

The generator ensures deterministic output:

- **Same seed** = identical stream events and report
- **Sequential seeds** = meaningful comparison data
- **Metadata** = tracks generation parameters for reproduction

## Common Scenarios

### Development Fixtures

Generate fixtures for different scenario types:

```bash
# Simple decision scenario
fixtures-gen --seed 42 --scenario ./test-scenarios/simple.json

# Complex multi-factor scenario
fixtures-gen --seed 123 --scenario ./test-scenarios/complex.json

# Edge case scenario
fixtures-gen --seed 999 --scenario ./test-scenarios/edge-case.json
```

### UI Testing

```bash
# Generate baseline fixtures
fixtures-gen --seed 42

# Generate comparison fixtures
fixtures-gen --seed 43

# Generate error scenario fixtures (if scenario causes errors)
fixtures-gen --seed 404 --scenario ./test-scenarios/error-case.json
```

### Demo Data

```bash
# Generate demo data for presentations
fixtures-gen --seed 12345 --scenario ./demo-scenarios/showcase.json
```

## Integration with Development

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "fixtures:gen": "node scripts/fixtures-gen.mjs",
    "fixtures:demo": "node scripts/fixtures-gen.mjs --seed 42 --scenario ./demo.json",
    "fixtures:test": "node scripts/fixtures-gen.mjs --seed 123"
  }
}
```

### CI/CD

Generate fresh fixtures in CI:

```yaml
- name: Generate test fixtures
  run: npm run fixtures:gen -- --seed 42

- name: Upload fixtures
  uses: actions/upload-artifact@v3
  with:
    name: test-fixtures
    path: artifacts/seed/auto/latest/
```

## Troubleshooting

### API Connection Issues

```bash
# Check if API is running
curl http://localhost:3001/healthz

# Use different BASE_URL
BASE_URL=http://localhost:8080 fixtures-gen --seed 42
```

### Timeout Issues

The generator waits up to 30 seconds for runs to complete. For complex scenarios:

1. Ensure the API is responsive
2. Check scenario complexity
3. Verify simulation mode is enabled

### Missing Files

If expected files aren't generated:

1. Check console output for errors
2. Verify API permissions
3. Ensure output directory is writable
4. Check available disk space

### Symlink Issues

On Windows or restricted environments, symlinks may fail:

```bash
# Manual latest update
cp -r artifacts/seed/auto/2025-01-16T12-34-56/* artifacts/seed/auto/latest/
```

## Best Practices

1. **Use meaningful seeds** - choose seeds that relate to test scenarios
2. **Document scenarios** - include scenario description in metadata
3. **Version fixtures** - keep historical fixtures for regression testing
4. **Automate generation** - integrate into CI/CD for fresh fixtures
5. **Validate determinism** - re-run same seed to verify consistency