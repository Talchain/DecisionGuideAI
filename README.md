DecisionGuideAI

## Quick PoC Start (Two-Minute Setup)

Get the Scenario Sandbox PoC running in under 2 minutes:

```bash
./tools/poc-start.sh
```

This starts all services with safe defaults (all features OFF):
- Gateway: http://localhost:3001
- Warp: http://localhost:4311
- Jobs: http://localhost:4500
- Usage Meter: http://localhost:4600

Quick test: `curl http://localhost:3001/health`

To enable specific features, edit `.env.poc` and restart with:
```bash
docker compose --profile poc --env-file .env.poc up -d
```

## Streaming (PoC)

Flag‑gated SSE streaming for the Scenario Sandbox. OFF by default.

Enable locally:

1) Set the flag (either env or localStorage):
```
VITE_FEATURE_SSE=1
// or in DevTools:
localStorage.setItem('feature.sseStreaming','1')
```
2) Optional auto‑reconnect (per‑browser):
```
localStorage.setItem('feature.sseAuto','1')
```
3) Ensure gateway URL is correct, e.g.:
```
VITE_EDGE_GATEWAY_URL=http://localhost:3001
```
4) Start sandbox and open:
```
npm run dev:sandbox
// open http://localhost:5176/#/sandbox (use bumped port if needed)
```

## Scenario Sandbox (PoC) – How to run locally

Flags (all OFF by default; enable via env or localStorage):
- VITE_FEATURE_SSE=1                  // or localStorage.setItem('feature.sseStreaming','1')
- VITE_FEATURE_JOBS_PROGRESS=1        // or localStorage.setItem('feature.jobsProgress','1')
- VITE_FEATURE_RUN_REPORT=1           // or localStorage.setItem('feature.runReport','1')
- VITE_USE_REAL_REPORT=1              // or localStorage.setItem('feature.realReport','1')
- VITE_FEATURE_CONFIDENCE_CHIPS=1     // or localStorage.setItem('feature.confidenceChips','1')
- VITE_FEATURE_TELEMETRY=1            // or localStorage.setItem('feature.telemetry','1')
- VITE_FEATURE_HINTS=1               // or localStorage.setItem('feature.hints','1')
  (enables terminal tooltips + limited budget tip)
// Optional stream buffering knob (default ON):
- VITE_STREAM_BUFFER=0|1             // or localStorage.setItem('feature.streamBuffer','0|1')
// Scenario Sandbox params (seed/budget/model):
- VITE_FEATURE_PARAMS=1              // or localStorage.setItem('feature.params','1')
// Markdown preview and Copy code buttons:
- VITE_FEATURE_MD_PREVIEW=1          // or localStorage.setItem('feature.mdPreview','1')
- VITE_FEATURE_COPY_CODE=1           // or localStorage.setItem('feature.copyCode','1')
// Transcript export buttons (.txt/.json/.md):
- VITE_FEATURE_EXPORT=1              // or localStorage.setItem('feature.export','1')
// Run Report: Copy JSON button
- VITE_FEATURE_REPORT_COPY=1         // or localStorage.setItem('feature.reportCopy','1')
// Run Report: Download JSON button
- VITE_FEATURE_REPORT_DOWNLOAD=1     // or localStorage.setItem('feature.reportDownload','1')
// Run Report: Pretty JSON toggle
- VITE_FEATURE_REPORT_PRETTY=1       // or localStorage.setItem('feature.reportPretty','1')

Copy/Download JSON are developer aids. They're off by default and must be explicitly enabled via env or localStorage.

// TLdraw adapter (optional; requires package)
- VITE_FEATURE_TLDRAW=1              // or localStorage.setItem('feature.tldraw','1')
  TLdraw support is OFF by default and requires installing @tldraw/tldraw. When not installed, the app falls back to the built-in canvas.

// Scenarios (templates)
- VITE_FEATURE_SCENARIOS=1           // or localStorage.setItem('feature.scenarios','1')
  Templates are local. Share links encode data in the URL — no server storage.

> **Tip:** See `.env.example`  for the common flags you can toggle locally.

E2E test mode:
- VITE_E2E=1 mounts the Sandbox surface directly in dev/test builds (no auth/providers). Playwright navigates to `/#/sandbox` (may include `/?e2e=1` in URLs for clarity; the query is ignored at runtime when VITE_E2E drives build-time checks).

Required env:
- VITE_EDGE_GATEWAY_URL=http://localhost:3001

Routes:
- /sandbox  (Scenario Sandbox PoC)
- /ghost    (draft list; UI-only)

Notes:
- “Stop” feels instant; tokens stop locally, server later confirms with “Aborted”.
- Run Report is read-only: seed, route, duration, totals, steps. Real report is used when `VITE_USE_REAL_REPORT=1` , otherwise a safe mock is shown.
- No PII is logged. Telemetry (if enabled) emits counters only.
- Developer aids (Replay and Report JSON Copy/Download/Pretty) are behind flags and OFF by default.

## Testing quickstart (Playwright + Chromium)

Prereqs: Node 18+, npm (or pnpm/yarn), dependencies installed.

1) Install the browser engine (one-time)
```bash
npx playwright install chromium
```

2) Run the full E2E suite (Chromium)
```bash
npx playwright test --project=chromium -c playwright.config.ts
```

3) Run a few targeted specs
```bash
# Core sandbox + drawer flows
npx playwright test e2e/report-drawer.spec.ts   --project=chromium -c playwright.config.ts
npx playwright test e2e/export-md.spec.ts       --project=chromium -c playwright.config.ts
npx playwright test e2e/sandbox-resume.spec.ts  --project=chromium -c playwright.config.ts

# Jobs + canvas + replay
npx playwright test e2e/jobs-progress.spec.ts   --project=chromium -c playwright.config.ts
npx playwright test e2e/canvas-drawer.spec.ts   --project=chromium -c playwright.config.ts
npx playwright test e2e/replay-run.spec.ts      --project=chromium -c playwright.config.ts

# TLdraw adapter (auto-skips if @tldraw/tldraw isn’t installed)
npx playwright test e2e/tldraw-adapter.spec.ts  --project=chromium -c playwright.config.ts
```

_Tip:_ check `.env.example`  for handy feature flags while developing.

4) Useful dev runs
```bash
# Headed, slow-mo for debugging
npx playwright test --project=chromium -c playwright.config.ts --headed --debug

# Re-run failing tests only
npx playwright test --project=chromium -c playwright.config.ts --last-failed
```

### Feature flags (developer aids)
Some features are OFF by default and gated for development. You can toggle them at runtime in DevTools Console:

```js
// Report tools
localStorage.setItem('feature.reportCopy', '1');
localStorage.setItem('feature.reportDownload', '1');
localStorage.setItem('feature.reportPretty', '1');

// Replay + Canvas (shim) + TLdraw adapter
localStorage.setItem('feature.replay', '1');
localStorage.setItem('feature.canvas', '1');
localStorage.setItem('feature.tldraw', '1'); // requires @tldraw/tldraw; otherwise falls back to built-in canvas
localStorage.setItem('cfg.gateway', 'http://localhost:8787');

// To reset:
['feature.reportCopy','feature.reportDownload','feature.reportPretty']
 .forEach(k => localStorage.removeItem(k));

// Deployment Verification
// 1. Check Version Fingerprint
// 2. Check Route Guard
// 3. Verify Rich UI Route
// 4. Compare with GitHub
