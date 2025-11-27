# localStorage Migration Guide

**Created:** 2025-11-26
**Status:** In Progress
**Related:** P1.3 Security Hardening

---

## Overview

This guide documents the plan for migrating localStorage calls to the encrypted `secureStorage` API.

**Total localStorage usages:** 150+
**Priority files:** 15 (sensitive data)

---

## Migration Priority

### P0 - Critical (Auth Tokens)

These files store authentication/authorization data and should be migrated first:

| File | Keys | Risk | Notes |
|------|------|------|-------|
| `src/lib/auth/authUtils.ts` | `auth_token`, `auth_token_expires_at` | HIGH | Session tokens |
| `src/lib/auth/accessValidation.ts` | `dga_access_*` | HIGH | Access codes (hashed) |
| `src/contexts/GuestContext.tsx` | `guestId`, `guestData` | MEDIUM | Guest session |

**Challenge:** These use sync reads on mount. Requires async refactor.

### P1 - Important (User Data)

| File | Keys | Risk | Notes |
|------|------|------|-------|
| `src/canvas/store/scenarios.ts` | `canvas.scenarios.*` | MEDIUM | User scenarios |
| `src/canvas/persist.ts` | `canvas-state-v1` | MEDIUM | Canvas state |
| `src/contexts/DecisionContext.tsx` | `decision_state` | MEDIUM | Decision flow |
| `src/canvas/store/runHistory.ts` | `canvas.runHistory` | LOW | Analysis history |
| `src/lib/history.ts` | `sandbox.history` | LOW | Sandbox history |

### P2 - Settings (Low Risk)

Feature flags, UI preferences, debug settings - can remain plaintext.

---

## Migration Strategy

### For Sync-Critical Code

Use `secureStorageSync` (no encryption, but same API):

```typescript
import { secureStorageSync } from '@/lib/secureStorage'

// Before
localStorage.setItem('key', value)
const val = localStorage.getItem('key')

// After (sync, no encryption)
secureStorageSync.setItem('key', value)
const val = secureStorageSync.getItem('key')
```

### For Async-Ready Code

Use `secureStorage` (with encryption):

```typescript
import { secureStorage } from '@/lib/secureStorage'

// Before
localStorage.setItem('key', value)
const val = localStorage.getItem('key')

// After (async, encrypted)
await secureStorage.setItem('key', value)
const val = await secureStorage.getItem('key')
```

### Migration Pattern

1. **Identify sync vs async usage**
2. **For sync-critical paths:** Use sync wrapper initially, plan async refactor
3. **For new code:** Always use async secureStorage
4. **Gradual migration:** Convert components one at a time

---

## Configuration

Set `VITE_STORAGE_KEY` for encryption:

```bash
# Generate key (run in browser console)
window.__generateStorageKey()

# Add to .env.local
VITE_STORAGE_KEY=<generated-base64-key>
```

Without the key, secureStorage falls back to plaintext (dev mode).

---

## Files by Usage Count

| File | Usages | Priority |
|------|--------|----------|
| `src/components/SandboxStreamPanel.tsx` | 15+ | P2 |
| `src/canvas/store/scenarios.ts` | 8 | P1 |
| `src/lib/auth/accessValidation.ts` | 6 | P0 |
| `src/canvas/persist.ts` | 5 | P1 |
| `src/poc/AppPoC.tsx` | 5 | P2 |
| `src/contexts/GuestContext.tsx` | 4 | P0 |
| `src/lib/auth/authUtils.ts` | 2 | P0 |

---

## Test Files

These are test-only and don't need migration:
- `src/lib/__tests__/*.ts`
- `src/canvas/store/__tests__/*.ts`
- `src/components/assistants/__tests__/*.ts`

---

## Next Steps

1. ✅ Create secureStorage module
2. ✅ Add tests for secureStorage
3. ⬜ Migrate P0 auth files (requires async refactor)
4. ⬜ Migrate P1 user data files
5. ⬜ Update new code to use secureStorage

---

## Security Notes

- **AES-GCM encryption** with 256-bit key
- **IV per write** prevents pattern analysis
- **Migration support:** Old plaintext values readable
- **Dev fallback:** Works without key (warns in console)

---

**Last Updated:** 2025-11-26
