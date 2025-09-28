DecisionGuideAI

## Status

🟢 **Platform Status:** Operational | [Start Here](./artifacts/start-here.html) | [Integration Status](./artifacts/integration-status.html) | [Evidence Pack](./artifacts/index.html) | [Operator Handbook](./docs/OPERATOR_HANDBOOK.md) | [Feature Flags](./artifacts/flags.html) | [FAQ](./artifacts/faq.md) | [Glossary](./artifacts/glossary.md)

[![Nightly Integration](https://img.shields.io/badge/Nightly%20Integration-%E2%9C%85%20Passing-brightgreen)](./artifacts/integration-status.html)

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

Required env:
- VITE_EDGE_GATEWAY_URL=http://localhost:3001

Routes:
- /sandbox  (Scenario Sandbox PoC)
- /ghost    (draft list; UI-only)

Notes:
- “Stop” feels instant; tokens stop locally, server later confirms with “Aborted”.
- Run Report is read-only: seed, route, duration, totals, steps. Real report is used when `VITE_USE_REAL_REPORT=1` , otherwise a safe mock is shown.
- No PII is logged. Telemetry (if enabled) emits counters only.

Troubleshooting:
- Confirm gateway URL (`VITE_EDGE_GATEWAY_URL`).
- Confirm flags are ON.
- Use the bumped dev server port if 5176 changes.

### Error Handling
For comprehensive error handling guidance, see [Error Mapping Guide](docs/ERROR-MAPPING-GUIDE.md).

The guide covers all error codes (BAD_INPUT, TIMEOUT, RATE_LIMIT, INTERNAL, RETRYABLE, BREAKER_OPEN) with:
- HTTP status mappings and retry guidance
- SSE counterparts and examples
- Complete 429 rate limit header handling
- Copy-paste curl and Node.js snippets

## Security Analysis (CodeQL)

CodeQL security analysis runs automatically on PR and pushes to main. Results are available in the "Code scanning" section of the repository.

Local analysis:
```bash
./tools/codeql-local.sh
```

This creates a database and SARIF report in `artifacts/` for local security review.
