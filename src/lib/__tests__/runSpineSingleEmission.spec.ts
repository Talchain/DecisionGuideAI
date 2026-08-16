// src/lib/__tests__/runSpineSingleEmission.spec.ts
// =============================================================================
// ROADMAP 1.68 — SINGLE EMISSION per run, ONE payload shape per event name.
// =============================================================================
//
// THE DEFECT
// ----------
// `run_completed` and `run_failed` each had TWO emitters that always both fired:
//
//   · `useV2Run.ts:980` / `:633,:801,:839,:1177` — the run path
//   · `OutputsDock.tsx:1588` / `:1598`           — a store-status-transition effect
//
// and `OutputsDock` CONSUMES `useV2Run` (`OutputsDock.tsx:696`), so every run
// produced two of each. Worse, the two payloads were DISJOINT: useV2Run sent
// `{duration_ms, option_count, has_drivers, request_id}` while OutputsDock sent
// the declared `{confidence_level, drivers_informative, trace_id, duration_ms}`.
// One event name with two shapes is the exact defect the measurement design
// rejected `metrics.ts` for — a dashboard nobody can trust — and it was live.
// It was invisible only because the whole module was dark.
//
// WHICH EMITTER WON, AND WHY IT IS NOT THE OBVIOUS ONE
// ---------------------------------------------------
// OutputsDock won on COVERAGE. It watches the results STORE, so it fires for
// every run path — `useV2Run`, `useResultsRun`, `applyV5State.ts:1064` and
// `useConversation.ts:3144/:3251`. The last two are the CEE-driven analysis
// path, which never touches `useV2Run`. Keeping useV2Run as canonical instead
// would have silently dropped the platform's primary analysis path — a
// coverage loss that no test would have shown, because there is no test that
// drives the CEE path through this seam.
//
// This spec pins the ABSENCE of the second emitter at the source, which is the
// only place the invariant is checkable without assembling both React trees.
// The claim type is therefore SOURCE-DERIVED, and it is named as such.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

/**
 * Every non-test file under `src/` whose source CALLS `fn` (a call, not a
 * mention — comments are stripped first, exactly as `countCalls` does).
 * Returns repo-relative paths, sorted, so an assertion can bind to the set.
 */
function walkSrcFor(fn: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue
        walk(rel)
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.spec\.|\.test\./.test(entry.name)) {
        if (countCalls(read(rel), fn) > 0) out.push(rel)
      }
    }
  }
  walk('src')
  return out.sort()
}

// ROADMAP 2.1229 — `src/canvas/hooks/useV2Run.ts` was the SECOND emitter this
// spec was written to keep silent. It is deleted with the direct `/v2/run`
// seam, so the "does not call" half of the invariant is now satisfied by the
// file's non-existence and is not worth asserting. What survives, and is still
// load-bearing, is the OutputsDock side: exactly one emitter per run-spine
// event, from the store-transition effect that observes EVERY run path.
const OUTPUTS_DOCK = 'src/canvas/components/OutputsDock.tsx'

/** A CALL, not a mention. Comments in both files name these deliberately. */
const callOf = (fn: string) => new RegExp(String.raw`(?<!//[^\n]{0,200})\b${fn}\s*\(`, 'g')

function countCalls(source: string, fn: string): number {
  // Strip comments first — both files explain the deleted emitters in prose,
  // and counting prose would make this invariant impossible to document.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  return (code.match(callOf(fn)) ?? []).length
}

describe('1.68 · exactly one emitter per run-spine event', () => {
  it('ANTI-VACUITY — both files are readable and non-trivial', () => {
    // Without this, a wrong path would make every "zero calls" assertion below
    // pass by reading an empty string.
    expect(read(OUTPUTS_DOCK).length, `${OUTPUTS_DOCK} looks empty`).toBeGreaterThan(20_000)
  })

  it('POSITIVE CONTROL — the counter can SEE a call before it reports none', () => {
    // OutputsDock is the canonical emitter, so it MUST show calls. If these are
    // zero the matcher is broken and the absence assertions are vacuous.
    expect(
      countCalls(read(OUTPUTS_DOCK), 'trackRunCompleted'),
      'the call counter found no trackRunCompleted in OutputsDock — it is either no longer ' +
        'the canonical emitter (in which case run_completed now fires NOWHERE) or this ' +
        'matcher has broken and the assertions below are testing nothing',
    ).toBe(1)

    // TWO trackRunFailed call sites, and both are load-bearing — this count went
    // 1 → 2 when the HTTP-200-but-failed regression was fixed, and the number is
    // stated with its reason so a THIRD still reds rather than being waved
    // through as "the count moved again":
    //
    //   1. the ERROR-STATUS transition — covers the four failure paths that
    //      settle through `resultsError` (useV2Run :662, :824, :1114, :1185, plus
    //      useResultsRun, applyV5State and useConversation);
    //   2. the COMPLETE transition whose report `isErrorReport()` identifies —
    //      the fifth path (`useV2Run.ts:846-866`), which settles a FAILURE via
    //      `resultsComplete` because that is what renders the critique list.
    //
    // They are mutually exclusive by construction: (2) is the else-less branch
    // of the complete-transition, (1) is the error-transition. So exactly one
    // event still fires per settle.
    expect(
      countCalls(read(OUTPUTS_DOCK), 'trackRunFailed'),
      'the number of trackRunFailed call sites in OutputsDock changed. Two are expected — ' +
        'the error-status transition, and the complete-transition whose report is an error ' +
        'report. A third would mean a settle can emit run_failed twice.',
    ).toBe(2)
  })

  it('run_started has exactly one emitter, and it is OutputsDock', () => {
    expect(countCalls(read(OUTPUTS_DOCK), 'trackRunStarted')).toBe(1)
  })

  it('plot.empty_computed_results now has ZERO emitters — pinned, not lost', () => {
    // ⚠ THIS IS A RECORDED GAP, NOT A PASSING CAPABILITY.
    //
    // `trackEmptyComputedResults` had exactly ONE emitter — `useV2Run`, which
    // detected the computed-but-empty anomaly inside the direct `/v2/run` path
    // and never put it on the store, so OutputsDock could not observe it.
    // ROADMAP 2.1229 deleted that path, so the event now fires NOWHERE.
    //
    // The detection itself survives (`detectComputedButEmpty`, called by
    // `adapters/plot/v2/responseMapper.ts`); only the emission went. Pinning
    // the zero here means the gap is visible in the suite and REDs the moment
    // someone re-adds an emitter — rather than the telemetry quietly ceasing
    // with the spec that used to describe it. Rowed for the canonical path.
    const emitters = walkSrcFor('trackEmptyComputedResults').filter(
      (f) => f !== 'src/lib/resultsInstrumentation.ts',
    )
    expect(
      emitters,
      'plot.empty_computed_results has an emitter again. That is welcome — but this pin ' +
        'records that it had none after the /v2/run retirement, so update it deliberately.',
    ).toEqual([])
  })

  it('there is exactly ONE trackCompareOpened in the repo — no same-named twin', () => {
    // `lib/resultsInstrumentation.ts` used to export a PostHog `trackCompareOpened`
    // with zero call sites while the real compare-open actions called a
    // same-named counter in `canvas/utils/sandboxTelemetry.ts`. An import-site
    // typo between two same-named senders is invisible in review.
    const spine = read('src/lib/resultsInstrumentation.ts')
    expect(
      /export function trackCompareOpened/.test(spine),
      'resultsInstrumentation.ts exports trackCompareOpened again — that recreates the twin. ' +
        'compare_opened belongs to canvas/utils/sandboxTelemetry.ts, which drives both sinks.',
    ).toBe(false)
    const sandbox = read('src/canvas/utils/sandboxTelemetry.ts')
    expect(/export function trackCompareOpened/.test(sandbox)).toBe(true)
    expect(
      sandbox.includes("trackEvent('compare_opened')"),
      'the surviving trackCompareOpened no longer reaches PostHog — the real compare-open ' +
        'actions would increment a counter nobody reads and emit nothing.',
    ).toBe(true)
  })
})
