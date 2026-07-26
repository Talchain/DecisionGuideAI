/**
 * RETURNING USER — the ANSWER must survive a reload, not just the diagram.
 *
 * THE FAILURE THIS PINS (live on staging, reproduced 25 Jul 2026 by driving
 * the deployed product): you run the analysis from the conversation, get a
 * recommendation, close the tab, come back — the 19-node model returns intact
 * and the results panel is back to "Analysis available / Analyse first pass",
 * as though nothing had ever been run.
 *
 * Mechanism: `results.seed` is set ONLY by `resultsStart`, which only the
 * direct Run-button path calls. The canonical V5 / conversation path goes
 * through `resultsAnalysing` ("no seed is known yet"), so on a fresh session
 * `results.seed` is `undefined` and `resultsComplete`'s run-history write was
 * skipped wholesale — while `last_result_hash` was written to the scenario
 * record regardless. `tryRestoreResultsFromHistory` then looked up a run that
 * had never been stored and silently found nothing.
 *
 * Live corroboration: after a conversation-driven analysis on staging, the
 * `olumi-canvas-run-history` localStorage key did not exist at all.
 *
 * ⚠ SCOPE CORRECTION (25 Jul 2026, after capturing the live wire): these tests
 * pin the STORE CONTRACT, and the fix they pin is INERT ON THE DEPLOYED PATH.
 * Do not cite this file as evidence that a returning user gets their answer
 * back — they do not. The live V5 handler (`applyV5State.ts` ~L1015) calls
 * `resultsComplete` with `rawV2Response: null`, and the live envelope carries
 * no `seed_used` anywhere, so `runHistorySeed` is undefined in production and
 * this write never fires. Live acceptance recorded this as a FAIL, honestly.
 * See `parallel-briefs/RETURNING-USER-2026-07-25.md` §3.
 *
 * ⚠⚠ STATUS UPDATE, 26 Jul 2026 — THE CORRECTION ABOVE STANDS, AND THE USER-
 * FACING DEFECT IS NOW FIXED SOMEWHERE ELSE. Read both halves of that sentence.
 *
 *   - STILL TRUE: everything above. The seed-gated run-history write these
 *     tests exercise remains INERT on the deployed V5 path. Nothing in this
 *     file has become deployed-path evidence, and it must still never be cited
 *     as such. Re-probed on live staging 26 Jul after a real conversation-
 *     driven analysis: `'seed' in results === false` and
 *     `olumi-canvas-run-history` does not exist as a key.
 *   - NEWLY TRUE: the returning user DOES now get the answer back — via a
 *     different mechanism that does not need a seed. The completed analysis is
 *     persisted into the autosave record beside the graph it was computed over
 *     (`store/scenarios.ts` → `PersistedAnalysis`) and restored from there.
 *     A second dead link the 25 Jul pass had not found is also closed: the
 *     `last_result_hash` POINTER was written onto a scenario record that guest
 *     mode never creates (`olumi-canvas-scenarios` absent, live-probed), so
 *     even a stored run could not have been found.
 *
 * These tests are KEPT rather than deleted: they are a valid pin on the store
 * contract, they document the seed hazard (never fabricate one — trap #10), and
 * they are the right shape for the day CEE echoes a run identity. They are
 * simply not the thing that fixed the user's problem.
 *
 * The deployed-path evidence lives in
 * `src/canvas/__tests__/analysisSurvivesLeaveAndReturn.spec.ts` plus the live
 * leave-and-return acceptance recorded in that PR — not here.
 *
 * CLAIM TYPE: this is a STORE-STATE pin (what the results panel branches on),
 * not a rendering or visibility claim, and NOT a claim about deployed behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'
import { loadRuns } from '../store/runHistory'
import type { ReportV1 } from '../../adapters/plot/types'

const RESPONSE_HASH = 'sha256:conversation-run-abc123'

function minimalReport(): ReportV1 {
  return {
    summary: 'Double Down on Wholesale currently leads.',
    options: [],
  } as unknown as ReportV1
}

function rawWithEchoedSeed(seed: number | null) {
  return {
    response_hash: RESPONSE_HASH,
    meta: seed == null ? {} : { seed_used: seed },
    option_comparison: [],
  } as never
}

describe('a conversation-driven analysis survives a reload', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} }] as never,
      edges: [] as never,
      results: { status: 'idle', progress: 0 },
      currentScenarioId: null,
    })
  })

  it('POSITIVE CONTROL — the direct Run path (seed known) always reached run history', () => {
    useCanvasStore.getState().resultsStart({ seed: 42 })
    useCanvasStore.getState().resultsComplete({
      report: minimalReport(),
      hash: RESPONSE_HASH,
      resultsSource: 'direct',
      rawV2Response: rawWithEchoedSeed(42),
    })
    const runs = loadRuns()
    expect(runs).toHaveLength(1)
    expect(runs[0].hash).toBe(RESPONSE_HASH)
    expect(runs[0].seed).toBe(42)
  })

  it('the conversation path (no resultsStart) now reaches run history too', () => {
    // Exactly the live shape: resultsAnalysing, never resultsStart.
    useCanvasStore.getState().resultsAnalysing()
    expect(useCanvasStore.getState().results.seed).toBeUndefined()

    useCanvasStore.getState().resultsComplete({
      report: minimalReport(),
      hash: RESPONSE_HASH,
      resultsSource: 'conversation',
      rawV2Response: rawWithEchoedSeed(918273),
    })

    const runs = loadRuns()
    expect(runs).toHaveLength(1)
    expect(runs[0].hash).toBe(RESPONSE_HASH)
    // The seed is the ENGINE'S OWN ECHO, never a fabricated 0.
    expect(runs[0].seed).toBe(918273)
    expect(runs[0].report).toBeTruthy()
  })

  it('the stored run is the one a returning session looks up by response hash', () => {
    useCanvasStore.getState().resultsAnalysing()
    useCanvasStore.getState().resultsComplete({
      report: minimalReport(),
      hash: RESPONSE_HASH,
      resultsSource: 'conversation',
      rawV2Response: rawWithEchoedSeed(918273),
    })

    // Simulate the reload: a fresh store, then the lookup loadScenario performs.
    useCanvasStore.setState({ results: { status: 'idle', progress: 0 } })
    const found = loadRuns().find((r) => r.hash === RESPONSE_HASH)
    expect(found).toBeDefined()

    useCanvasStore.getState().resultsLoadHistorical(found!)
    // This is what the results panel branches on: 'complete' renders the
    // answer, 'idle' renders the "Analyse first pass" pre-analysis state.
    expect(useCanvasStore.getState().results.status).toBe('complete')
    expect(useCanvasStore.getState().results.hash).toBe(RESPONSE_HASH)
  })

  it('still refuses to invent a seed when the engine echoed none', () => {
    useCanvasStore.getState().resultsAnalysing()
    useCanvasStore.getState().resultsComplete({
      report: minimalReport(),
      hash: RESPONSE_HASH,
      resultsSource: 'conversation',
      rawV2Response: rawWithEchoedSeed(null),
    })
    // No echo, no stored run — a run identity built on a fabricated seed would
    // fork the graph hash (CLAUDE.md trap #10). Better absent than false.
    expect(loadRuns()).toHaveLength(0)
  })
})
