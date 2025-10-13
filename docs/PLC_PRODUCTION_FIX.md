# PLC Production Fix: Build Command Issue

## Problem

`/#/plc` showed "PLC is disabled for this build" in production, even though:
- `VITE_PLC_LAB=1` was set in `netlify.toml` `[build.environment]`
- Boot selector correctly prioritized PLC route when `VITE_PLC_LAB=1`
- All E2E tests passed locally

## Root Cause

**Netlify build command used `npm run build:poc`**, which hardcodes `VITE_POC_ONLY=1` in the npm script:

```json
// package.json
"build:poc": "cross-env VITE_POC_ONLY=1 VITE_AUTH_MODE=guest ... vite build"
```

This **overrode** the `VITE_PLC_LAB=1` environment variable set in `netlify.toml`, causing the build to exclude PLC Lab code.

## Solution

Changed `netlify.toml` build command from `npm run build:poc` to `npm run build`:

```toml
[build]
  command = "npm run build && echo '{...}' > dist/version.json"
  
[build.environment]
  VITE_PLC_LAB = "1"
  VITE_AUTH_MODE = "guest"
  # All PoC feature flags (for /#/plot, /#/sandbox routes)
  VITE_FEATURE_SSE = "1"
  VITE_FEATURE_SCENARIO_SANDBOX = "1"
  # ... etc
```

This allows the environment variables in `netlify.toml` to control the build, rather than being overridden by hardcoded script values.

## Verification

### Before Fix
- Production URL: https://olumi.netlify.app/#/plc
- Result: "PLC is disabled for this build"
- Cause: `VITE_POC_ONLY=1` hardcoded in `build:poc` script

### After Fix
- Production URL: https://olumi.netlify.app/#/plc
- Result: PLC Lab loads successfully
- Lighthouse scores:
  - **Performance: 98** ✅ (target ≥95)
  - **Accessibility: 100** ✅ (target ≥90)
  - **Best Practices: 100** ✅
  - **SEO: 82**

## Key Learnings

1. **npm scripts override env vars**: When using `cross-env` in npm scripts, those values take precedence over `netlify.toml` environment variables.

2. **Use standard build command**: For builds that need multiple env vars, set them in `netlify.toml` `[build.environment]` and use the standard `npm run build` command.

3. **Boot selector works correctly**: The `selectApp()` precedence in `src/main.tsx` correctly prioritizes `/#/plc` when `VITE_PLC_LAB=1`, but only if the build actually includes PLC code.

## Related Files

- `netlify.toml` - Build command and environment variables
- `src/main.tsx` - Boot selector with precedence logic
- `docs/BOOT_MODES.md` - Documentation and troubleshooting
- `e2e/plc.boot-selector.spec.ts` - Smoke tests for boot selector
