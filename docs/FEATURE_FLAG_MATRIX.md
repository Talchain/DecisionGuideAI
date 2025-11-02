# Feature Flag Matrix

**Purpose**: Centralized tracking of all feature flags across environments.

**Last Updated**: 2025-11-01

---

## Flag States by Environment

| Flag | Dev | E2E | Staging | Production | Description |
|------|-----|-----|---------|------------|-------------|
| `VITE_FEATURE_COMMAND_PALETTE` | 1 | 1 | 1 | 0 | Canvas command palette (⌘K) |
| `VITE_FEATURE_PLOT_STREAM` | 1 | 1 | 1 | 0 | PLoT V1 streaming (SSE) |
| `VITE_FEATURE_COMPARE_DEBUG` | 1 | 1 | 1 | 0 | Compare panel debug mode |
| `VITE_FEATURE_INSPECTOR_DEBUG` | 1 | 1 | 1 | 0 | Inspector panel debug mode |
| `VITE_FEATURE_SSE` | 1 | 1 | 1 | 0 | Server-Sent Events support |
| `VITE_FEATURE_HINTS` | 1 | 1 | 0 | 0 | Contextual UI hints |
| `VITE_E2E` | 0 | 1 | 0 | 0 | E2E test mode |

---

## Backend Integration Flags

| Flag | Dev | E2E | Staging | Production | Description |
|------|-----|-----|---------|------------|-------------|
| `PLOT_API_URL` | `https://plot-lite-service.onrender.com` | `https://plot-lite-service.onrender.com` | `https://plot-lite-service.onrender.com` | `https://plot-lite-service.onrender.com` | PLoT backend URL |
| `PLOT_API_KEY` | (optional) | (not set) | (required) | (required) | Backend auth token (server-side only) |
| `VITE_PLOT_PROXY_BASE` | `/api/plot` | `/api/plot` | `/api/plot` | `/api/plot` | Proxy base path |

---

## Flag Lifecycle

### Alpha (Dev + E2E only)
- Features under active development
- Not user-facing
- Can be unstable

### Beta (Dev + E2E + Staging)
- Features ready for internal testing
- Basic stability achieved
- Collecting feedback

### Canary (Staging only, % rollout)
- Features ready for limited production testing
- Full stability required
- Gradual rollout to production

### GA (All environments)
- Flag removed, feature always on
- Proven stable
- Part of core product

---

## Flag Management Best Practices

1. **Always add new flags to this matrix** when creating them
2. **Document the purpose** clearly
3. **Set expiry dates** for temporary flags
4. **Remove flags** once features are GA (don't leave dead flags)
5. **Test flag combinations** - some features may interact

---

## Current Rollout Plan

### Command Palette (Priority 1)
- **Status**: Beta (staging rollout)
- **Next**: Canary production rollout (10% users)
- **Target GA**: Q1 2026
- **Blockers**: None

### PLoT V1 Streaming
- **Status**: Beta (staging)
- **Next**: Backend streaming endpoint deployment
- **Target GA**: Q1 2026
- **Blockers**: Streaming route updates needed

### Compare/Inspector Debug
- **Status**: Alpha (dev only)
- **Next**: Wire backend integration
- **Target GA**: Q2 2026
- **Blockers**: Backend Compare API not available

---

## Verification

To verify flag states in each environment:

```bash
# Dev
grep VITE_FEATURE .env.local

# E2E
grep VITE_FEATURE playwright.config.ts

# Staging
# Check Netlify environment variables

# Production
# Check production environment variables
```
