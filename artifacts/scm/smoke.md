# SCM-lite Smoke Tests

These commands verify that the SCM-lite implementation is working correctly.

## Prerequisites

1. Set environment variables:
   ```bash
   export SCM_ENABLE=1
   export SCM_WRITES=0  # For read-only demo
   ```

2. Start the server (if not already running):
   ```bash
   npm run dev
   ```

## Basic Smoke Tests

### 1. Test CLI tool is available

```bash
npm run scm --help
```

**Expected:** Shows help text with available commands.

### 2. Test list versions (empty state)

```bash
npm run scm list
```

**Expected:** Shows "No versions found." message (initial state).

### 3. Test diff with example files

```bash
npm run scm diff --base artifacts/scm/examples/v1.json --candidate artifacts/scm/examples/v2.json
```

**Expected:** Should fail with appropriate error since we're trying to use file paths as base refs, demonstrating proper validation.

## Extended Tests (with SCM_WRITES=1)

For development testing with persistence enabled:

```bash
export SCM_WRITES=1
```

### 1. Test suggestion creation (transient becomes persistent)

```bash
# Create a suggestion using example files
npm run scm suggest --base v-example-base --title "Weight optimization" --file artifacts/scm/examples/v2.json
```

**Expected:** Shows proposal created with diff summary.

### 2. Test smoke passes

```bash
npm run scm:smoke
```

**Expected:** Shows "OK" if basic list command succeeds.

## Direct API Tests

Test the API endpoints directly:

### 1. List versions

```bash
curl -X GET http://localhost:3000/scm/versions
```

**Expected:** JSON response with schema "versions.v1" and empty versions array.

### 2. Test diff endpoint

```bash
curl -X POST http://localhost:3000/scm/diff \
  -H "Content-Type: application/json" \
  -d '{
    "baseRef": "non-existent",
    "candidate": {
      "inlineScenario": {"nodes": [], "links": []}
    }
  }'
```

**Expected:** 404 error with appropriate message about base reference not found.

### 3. Test disabled state

```bash
export SCM_ENABLE=0
curl -X GET http://localhost:3000/scm/versions
```

**Expected:** 404 error indicating resource not found when SCM is disabled.

## Performance Test

Test diff performance with reasonably sized scenarios:

```bash
# This should complete quickly (< 200ms)
npm run scm diff --base artifacts/scm/examples/v1.json --candidate artifacts/scm/examples/v2.json
```

**Expected:** Fast completion with deterministic diff results.

## Security Headers Test

Verify security headers are present:

```bash
curl -I http://localhost:3000/scm/versions
```

**Expected:** Headers should include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security`