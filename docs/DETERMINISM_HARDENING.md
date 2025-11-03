# Determinism Hardening Guide

**Status:** ✅ Implemented (feat/determinism-and-ux-fix-pack)

## Overview

The application enforces **strict determinism** for reproducible results in production while allowing **dev-mode fallback** for local testing when the backend is incomplete.

---

## Build-Time Guard

### What It Does

The Vite build configuration enforces `VITE_STRICT_DETERMINISM=1` in all non-development builds:

```typescript
// vite.config.ts
if (mode !== 'development' && strictDeterminism !== '1') {
  throw new Error(
    `[BUILD FAILED] VITE_STRICT_DETERMINISM must be '1' in ${mode} mode...`
  )
}
```

### Why It Matters

- **Production safety**: Prevents accidental deployment with dev-mode fallback
- **Staging parity**: Ensures staging behaves identically to production
- **Clear errors**: Build fails fast with actionable error message

### Build Behavior

| Mode        | Flag Value | Build Result                                  |
|-------------|------------|-----------------------------------------------|
| development | `0` or `1` | ✅ Success (both allowed in dev)               |
| staging     | `1`        | ✅ Success                                     |
| staging     | `0`        | ❌ **BUILD FAILED** with clear error message  |
| production  | `1`        | ✅ Success                                     |
| production  | `0`        | ❌ **BUILD FAILED** with clear error message  |

---

## Runtime Behavior

### Adapter Determinism Logic

Located in `src/adapters/plot/httpV1Adapter.ts` (lines 90-109):

```typescript
const strictDeterminism = String(import.meta.env?.VITE_STRICT_DETERMINISM ?? '1') === '1'
if (!result.response_hash) {
  const errorMsg = 'Backend returned no response_hash (determinism requirement violated)'

  if (strictDeterminism && import.meta.env.MODE !== 'development') {
    // Production: hard fail
    console.error(`[httpV1] ${errorMsg}`)
    throw { code: 'SERVER_ERROR', message: errorMsg }
  } else {
    // Development: warn and continue with fallback
    console.warn(`[httpV1] ${errorMsg} - continuing in DEV with fallback ID`)
    result.response_hash = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}
```

### Runtime Behavior Matrix

| Mode        | Flag | Backend Has Hash | Result                                      |
|-------------|------|------------------|---------------------------------------------|
| development | `0`  | ✅ Yes            | Uses real hash                              |
| development | `0`  | ❌ No             | ⚠️ Warns, generates `dev-{random}` fallback |
| development | `1`  | ❌ No             | ❌ Throws (strict even in dev)               |
| staging     | `1`  | ✅ Yes            | Uses real hash                              |
| staging     | `1`  | ❌ No             | ❌ **Throws** (hard fail)                    |
| production  | `1`  | ✅ Yes            | Uses real hash                              |
| production  | `1`  | ❌ No             | ❌ **Throws** (hard fail)                    |

---

## UI Dev Hash Badge

### Visual Indicator

When using dev fallback hash (`dev-{timestamp}-{random}`), the UI shows a warning badge:

**Results Panel Header:**
```
Seed 1337 • dev-a3b9f ⚠️
```

**Full Hash Display:**
```
Hash: dev-1704304... ⚠️
```

### Styling

- **Color**: Orange (`#f59e0b`)
- **Icon**: Warning triangle emoji (⚠️)
- **Tooltip**: *"Development fallback hash. Determinism is strictly enforced in staging/production."*

### Why It Matters

- **Clear feedback**: Developers know immediately they're using a fallback
- **No confusion**: Orange color + warning icon prevent mistaking dev hash for real hash
- **Copy protection**: Truncated display (8-16 chars) prevents accidental sharing of invalid hashes

---

## Configuration

### Local Development (.env)

```bash
# Enable dev-mode fallback (allows testing without backend hash)
VITE_STRICT_DETERMINISM=0

# Command Palette (optional)
VITE_FEATURE_COMMAND_PALETTE=1
```

### Staging/Production (.env)

```bash
# REQUIRED: Enforce strict determinism
VITE_STRICT_DETERMINISM=1

# Command Palette (optional)
VITE_FEATURE_COMMAND_PALETTE=1
```

**⚠️ Warning:** Never set `VITE_STRICT_DETERMINISM=0` in staging or production. The build will fail.

---

## Testing

### Verify Build Guard

**Test 1: Dev build allows fallback**
```bash
VITE_STRICT_DETERMINISM=0 npm run dev
# ✅ Should start successfully
```

**Test 2: Production build enforces strict**
```bash
VITE_STRICT_DETERMINISM=0 NODE_ENV=production npm run build
# ❌ Should fail with clear error message
```

**Test 3: Production build succeeds with strict=1**
```bash
VITE_STRICT_DETERMINISM=1 NODE_ENV=production npm run build
# ✅ Should build successfully
```

### Verify Runtime Behavior

**Test 1: Dev fallback shows badge**
1. Set `VITE_STRICT_DETERMINISM=0` in `.env`
2. Restart dev server
3. Run analysis (backend missing hash)
4. Check Results panel header:
   - Hash should start with `dev-`
   - Warning badge (⚠️) should be visible
   - Tooltip should show explanatory text
   - Color should be orange

**Test 2: Staging rejects missing hash**
1. Deploy to staging with `VITE_STRICT_DETERMINISM=1`
2. Run analysis with backend that omits `response_hash`
3. Should see error: *"Backend returned no response_hash"*
4. Error should be tracked in Sentry/PostHog

---

## CI/CD Integration

### Required CI Check

Add job to `.github/workflows/build.yml`:

```yaml
verify-determinism-flag:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Verify strict determinism in production builds
      run: |
        if [ "${{ github.ref }}" = "refs/heads/main" ] || [ "${{ github.ref }}" = "refs/heads/staging" ]; then
          if [ "$VITE_STRICT_DETERMINISM" != "1" ]; then
            echo "❌ VITE_STRICT_DETERMINISM must be '1' for production/staging"
            exit 1
          fi
        fi
      env:
        VITE_STRICT_DETERMINISM: ${{ secrets.VITE_STRICT_DETERMINISM || '1' }}
```

### Deployment Checklist

- [ ] `VITE_STRICT_DETERMINISM=1` set in staging environment
- [ ] `VITE_STRICT_DETERMINISM=1` set in production environment
- [ ] Build succeeds without errors
- [ ] Backend returns `result.response_hash` in `/v1/run` response
- [ ] No dev hash badges visible in staging/prod
- [ ] Sentry/PostHog tracking works correctly

---

## Backend Requirements

### Critical: response_hash Field

The backend **MUST** return `response_hash` in `/v1/run` response:

```json
{
  "summary": { "conservative": 100, "likely": 150, "optimistic": 200 },
  "response_hash": "a3f8b9c2d1e4f5a6b7c8d9e0f1a2b3c4",  // ← REQUIRED
  "seed": 1337,
  "confidence": 0.85
}
```

**Hash Requirements:**
- **Algorithm**: SHA256 (or equivalent cryptographic hash)
- **Input**: Normalized JSON of `{ seed, template_id, graph, summary }`
- **Output**: Hex string (64 chars) or base64 (44 chars)
- **Stable**: Same inputs MUST produce same hash

**Fallback Support:**
- Legacy `model_card.response_hash` still accepted
- Adapter prefers `result.response_hash` over `model_card.response_hash`

---

## Troubleshooting

### "Build failed: VITE_STRICT_DETERMINISM must be '1'"

**Cause:** Attempting to build for staging/production with `VITE_STRICT_DETERMINISM=0`

**Fix:** Set `VITE_STRICT_DETERMINISM=1` in environment or remove override

### "Backend returned no response_hash" (Production)

**Cause:** Backend `/v1/run` response missing `response_hash` field

**Fix:** Coordinate with backend team to implement hash generation

### Dev hash badge shows in staging

**Cause:** Backend not returning `response_hash`, and strict mode not enforced

**Fix:**
1. Verify `VITE_STRICT_DETERMINISM=1` in staging env
2. Check backend response includes `response_hash`
3. Clear browser cache and hard refresh

---

## Related Docs

- [Quick Start Guide](./QUICK_START_DELIVERABLES_1_2.md) - Local setup with fallback
- [Staging Checklist](./STAGING_ROLLOUT_PROVENANCE.md) - Pre-deployment verification
- [Backend Integration](./PENG_INTEGRATION_REQUIREMENTS.md) - API contract

---

**Last Updated:** 2025-11-02
**Feature Branch:** feat/determinism-and-ux-fix-pack
**Related PRs:** #9 (Observability), #TBD (Determinism Hardening)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
