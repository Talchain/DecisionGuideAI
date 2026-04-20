# Codex Handoff: UI Update Validation via Simulated Manual Interactions

This runbook is the default playbook for validating **any UI update** made by Claude Code (or another agent) using real browser automation.

## When to Use
Use this whenever the request is effectively:
- "validate latest UI updates"
- "smoke test this frontend change"
- "check whether this interaction is reliable"
- "test what Claude just changed"

## Core Principle
Do **interaction-first** validation with a real browser, not static code review alone.

---

## 1) Intake and Scope the Change
Before clicking around, define what changed.

Minimum intake:
1. Identify changed files (`git diff --name-only`).
2. Map files to affected routes/components.
3. List top user-visible risks (behavior, regressions, accessibility, perf signs).
4. Convert risks into concrete checks.

Example check matrix:
- Happy path: primary user action works end-to-end.
- Negative path: invalid action yields clear feedback.
- Regression path: nearby existing behavior still works.
- State integrity: UI reflects store/server truth.

---

## 2) Use a Stable App Runtime
Prefer stability over dev convenience for automation.

Default:
```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

If dev mode is used and unstable (e.g. `504 Outdated Optimize Dep`), switch to preview.

Route choice:
- Use the feature-specific route under test.
- For canvas checks in this repo, use: `http://127.0.0.1:4173/#/canvas?e2e=1`.

---

## 3) Execute Simulated Manual Interactions
Use Playwright and run the same interactions a human would perform.

Recommended coverage for most UI updates:
1. Click/tap flow for updated controls.
2. Keyboard flow (`Tab`, `Enter`, `Esc`, modifier keys).
3. Drag/drop or resize interactions (if relevant).
4. Error feedback and disabled-state behavior.
5. Quick responsive pass (at least one narrow viewport if layout changed).

Capture evidence while running:
- before/after state values
- selected IDs / visible labels
- toast/error messages
- network/console anomalies

---

## 4) Validate State and Data Consistency
For interaction-heavy features, compare visual behavior to authoritative state.

Examples:
- UI selected items match store selected IDs.
- Action that should be non-structural does not alter history.
- Data-edit actions update expected store fields only.

In this repo, `window.useCanvasStore` is available for deterministic assertions in E2E-style checks.

---

## 5) Report Results in a Standard Format
Always return:
1. PASS/FAIL per check.
2. Observed values (not just "looks good").
3. Residual risks and confidence level.
4. What was not tested.

---

## Known Gotchas (Repo-Specific)
- Dev server can intermittently serve `504 Outdated Optimize Dep`; preview mode is more stable for browser automation.
- Overlays/top bars may intercept locator clicks; use coordinate-based mouse actions when necessary.
- External CORS noise (e.g. `plot-lite-service.onrender.com/health`) may be expected; treat as non-blocking unless mount/flow fails.

---

## Reusable Prompt for Any Codex Agent
Use this verbatim:

```text
Validate the latest UI updates made by Claude Code using simulated manual interactions in a real browser.

Requirements:
1) Start by scoping changed files and deriving a risk-based check matrix.
2) Run browser automation against the affected route(s) and execute human-like interaction flows.
3) Cover happy path, at least one negative path, and nearby regression checks.
4) Validate UI state consistency against authoritative app state where possible.
5) Capture concrete evidence (observed values, selected IDs, messages, state deltas).

Execution guidance:
- Prefer build + preview for stability; if dev mode is flaky (e.g. 504 Outdated Optimize Dep), switch to preview.
- Ignore expected external CORS noise unless it blocks the tested flow.

Deliverable format:
- PASS/FAIL per check
- observed evidence for each check
- residual risks + confidence level
- explicit list of untested areas
```

---

## Appendix A: Canvas Module Checks (When Canvas Files Changed)
Run these when changes touch `src/canvas/**`, `src/index.css` (canvas styles), or React Flow interaction code.

### Deterministic canvas seed
```js
window.useCanvasStore.getState().importCanvas(JSON.stringify({
  version: 1,
  timestamp: Date.now(),
  nodes: [
    { id: '1', type: 'decision', position: { x: 160, y: 140 }, data: { label: 'Start' } },
    { id: '2', type: 'decision', position: { x: 160, y: 320 }, data: { label: 'Option A' } },
    { id: '3', type: 'decision', position: { x: 480, y: 320 }, data: { label: 'Option B' } },
  ],
  edges: [
    { id: 'e1', source: '1', target: '2', type: 'styled', data: { belief: 0.5, weight: 1 } },
    { id: 'e2', source: '1', target: '3', type: 'styled', data: { belief: 0.5, weight: 1 } },
  ],
}))
```

### Canvas checks
1. Edge hit-target at midpoint and perpendicular offsets.
2. Select-only clicks do not push history.
3. Zustand `selection` matches `selected` flags on nodes/edges.
4. Handle drag-connect succeeds when drag starts just outside visual handle if hit area was expanded.
5. Cmd/Ctrl multi-select and drag-select both work.
