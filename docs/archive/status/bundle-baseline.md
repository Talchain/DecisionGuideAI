# Bundle Size Baseline

**Date:** 2025-01-15 (Phase 2 Sprint 1B)
**Branch:** feature/phase-2-integration
**Build Time:** 19.00s

This document establishes the production bundle size baseline after Phase 1 CEE P0 Stabilization (PRs #23 and #24) and Phase 2 High-Impact Stabilisation work.

## Purpose

- **Monitoring:** Track bundle size growth over time
- **Alerting:** Identify unexpected size increases
- **Optimization:** Guide code-splitting and lazy-loading decisions
- **Performance:** Maintain fast initial load times

## Total Bundle Size

| Metric | Size | Notes |
|--------|------|-------|
| **Total dist/** | ~2.9 MB | All assets (JS, CSS, HTML, maps) |
| **Total JS (minified)** | ~2.8 MB | All JavaScript bundles |
| **Total JS (gzip)** | ~831 kB | Compressed for network transfer |
| **Total CSS** | ~96 kB | All stylesheets |
| **Total CSS (gzip)** | ~18 kB | Compressed stylesheets |

## Critical Path Bundles

These bundles load on initial page load and impact Time to Interactive (TTI):

### Main Entry Point
```
index-3XnoH9Xo.js           25.90 kB │ gzip:   9.15 kB
index-CzMQSry8.css          77.70 kB │ gzip:  13.81 kB
```

### Vendor Bundles
```
vendor-CqUudXqw.js         370.93 kB │ gzip: 110.76 kB  ⚠️ Core utilities
react-vendor-C1ab4zbu.js   239.75 kB │ gzip:  75.29 kB  ⚠️ React ecosystem
rf-vendor-TOiyt26i.js       43.21 kB │ gzip:  15.96 kB  React Flow
sentry-vendor-C-XEitoU.js   74.18 kB │ gzip:  24.94 kB  Error tracking
```

**Critical Path Total:** ~754 kB minified, ~235 kB gzipped

## Large Lazy-Loaded Bundles

These bundles are code-split and load on demand:

```
elk-vendor-BqSoxug-.js              1,501.70 kB │ gzip: 441.05 kB  ⚠️ ELK layout engine
ReactFlowGraph-Cyc6LkCL.js            295.35 kB │ gzip:  77.49 kB  Canvas graph editor
html2canvas-vendor-BT-X_Vmd.js        198.79 kB │ gzip:  46.05 kB  Screenshot capture
SandboxStreamPanel-TetWmhDT.js         75.01 kB │ gzip:  20.24 kB  Analysis panel
AppPoC-epIbClI3.js                     52.30 kB │ gzip:  16.67 kB  PoC mode entry
PlotWorkspace-Krp1y6qp.js              36.57 kB │ gzip:  10.73 kB  Workspace UI
```

## Feature Bundles

### Decision Templates
```
DecisionTemplates-BdJEn3vF.js    6.98 kB │ gzip:  2.68 kB
TemplatesPanel-mubtqBsQ.js      21.06 kB │ gzip:  6.95 kB
```

### Canvas Features
```
CanvasMVP-VFjcVyKT.js            3.46 kB │ gzip:  1.69 kB
PlcCanvas-Xr_fuGpK.js            3.67 kB │ gzip:  1.76 kB
ReactFlowGraph-B36MB6c8.css      1.25 kB │ gzip:  0.56 kB
```

### Analysis & Results
```
SandboxV1-BDsaSfON.js           19.05 kB │ gzip:  4.95 kB
RunReportDrawer-BK3vc8In.js     12.65 kB │ gzip:  3.73 kB
ProgressStrip-BNp0-_IH.js       10.10 kB │ gzip:  3.22 kB
```

### Panels & Drawers
```
InspectorPanel-Ckz8fSWH.js       8.25 kB │ gzip:  2.64 kB
ScenarioDrawer-ULuAYwne.js       6.63 kB │ gzip:  2.63 kB
GoalModePanel-RaDDY_4N.js        5.83 kB │ gzip:  2.07 kB
ConfigDrawer-AuhJ8JlN.js         5.02 kB │ gzip:  1.80 kB
IssuesPanel-BDTEDhHh.js          4.72 kB │ gzip:  1.74 kB
```

## Template Blueprints

Small, lazy-loaded template definitions:

```
hiring-v1-Da_a_APo.js                  0.61 kB │ gzip:  0.35 kB
feature-tradeoffs-v1-CrmJzN-X.js       0.60 kB │ gzip:  0.36 kB
supply-v1-CCfdJM9W.js                  0.60 kB │ gzip:  0.35 kB
retention-v1-f_hP80Xx.js               0.56 kB │ gzip:  0.34 kB
pricing-v1-CaLGM8AQ.js                 0.56 kB │ gzip:  0.34 kB
marketing-v1-DpBkC8xb.js               0.56 kB │ gzip:  0.34 kB
```

## Size Thresholds

### Warning Thresholds (Vite default: 500 kB)

Currently exceeding 500 kB minified:
1. **elk-vendor-BqSoxug-.js** (1,501.70 kB) - ELK layout engine for auto-layout

### Recommended Actions

**High Priority:**
- ✅ ELK vendor is already code-split and lazy-loaded (only loads when user triggers auto-layout)
- ✅ html2canvas vendor is code-split (only loads for screenshots)
- ✅ Template blueprints are tiny and efficiently lazy-loaded

**Medium Priority:**
- Consider splitting ReactFlowGraph (295 kB) if canvas features grow significantly
- Monitor vendor.js (371 kB) and react-vendor.js (240 kB) growth

**Low Priority:**
- Feature bundles are well-sized (<25 kB each)
- Template blueprints are optimal (<1 kB each)

## Measurement Commands

```bash
# Build and show bundle sizes
npm run build

# Build and grep for size info
npm run build 2>&1 | grep -E "dist/|kB|bundle|size"

# Analyze bundle composition (if analyze plugin enabled)
npm run build -- --mode analyze

# Check specific bundle
ls -lh dist/assets/elk-vendor-*.js
```

## Monitoring

**Add to CI/CD pipeline:**

```bash
# Bundle size check script
npm run build
BUNDLE_SIZE=$(du -sh dist | awk '{print $1}')
echo "Bundle size: $BUNDLE_SIZE"

# Alert if total size exceeds threshold
if [ "$BUNDLE_SIZE" -gt "3M" ]; then
  echo "⚠️ Bundle size exceeds 3MB threshold!"
  exit 1
fi
```

## Historical Comparison

| Date | Branch | Total (gzip) | Critical Path (gzip) | Notes |
|------|--------|-------------|---------------------|--------|
| 2025-01-15 | feature/phase-2-integration | ~831 kB | ~235 kB | Phase 1 + Phase 2 baseline |

## Next Steps

**Phase 3 Optimization Opportunities:**

1. **Tree-shaking audit:** Ensure unused exports are eliminated
2. **Dependency audit:** Check for duplicate dependencies in vendor bundles
3. **Dynamic imports:** Consider further code-splitting for large features
4. **CDN offloading:** Move vendor bundles to CDN for better caching
5. **Compression:** Enable Brotli compression for even smaller transfers

## Notes

- All sizes are **production build** with minification enabled
- Gzip sizes represent actual bytes transferred over HTTP/2
- Source maps are excluded from transfer (dev-only)
- ELK vendor size is acceptable given it's lazy-loaded and provides critical auto-layout functionality
- Bundle size is within acceptable range for a modern SPA with graph visualisation capabilities
