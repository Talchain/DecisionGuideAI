# Boot Modes & Environment Variables

## Overview

The app uses a deterministic boot selector in `src/main.tsx` to decide which UI to mount based on the route and build-time environment variables.

## Precedence Order

1. **PLC Lab** (`/#/plc` + `VITE_PLC_LAB=1`)
   - If the route is `/#/plc` and the build has `VITE_PLC_LAB=1`, mount the PLC Lab.
   - This takes priority over `VITE_POC_ONLY` to ensure `/#/plc` always works in lab builds.

2. **PoC Shell** (`VITE_POC_ONLY=1` or `VITE_AUTH_MODE=guest` or PoC routes)
   - If `VITE_POC_ONLY=1` or `VITE_AUTH_MODE=guest`, mount the PoC shell.
   - PoC routes (`/#/plot`, `/#/sandbox`, `/#/test`) always force PoC shell.

3. **Default App**
   - If neither of the above, mount the default app (auth-gated, full Supabase).

## Environment Variables

### Build-time (Vite)

- **`VITE_PLC_LAB`**: Set to `"1"` to enable PLC Lab at `/#/plc`.
- **`VITE_POC_ONLY`**: Set to `"1"` to force PoC shell for all routes (except `/#/plc` if `VITE_PLC_LAB=1`).
- **`VITE_AUTH_MODE`**: Set to `"guest"` to enable guest mode (PoC shell).

### Runtime (localStorage)

- **`PLC_ENABLED`**: Set to `"1"` to enable PLC Lab in dev builds (when `VITE_PLC_LAB` is not set).
- **`plc:forceOff`**: Set to `"1"` to disable PLC Lab at runtime (kill-switch).
- **`plc.snap`**, **`plc.guides`**, **`plc.snapGuide`**: PLC feature toggles.

## Netlify Production Config

In `netlify.toml`, set:

```toml
[build]
  command = "npm run build && echo '{...}' > dist/version.json"
  
[build.environment]
  VITE_PLC_LAB = "1"
  VITE_AUTH_MODE = "guest"
  # PoC feature flags (for /#/plot, /#/sandbox routes)
  VITE_FEATURE_SSE = "1"
  VITE_FEATURE_SCENARIO_SANDBOX = "1"
  # ... other PoC flags
```

**Critical**: Use `npm run build` (not `build:poc`) in the build command. The `build:poc` script hardcodes `VITE_POC_ONLY=1` which prevents `/#/plc` from loading, even if you set `VITE_PLC_LAB=1` in the environment.

## Dev-Only Logging

In non-production builds, the boot selector logs to the console:

```
BOOT_MODE=PLC_LAB hash=#/plc VITE_PLC_LAB=1 VITE_POC_ONLY=unset
```

This helps diagnose env drift and routing issues during development.

## Testing

See `e2e/plc.boot-selector.spec.ts` for smoke tests that verify the precedence order.

## Troubleshooting

If `/#/plc` shows "PLC is disabled for this build":

1. **Verify env**: Check that `VITE_PLC_LAB=1` is set in `netlify.toml` `[build.environment]`.
2. **Check build command**: Ensure `netlify.toml` uses `npm run build` (not `build:poc`).
3. **Clear cache**: In Netlify UI, trigger a "Clear cache and deploy" to ensure env changes take effect.
4. **Redeploy**: Push a commit or manually trigger a deploy.
5. **Check console**: In dev builds, look for `BOOT_MODE=PLC_LAB` in the browser console when visiting `/#/plc`.
