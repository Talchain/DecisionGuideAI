# CLI Reference - New Commands

## Development Stack Commands

### Docker Development Stack
```bash
# Start local development stack with Docker
npm run devstack:up

# Stop local development stack
npm run devstack:down

# Build with local images
USE_LOCAL_IMAGES=1 npm run devstack:up
```

### Unified Olumi CLI
```bash
# Stream a scenario
npm run olumi stream --seed 42

# Cancel a running stream
npm run olumi cancel --runId abc123

# Get a report
npm run olumi report --runId abc123

# Compare scenarios
npm run olumi compare --runIds abc123,def456

# Take a snapshot
npm run olumi snapshot --runId abc123

# SCM operations (list, add, remove scenarios)
npm run olumi scm list
npm run olumi scm add scenario.json
npm run olumi scm remove scenario-id
```

## Testing & Analysis Commands

### Determinism & Stability Testing
```bash
# Run determinism audit (tests seeds 42, 101, 31415 twice each)
npm run audit:det

# Run stability analysis (21 seeds with statistical analysis)
npm run stability
```

### Contract Monitoring
```bash
# Check for breaking changes in API contracts
npm run contract:drift

# Include in CI/CD pipeline
npm run contract:drift || exit 1
```

### Fixture Generation
```bash
# Generate test fixtures for a specific seed
node scripts/fixtures-gen.mjs --seed 42

# Generate with custom scenario
node scripts/fixtures-gen.mjs --seed 101 --scenario custom.json
```

## Feature Testing Commands

### Edge Replay Mode Testing
```bash
# Test replay mode functionality (requires REPLAY_MODE=1)
REPLAY_MODE=1 npx tsx tools/replay-test.ts
```

### Scenario Linting Testing
```bash
# Test scenario linter
npx tsx tools/linter-test.ts
```

### Parameter Sweeps Testing
```bash
# Test parameter sweeps (requires API)
npx tsx tools/sweeps-test.ts
```

## Environment Variables

### Feature Flags
```bash
# Enable replay mode (disabled by default)
export REPLAY_MODE=1

# Use local Docker images for development
export USE_LOCAL_IMAGES=1

# Configure olumi CLI base URL
export BASE_URL=http://localhost:3001
```

### CI/CD Environment
```bash
# Strict contract scanning
export SCAN_STRICT=1

# Enable experimental streaming API
export STREAM_ALT_EVENTS=1
```

## Quick Start Development Workflow

```bash
# 1. Start development stack
npm run devstack:up

# 2. Generate test fixtures
node scripts/fixtures-gen.mjs --seed 42

# 3. Test a scenario stream
npm run olumi stream --seed 42

# 4. Run quality checks
npm run contract:drift
npm run audit:det

# 5. Test replay mode
REPLAY_MODE=1 npx tsx tools/replay-test.ts

# 6. Stop development stack
npm run devstack:down
```

## Integration Examples

### CI/CD Pipeline Integration
```yaml
# GitHub Actions example
- name: Check Contract Drift
  run: npm run contract:drift
  continue-on-error: false

- name: Run Determinism Audit
  run: npm run audit:det

- name: Build Local Images
  run: USE_LOCAL_IMAGES=1 npm run devstack:up
  env:
    USE_LOCAL_IMAGES: 1
```

### Local Development Setup
```bash
# .env file for local development
REPLAY_MODE=1
USE_LOCAL_IMAGES=1
BASE_URL=http://localhost:3001
```

## Troubleshooting

### Common Issues
```bash
# If Docker builds fail
docker system prune -f
USE_LOCAL_IMAGES=1 npm run devstack:up

# If replay mode isn't working
ls artifacts/snapshots/  # Check snapshots exist
REPLAY_MODE=1 npx tsx tools/replay-test.ts

# If contract drift fails
rm -rf artifacts/contract-baseline/
npm run contract:drift  # Creates new baseline
```

### Debug Commands
```bash
# Check Docker containers
docker ps

# Check replay snapshots
ls -la artifacts/snapshots/

# Check contract baseline
ls -la artifacts/contract-baseline/

# View latest drift report
cat artifacts/reports/contract-drift.md
```