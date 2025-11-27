# Phase 3: Enhancement Opportunities

**Created:** 2025-01-15 (Phase 2 Sprint 1B completion)
**Purpose:** Track enhancement opportunities identified during Phase 2 work

---

## 1. Slow-Run Telemetry

**Priority:** Medium
**Effort:** Small (1-2 days)
**Value:** High - enables backend performance optimization

### Background

Phase 2 Sprint 1B implemented slow-run UX feedback that shows messages at 20s and 40s thresholds. This provides user-facing value, but we don't currently track how often these thresholds are hit.

### Enhancement

Add telemetry events to track slow-run occurrences:

**Events to Track:**
```typescript
telemetry.trackEvent('analysis.slow_run', {
  threshold: '20s' | '40s',
  template_id: string,
  node_count: number,
  edge_count: number,
  adapter: 'httpv1' | 'mock' | 'auto',
  final_duration_ms: number,
})
```

**Implementation:**
1. Add telemetry calls in OutputsDock.tsx slow-run useEffect (lines 193-223)
2. Track 20s threshold hit
3. Track 40s threshold hit (if reached)
4. Track final duration when run completes

**Backend Requirements:**
- Accept and store `analysis.slow_run` events
- Create dashboard to visualize slow-run frequency
- Alert on threshold increases (e.g., >10% of runs >20s)

**Benefits:**
- Identify which templates/graph sizes cause slow runs
- Prioritize backend performance work
- Detect performance regressions in production

**Acceptance Criteria:**
- Telemetry events sent when 20s/40s thresholds crossed
- Events include context (template, graph size, adapter)
- Events visible in PostHog/analytics dashboard
- No PII (Personally Identifiable Information) included

---

## 2. Bundle Size Monitoring CI Check

**Priority:** Low
**Effort:** Trivial (0.5 days)
**Value:** Medium - prevents bundle bloat

### Background

Phase 2 Sprint 1B created [bundle-baseline.md](bundle-baseline.md) documenting current bundle size (~831 kB gzipped). We should monitor this in CI to catch size regressions.

### Enhancement

Add CI check that fails if bundle size grows significantly:

**Implementation:**
```yaml
# .github/workflows/bundle-size.yml
name: Bundle Size Check

on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build

      # Check total gzipped size
      - name: Check bundle size
        run: |
          TOTAL_SIZE=$(du -sb dist/assets/*.js | awk '{sum+=$1} END {print sum}')
          GZIP_SIZE=$(gzip -c dist/assets/*.js | wc -c)
          THRESHOLD=871000  # 851 kB (831 kB baseline + 5% buffer)

          if [ "$GZIP_SIZE" -gt "$THRESHOLD" ]; then
            echo "Bundle size $GZIP_SIZE exceeds threshold $THRESHOLD"
            exit 1
          fi

          echo "Bundle size OK: $GZIP_SIZE bytes (gzipped)"
```

**Benefits:**
- Automated bundle size regression detection
- Forces discussion on large PRs
- Maintains fast initial load times

**Acceptance Criteria:**
- CI check runs on all PRs
- Fails if gzipped bundle exceeds 851 kB (5% buffer)
- Provides clear error message with current vs. threshold size
- Can be overridden with justification comment

---

## 3. Tree-Shaking Audit

**Priority:** Low
**Effort:** Medium (2-3 days)
**Value:** Medium - potential bundle size reduction

### Background

Current bundle size is acceptable (831 kB gzipped), but a tree-shaking audit may identify unused code that can be eliminated.

### Enhancement

Perform comprehensive tree-shaking audit:

**Steps:**
1. **Analyze bundle composition:**
   ```bash
   npm run build -- --mode analyze
   # Use webpack-bundle-analyzer or similar
   ```

2. **Identify unused exports:**
   - Use `ts-unused-exports` or `eslint-plugin-tree-shaking`
   - Find dead code in large files (ReactFlowGraph, vendor bundles)

3. **Check dependencies:**
   - Audit `package.json` for unused dependencies
   - Check for duplicate dependencies in bundle
   - Verify side-effect-free packages marked correctly

4. **Optimize imports:**
   - Replace barrel imports with direct imports
   - Example: `import { Button } from 'lucide-react'` → `import Button from 'lucide-react/dist/esm/icons/button'`

**Expected Savings:**
- 5-10% bundle size reduction (40-80 kB gzipped)
- Faster build times
- Smaller vendor chunks

**Acceptance Criteria:**
- Bundle size reduced by at least 5%
- No functionality regressions
- Build time not increased
- Documentation updated with new baseline

**Defer If:**
- Bundle size remains <1 MB gzipped
- No performance complaints from users
- Higher priority work exists

---

## 4. Dynamic Import Optimization

**Priority:** Low
**Effort:** Medium (2-3 days)
**Value:** Low-Medium - improves TTI for specific routes

### Background

Some large bundles are already code-split (ELK, html2canvas), but others could benefit from dynamic imports.

### Enhancement

Add dynamic imports for rarely-used features:

**Candidates:**
```typescript
// Sentry error tracking (74 kB) - only load if error occurs
const Sentry = await import('./lib/sentry')

// html2canvas (199 kB) - only load when screenshot triggered
const html2canvas = await import('html2canvas')

// Large UI components used in specific routes only
const GoalModePanel = lazy(() => import('./canvas/panels/GoalModePanel'))
const RunReportDrawer = lazy(() => import('./canvas/panels/RunReportDrawer'))
```

**Benefits:**
- Faster initial page load (Time to Interactive)
- Smaller critical path bundle
- Better cache granularity

**Risks:**
- Slight delay when feature first accessed
- Increased complexity (loading states, error handling)
- More HTTP requests (HTTP/2 mitigates this)

**Acceptance Criteria:**
- Critical path bundle reduced by 10% (23 kB gzipped)
- Loading states shown for lazy-loaded components
- Error boundaries handle dynamic import failures
- No change to user-facing functionality

---

## 5. ELK Layout Web Worker

**Priority:** Medium
**Effort:** Large (5-7 days)
**Value:** High - prevents UI blocking during auto-layout

### Background

ELK layout engine (1.5 MB) is lazy-loaded but runs synchronously on main thread, blocking UI during computation.

### Enhancement

Move ELK layout to Web Worker:

**Implementation:**
```typescript
// src/canvas/workers/elk.worker.ts
import ELK from 'elkjs/lib/elk.bundled.js'

self.addEventListener('message', async (e) => {
  const { graph, options } = e.data
  const elk = new ELK()
  const layout = await elk.layout(graph, options)
  self.postMessage({ layout })
})

// src/canvas/hooks/useELKLayout.ts
const elkWorker = new Worker('./workers/elk.worker.ts', { type: 'module' })

export function useELKLayout() {
  return async (graph) => {
    return new Promise((resolve) => {
      elkWorker.postMessage({ graph, options })
      elkWorker.addEventListener('message', (e) => {
        resolve(e.data.layout)
      }, { once: true })
    })
  }
}
```

**Benefits:**
- UI remains responsive during auto-layout
- Can show progress indicator without blocking
- Better user experience for large graphs (50+ nodes)

**Challenges:**
- Web Worker setup complexity
- Vite/Webpack worker bundling configuration
- SharedArrayBuffer requirements for some browsers
- Testing Web Workers in Vitest

**Acceptance Criteria:**
- ELK layout runs in background without UI blocking
- Progress indicator shows during computation
- Layout result correctly applied to graph
- No regressions in layout quality
- Works in all supported browsers

---

## 6. CDN Offloading for Vendor Bundles

**Priority:** Low
**Effort:** Small (1 day)
**Value:** Medium - better caching, faster loads

### Background

Vendor bundles (React, ReactFlow, ELK) are served from our domain. Offloading to CDN improves caching and load times.

### Enhancement

Use CDN for stable vendor libraries:

**Candidates:**
```html
<!-- React from CDN (239 kB → CDN cached) -->
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

<!-- Or use ESM CDN -->
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18",
    "react-dom": "https://esm.sh/react-dom@18"
  }
}
</script>
```

**Benefits:**
- Shared cache across sites
- Reduced bandwidth costs
- Faster loads for repeat visitors

**Risks:**
- CDN availability/reliability dependency
- Version pinning complexity
- CORS/CSP configuration required
- Slightly slower first load (DNS lookup)

**Recommendation:**
- Defer until bundle size becomes problem (>1.5 MB)
- Focus on other optimizations first (tree-shaking, code-splitting)

---

## Priority Summary

| Enhancement | Priority | Effort | Value | Recommend Phase |
|-------------|----------|--------|-------|-----------------|
| Slow-Run Telemetry | Medium | Small | High | Phase 3 |
| Bundle Size CI Check | Low | Trivial | Medium | Phase 3 |
| Tree-Shaking Audit | Low | Medium | Medium | Phase 4 (if bundle >1MB) |
| Dynamic Import Optimization | Low | Medium | Low-Med | Phase 4 |
| ELK Web Worker | Medium | Large | High | Phase 3 or 4 |
| CDN Offloading | Low | Small | Medium | Phase 4 (if needed) |

**Phase 3 Recommended:**
1. Slow-Run Telemetry (quick win, high value)
2. Bundle Size CI Check (quick win, prevents regressions)
3. ELK Web Worker (medium effort, high UX impact)

**Phase 4 or Later:**
- Tree-shaking audit (only if bundle grows >1MB)
- Dynamic import optimization (diminishing returns)
- CDN offloading (only if needed for scale)
