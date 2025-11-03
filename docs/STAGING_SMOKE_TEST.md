# Staging Smoke Test Checklist

**Purpose:** Verify determinism hardening + UX fixes before production deployment

**Branch:** feat/determinism-and-ux-fix-pack
**Related Docs:** [Determinism Hardening](./DETERMINISM_HARDENING.md)

---

## Pre-Deployment Checks

### Environment Configuration

- [ ] `VITE_STRICT_DETERMINISM=1` set in staging environment
- [ ] `VITE_FEATURE_COMMAND_PALETTE=1` enabled (optional, for full testing)
- [ ] PostHog API key configured (optional, for observability)
- [ ] Sentry DSN configured (optional, for error tracking)

### Build Verification

- [ ] **Build succeeds** with `VITE_STRICT_DETERMINISM=1`
- [ ] **Build fails** with `VITE_STRICT_DETERMINISM=0` (test locally, not in staging)
- [ ] No console warnings about missing environment variables
- [ ] Bundle size within acceptable limits (check webpack-bundle-analyzer)

### CI Guardrails (PRs #12-#15)

- [ ] **Determinism guard job passes** - Verifies production builds enforce strict mode
- [ ] **Skip gate job passes** - No new test.skip() calls detected
- [ ] **OpenAPI validation runs** - Contract validation completes (soft gate)

### Operational Tooling

- [ ] **Performance baseline established** - Run `npm run perf:baseline -- --save` to set baseline
- [ ] **Golden briefs tested** - Run `npm run test:golden` against staging API
- [ ] **Datadog import configured** - DD_API_KEY set for metrics/logs import (optional)

---

## Functional Testing

### 1. Determinism Enforcement

**Test: Backend returns response_hash**
- [ ] Open staging app
- [ ] Run analysis from canvas or templates
- [ ] Check Network tab: `/v1/run` response includes `response_hash` field
- [ ] Check Results panel: hash displays without `dev-` prefix
- [ ] Check Results panel: **NO** warning badge (⚠️) visible
- [ ] Hash color is default (not orange)

**Test: Missing response_hash fails gracefully**
- [ ] **(Dev/QA only)** Temporarily remove backend hash field
- [ ] Run analysis
- [ ] Should see error: *"Backend returned no response_hash"*
- [ ] Error should NOT show dev fallback hash
- [ ] Error logged to Sentry with context

### 2. Global Run Button

**Test: Always visible on canvas**
- [ ] Open canvas route (`/canvas` or `/#/canvas`)
- [ ] Canvas toolbar visible at bottom center
- [ ] **Run button present** with play icon (▶️) and "Run" label
- [ ] Button is **disabled** when canvas has 0 nodes
- [ ] Add 1+ nodes → button becomes **enabled**
- [ ] Click Run → Results panel opens, analysis starts
- [ ] Button has proper focus ring (keyboard navigation)
- [ ] Tooltip shows: *"Run analysis (⌘⏎ or via ⌘K → 'Run Analysis')"*

**Test: Global Run works independently of Templates drawer**
- [ ] Open Templates drawer (right panel)
- [ ] Global Run button still visible in canvas toolbar
- [ ] Click global Run → works correctly
- [ ] Close Templates drawer
- [ ] Global Run button still visible and functional

### 3. Template Drawer Sticky Footer

**Test: Run button never hidden**
- [ ] Open Templates drawer
- [ ] Select a template (e.g., "Pricing Change")
- [ ] Template details load (about, graph preview)
- [ ] **Run button visible** at bottom of drawer (sticky footer)
- [ ] Footer has subtle border-top and backdrop blur
- [ ] Scroll template content up/down
- [ ] Run button **stays at bottom** (doesn't scroll)
- [ ] Content has bottom padding (doesn't hide behind footer)

**Test: Small viewports**
- [ ] Resize browser to mobile width (< 768px)
- [ ] Open Templates drawer (should be full-width)
- [ ] Select template
- [ ] Run button still sticky at bottom
- [ ] Scrolling works smoothly
- [ ] No layout shift when footer appears/disappears (CLS < 0.1)

**Test: Dev controls don't overlap**
- [ ] Select template in drawer
- [ ] Toggle "Show dev controls" → expanded
- [ ] Seed input, Run/Reset buttons visible
- [ ] Scroll to bottom
- [ ] Dev controls NOT hidden behind sticky footer
- [ ] Bottom padding prevents overlap

### 4. CORS Warnings Silenced

**Test: Console is clean**
- [ ] Open browser DevTools Console
- [ ] Clear console
- [ ] Refresh app
- [ ] **NO** CORS errors for `plot-lite-service.onrender.com/health`
- [ ] App uses `/api/plot/v1/*` proxy exclusively
- [ ] Only proxy requests visible in Network tab

**Test: Proxy health check**
- [ ] Check Network tab for `/api/plot/v1/health` (via proxy)
- [ ] Should return 200 OK with backend version info
- [ ] No direct backend requests (all through proxy)

---

## Accessibility Testing

### Keyboard Navigation

- [ ] **Tab** through canvas toolbar → reaches Run button
- [ ] **Enter/Space** on Run button → triggers analysis
- [ ] **Tab** through Templates drawer → reaches sticky footer Run button
- [ ] **Enter/Space** on drawer Run button → triggers analysis
- [ ] **⌘K / CTRL+K** → opens Command Palette
- [ ] Type "run" → "Run Analysis" action appears
- [ ] **Enter** → executes run and closes palette
- [ ] **ESC** when streaming → cancels run
- [ ] **ESC** when palette help open → closes help first, then palette

### Screen Reader

- [ ] Canvas Run button has `aria-label="Run analysis"`
- [ ] Template drawer footer has `role="contentinfo"` and `aria-label="Template actions"`
- [ ] Run button in footer has descriptive label
- [ ] Dev hash badge has explanatory `title` attribute
- [ ] All interactive elements have accessible names

### Axe DevTools

- [ ] Run Axe scan on canvas route
- [ ] **0 violations** (Critical, Serious, Moderate)
- [ ] Run Axe scan on Templates drawer
- [ ] **0 violations**
- [ ] Check color contrast ratios for dev hash badge (orange on white)

---

## Performance Testing

### Bundle Size

- [ ] Total bundle ≤ 500KB gzipped (excluding lazy-loaded chunks)
- [ ] React vendor chunk ≤ 150KB
- [ ] Command Palette lazy-loaded (not in initial bundle)
- [ ] No duplicate dependencies in bundle

### Runtime Performance

- [ ] Canvas toolbar renders in < 50ms (check Performance tab)
- [ ] Templates drawer opens in < 200ms
- [ ] Sticky footer mount/unmount causes **0 layout shift** (CLS < 0.1)
- [ ] Scrolling in drawer smooth (60fps)
- [ ] Run button interaction < 100ms (Time to Interactive)

### Network

- [ ] `/v1/run` response < 2s (P50)
- [ ] `/v1/stream` events arrive within 500ms
- [ ] Health check `/v1/health` < 500ms
- [ ] No unnecessary re-fetches (check Network timeline)

---

## Error Handling

### Missing response_hash

- [ ] Backend omits `response_hash` → error message shown
- [ ] Error tracked to Sentry with context:
  - Event name: `determinism_violation`
  - Context: `{ endpoint: '/v1/run', template_id: '...' }`
- [ ] PostHog event `run_failed` with reason: `missing_response_hash`

### Network Errors

- [ ] Disconnect network → run fails with: *"Network error"*
- [ ] Error tracked to Sentry + PostHog
- [ ] Retry button works after reconnection
- [ ] No CORS errors in console

### Rate Limiting

- [ ] Trigger rate limit (429) → error banner shown
- [ ] Banner shows retry-after countdown
- [ ] Run button disabled until retry-after expires
- [ ] PostHog event `rate_limited` tracked

---

## Edge Cases

### Multiple Runs

- [ ] Start run #1 → Results panel shows progress
- [ ] Start run #2 while #1 streaming → #1 cancelled, #2 starts
- [ ] Both runs tracked separately in PostHog
- [ ] No hash collision between runs

### Dev/Prod Hash Collision

- [ ] Verify dev hash format: `dev-{timestamp}-{random}`
- [ ] Real hash format: 64-char hex or 44-char base64
- [ ] No possibility of collision (dev prefix prevents it)

### Browser Compatibility

- [ ] Chrome/Edge: All tests pass
- [ ] Firefox: All tests pass
- [ ] Safari: All tests pass (check sticky footer behavior)
- [ ] Mobile Safari (iOS): sticky footer works, no scroll issues

---

## Observability Verification

### PostHog Events

- [ ] `run_started` tracked with `{ template_id, seed }`
- [ ] `run_completed` tracked with `{ run_id, elapsed_ms }`
- [ ] `run_failed` tracked with `{ error_code, retry_after }`
- [ ] `palette_opened` tracked (if Command Palette enabled)
- [ ] `palette_action` tracked with `{ action_id }`

### Sentry Errors

- [ ] Determinism violations tracked with full context
- [ ] Network errors tracked with request details
- [ ] Rate limit errors tracked with retry-after
- [ ] No uncaught exceptions in console

### Console Logs

- [ ] `[Metrics]` logs visible in dev mode
- [ ] `[httpV1]` logs show request/response cycles
- [ ] No `dev-` hash warnings in staging (strict mode enforced)
- [ ] No red errors except expected validation failures

---

## Rollback Plan

If critical issues found:

1. **Immediate:** Flip `VITE_STRICT_DETERMINISM=0` in staging (allows dev fallback)
2. **Revert:** Roll back to previous deployment
3. **Communicate:** Notify team + backend engineers
4. **Fix:** Address issue in feature branch
5. **Re-test:** Run full smoke test again before re-deploying

---

## Sign-Off

**Tester:** _______________
**Date:** _______________
**Environment:** Staging / Production
**Build Version:** _______________
**All Tests Passed:** ☐ Yes  ☐ No (see notes)

**Notes:**
```
(Add any issues, warnings, or observations here)
```

---

**Last Updated:** 2025-11-02
**Related Docs:** [Determinism Hardening](./DETERMINISM_HARDENING.md), [Quick Start](./QUICK_START_DELIVERABLES_1_2.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
