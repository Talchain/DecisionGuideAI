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
import { readFileSync } from 'node:fs'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

const USE_V2_RUN = 'src/canvas/hooks/useV2Run.ts'
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
    expect(read(USE_V2_RUN).length, `${USE_V2_RUN} looks empty`).toBeGreaterThan(20_000)
    expect(read(OUTPUTS_DOCK).length, `${OUTPUTS_DOCK} looks empty`).toBeGreaterThan(20_000)
  })

  it('POSITIVE CONTROL — the counter can SEE a call before it reports none', () => {
    // OutputsDock is the canonical emitter, so it MUST show calls. If this is
    // zero the matcher is broken and the absence assertions are vacuous.
    expect(
      countCalls(read(OUTPUTS_DOCK), 'trackRunCompleted'),
      'the call counter found no trackRunCompleted in OutputsDock — it is either no longer ' +
        'the canonical emitter (in which case run_completed now fires NOWHERE) or this ' +
        'matcher has broken and the assertions below are testing nothing',
    ).toBe(1)
    expect(countCalls(read(OUTPUTS_DOCK), 'trackRunFailed')).toBe(1)
  })

  for (const fn of ['trackRunCompleted', 'trackRunFailed'] as const) {
    it(`useV2Run.ts does NOT call ${fn} — OutputsDock is canonical`, () => {
      expect(
        countCalls(read(USE_V2_RUN), fn),
        `useV2Run.ts calls ${fn} again. OutputsDock consumes this hook and emits the same ` +
          'event from a store-transition effect, so every run would fire twice — and with a ' +
          'different payload shape, which is what makes it corrupting rather than merely noisy.',
      ).toBe(0)
    })
  }

  it('run_started has exactly one emitter, and it is OutputsDock', () => {
    expect(countCalls(read(OUTPUTS_DOCK), 'trackRunStarted')).toBe(1)
    expect(countCalls(read(USE_V2_RUN), 'trackRunStarted')).toBe(0)
  })

  it('plot.empty_computed_results has exactly one emitter, and it is useV2Run', () => {
    // The asymmetry is deliberate: this anomaly is detected inside the run path
    // and never reaches the store, so OutputsDock cannot observe it.
    expect(countCalls(read(USE_V2_RUN), 'trackEmptyComputedResults')).toBe(1)
    expect(countCalls(read(OUTPUTS_DOCK), 'trackEmptyComputedResults')).toBe(0)
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
