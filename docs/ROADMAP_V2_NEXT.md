# Canvas v2.1-v2.2 Roadmap

## Phase 1: Route Splitting (v2.1)
- ✅ scripts/report-chunks.mjs created
- ⏳ Lazy load Canvas/Sandbox/Scenarios/Reports
- Target: Each route <200KB gz

## Phase 2: Smoke Tests (v2.1)
- ⏳ 10 E2E flows in e2e/smoke/
- Canvas load, CRUD, snapshot, export, layout

## Phase 3: Web Vitals CI (v2.1)
- ⏳ LCP<2.5s, INP<100ms, CLS<0.1
- Playwright PerformanceObserver

## Phase 4: ELK Progress UX (v2.1)
- ⏳ Progress toast 0-100%
- Cancel button, error recovery

## Phase 5: Perf Benchmarks (v2.1)
- ⏳ 100 nodes <2s layout
- 300 nodes ≥55fps drag/zoom

## Phase 6: Toast Stress (v2.1)
- ⏳ 15 rapid toasts FIFO test

## Rich Node Types (v2.2)
- ⏳ Goal/Decision/Option/Risk/Outcome
- Palette, properties, convert

## Edge Styles (v2.2)
- ⏳ Weight, style, curvature
- Properties panel, legend

Status: Phase 1 started
