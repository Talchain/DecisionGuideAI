# Canvas v2.1-v2.2 Roadmap

## Phase 1: Route Splitting (v2.1)
- ✅ scripts/report-chunks.mjs created
- ✅ Lazy load Sandbox routes
- ⏳ Lazy load remaining heavy routes (Canvas/Scenarios/Reports)
- Target: Each route <200KB gz

## Phase 2: Smoke Tests (v2.1)
- ✅ 10+ E2E flows in e2e/smoke/
- Canvas load, CRUD, snapshot, export, layout covered by dedicated specs (load, node-crud, snapshots, export-images, elk-layout)

## Phase 3: Web Vitals CI (v2.1)
- ✅ LCP<2.5s, INP<100ms, CLS<0.1 via e2e/webvitals.spec.ts
- Playwright PerformanceObserver wiring in E2E harness

## Phase 4: ELK Progress UX (v2.1)
- ✅ Canvas-level layout progress banner (non-blocking, shared across ELK entry points)
- ✅ Cancel hides the banner; Retry re-runs layout
- ⏳ Optional: true 0–100% progress + hard cancellation once engine/ELK expose progress + cancellation hooks

## Phase 5: Perf Benchmarks (v2.1)
- ⏳ 100 nodes <2s layout
- 300 nodes ≥55fps drag/zoom

## Phase 6: Toast Stress (v2.1)
- ⏳ 15 rapid toasts FIFO test

## Rich Node Types (v2.2)
- ✅ Goal/Decision/Option/Risk/Outcome node taxonomy (toolbar, inspector, quick-add)
- ✅ Palette, properties, convert (Command Palette node actions, NodeInspector type switch, node-types E2E)

## Edge Styles (v2.2)
- ⏳ Weight, style, curvature
- Properties panel, legend

Status: Scenario Sandbox shipped; next focus areas are route splitting (Canvas/Scenarios/Reports), Edge Styles, perf benchmarks, and toast stress.

## Scenario Sandbox (v2.2)

- ✅ Slices A–H: Scenario framing, run history, compare, share summary, and basic palette wiring
- ✅ Slice I: UX narrative alignment across Share, Compare, Results, and Diagnostics
- ✅ Slice J: Diagnostics tab and Issues panel discoverability (OutputsDock + ResultsPanel CTAs)
- ✅ Slice K: Command Palette completion (actions, nodes, edges, drivers, templates, scenario-aware runs)
- ✅ Slice L: Scenario context surfacing across RunHistory, ResultsPanel, Compare, and Share
- ✅ Slice M: Performance and ergonomics micro-improvements for Scenario Sandbox (debounced indexing, static template metadata, calm copy)

---

## Scenario Sandbox – Roadmap v2 (implementation notes)

### R1 polish – Draft loop clarifier + telemetry

**This is done when:**

- Multi-round clarifier answer history is covered by `ClarifierPanel` persistence tests (answers pre-filled per round, most recent wins).
- Draft My Model telemetry counters are exercised end-to-end in tests for:
  - `draft.request`, `draft.success`, `draft.error`, `draft.stream.start`, `draft.stream.done` in `useDraftModel` sync + streaming flows.
  - `draft.apply`, `draft.reject`, `draft.clarifier.submit`, `draft.clarifier.skip` via `DraftChat` DOM tests.

### R2 – Scenario Sandbox run telemetry + gating (✅ complete)

**This is done when:**

- Toolbar Run CTA, idle Results CTA, Command Palette "Run Analysis" action, Templates panel Run controls, and the Cmd/Ctrl+Enter keyboard shortcut all share the same `deriveRunEligibility` + `trackRunAttempt` gating.
- Telemetry counters `sandbox.run.clicked` and `sandbox.run.blocked` are incremented consistently for all of the above entry points.
- DOM/spec tests cover both blocked and allowed paths for each entry point with telemetry enabled, including:
  - CanvasToolbar DOM tests (validation errors, graph health errors, limits-at-capacity, happy path).
  - ResultsPanel idle CTA DOM tests (validation, health, limits, happy path).
  - CommandPalette DOM tests for empty vs non-empty graphs using a shared `baseState` store mock.
  - TemplatesPanel tests for dev Run controls with invalid vs valid seeds.
  - ReactFlowGraph/CanvasMVP DOM tests that dispatch Cmd/Ctrl+Enter on empty vs seeded graphs.
