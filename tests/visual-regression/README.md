# Visual regression harness (Brief 5)

Lightweight scaffolding for catching unintended visual / DOM drift during Brief 5
(Analysis-tab UX polish). Hybrid approach:

- **Targeted per-phase diffs** use Vitest + Testing Library DOM snapshots (this folder).
  Fast (no dev server, no browsers), runs in the Tier 1 feedback loop.
- **Full-page diffs** use Playwright (repo-root `playwright.config.ts`). Captured
  manually at Phase 0 baseline, end of Phase 6, and Phase 7. Commands below.

## When to run

| Phase                | Surfaces captured (targeted)                       | Full-page? |
|----------------------|----------------------------------------------------|------------|
| Phase 0 (baseline)   | none (scaffold only)                               | yes        |
| Phase 1 (Task 4)     | footer                                             | no         |
| Phase 2 (Task 6)     | risk-control in Your-options + Advanced            | no         |
| Phase 3 (Task 2)     | drivers section (headers + first row)              | no         |
| Phase 4 (Task 3)     | sensitivity (tornado) card                         | no         |
| Phase 5 (Task 5)     | none — docs only                                   | no         |
| Phase 6 (Task 1)     | Your-expertise row (collapsed + expanded)          | yes        |
| Phase 7 (final pass) | spot-check any surface                             | yes        |

## Running the targeted diffs

```bash
npx vitest run tests/visual-regression --reporter=verbose
```

Vitest stores snapshots as `__snapshots__/*.snap` alongside the spec. To accept a new
snapshot:

```bash
npx vitest run tests/visual-regression -u
```

Snapshots are **normalised** (see `utils.ts`) before comparison — ordering of inline
styles is stabilised, `data-testid` attributes with per-run suffixes are stripped, and
whitespace is collapsed. The goal is to catch structural / copy / classname drift,
not render-order noise.

## Running full-page diffs (Playwright)

Full-page captures use the existing Playwright setup. They require the dev server.

```bash
# start dev server in one terminal
npm run dev

# in another terminal, capture baseline
npx playwright test e2e/brief-5/full-page.spec.ts --update-snapshots

# subsequent runs compare against the baseline
npx playwright test e2e/brief-5/full-page.spec.ts
```

A minimal Playwright spec lives at `e2e/brief-5/analysis-tab-fullpage.spec.ts`.
It's gated on `BRIEF5_FULLPAGE=1` so it does not add load to the default CI
run. Enable locally:

```bash
npm run dev -- --port 5177 --strictPort    # terminal 1
BRIEF5_FULLPAGE=1 npx playwright test e2e/brief-5/ --update-snapshots  # terminal 2
```

Subsequent runs (without `--update-snapshots`) compare against the stored
baseline. Tolerance is 0.1 % pixel difference.

## Diff tolerance

- DOM snapshots: byte-for-byte after normalisation.
- Pixel (Playwright): `toHaveScreenshot({ maxDiffPixelRatio: 0.001 })` (0.1%) to absorb
  font-rendering noise.

## Out of scope

- CI integration: optional per brief. Harness is local-only for now.
- Mobile / narrow-layout breakpoints: brief targets 1280px minimum per DS v5.
