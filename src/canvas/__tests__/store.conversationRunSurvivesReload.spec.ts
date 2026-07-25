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
 * CLAIM TYPE: this is a STORE-STATE pin (what the results panel branches on),
 * not a rendering or visibility claim. The on-screen proof is the live
 * before/after in `parallel-briefs/RETURNING-USER-2026-07-25.md`.
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
