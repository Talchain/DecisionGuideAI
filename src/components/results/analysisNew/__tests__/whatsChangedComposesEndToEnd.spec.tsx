/**
 * ⭐⭐ THE COMPOSITION PROOF — the one thing every other spec in this feature
 * cannot give.
 *
 * The five sibling specs each test ONE seam against a DOUBLE:
 *   · `runDeltaViewSaysOnlyWhatItKnows`  — the view model, from a literal
 *   · `whatsChangedRendersOnlyTheEntitledClaim` — the section, from a view model
 *   · `applyV5State.runDeltaBindsAndEvicts`     — the applicator, against a stub store
 *   · `storedRunDeltaBindsToItsAnalysis`        — the predicate, from literals
 *   · `viewComparisonPointerIsNavigationOnly`   — the pointer, from a seeded store
 *
 * Every one of them stays GREEN if the links do not join up. A wrong hash
 * identity, a selector reading a field the store never initialised, a memo that
 * does not re-run, a production store object that omits the setter — each makes
 * the section render NOTHING, and a silent no-render is indistinguishable from
 * "the producer sent no delta", which is the feature's own legitimate default.
 * N green seams do not compose into a working product.
 *
 * So this test runs the REAL chain: a wire-shaped response through the REAL
 * `applyV5State`, into the REAL canvas store, read back through the REAL hook,
 * rendered by the REAL section.
 *
 * ⚠ THE STORE OBJECT IS BUILT EXACTLY AS PRODUCTION BUILDS IT.
 * `useConversation.ts:4783` takes `useCanvasStore.getState()` whole and spreads
 * it, splicing in `currentResultsHash` from `results.hash`. Hand-picking members
 * here would test a shape production never uses — and the specific failure this
 * guards against is a production store that does not carry `setRunDelta`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import type { OlumiResponse, RunDelta } from '@talchain/schemas/boundary'
import { applyV5State } from '../../../../v5/applyV5State'
import { useCanvasStore } from '../../../../canvas/store'
import { useAnalysisNewViewModel } from '../useAnalysisNewViewModel'
import { WhatsChanged, WHATS_CHANGED_TESTID } from '../sections/WhatsChanged'
import { makeData } from './analysisNewFixtures'

const analysisBlock = {
  type: 'analysis_result' as const,
  summary: 'A leads',
  leading_option_id: 'opt_a',
  win_probabilities: { opt_a: 0.64, opt_b: 0.36 },
  enrichment: {},
}

const RUN_DELTA = {
  attribution_case: 'C1_attributable',
  pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true },
  leader: { changed: false, noise_verdict: 'signal' },
  win_probabilities: [{ option_id: 'opt_a', prior: 0.5, current: 0.64, noise_verdict: 'signal' }],
  flip_thresholds: [],
} as unknown as RunDelta

function wireResponse(extra: Record<string, unknown> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [analysisBlock],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    ...extra,
  } as OlumiResponse
}

/** EXACTLY the production construction — `useConversation.ts:4783,4805-4806`. */
function productionApplicatorStore() {
  const snap = useCanvasStore.getState()
  return { ...snap, currentResultsHash: snap.results?.hash ?? null } as never
}

beforeEach(() => {
  // ⚠ `results` MUST be cleared too, and finding that out was itself a result.
  // Leaving it set made the second apply see `currentResultsHash === hash`, so
  // the echo guard correctly skipped the write and the test read a null delta —
  // a case leaking into the next one, wearing a product defect's clothes.
  // (It also demonstrates the re-delivered-echo path doing its job.)
  // Back to the store's own cold-start results shape (`store.ts:3150`), not null —
  // null breaks readers that dereference `results.seed`.
  useCanvasStore.setState({
    runDelta: null,
    results: { status: 'idle', progress: 0 },
    currentScenarioId: 'scn-int',
  } as never)
})
afterEach(() => cleanup())

function renderChain(responseHash: string | undefined) {
  return renderHook(() =>
    useAnalysisNewViewModel({
      data: makeData(),
      isPreRun: false,
      isRunning: false,
      isStale: false,
      responseHash,
    }),
  )
}

describe('the wire reaches the screen', () => {
  it('⭐ a run_delta on a turn becomes a rendered section, through the real store and hook', () => {
    applyV5State(wireResponse({ run_delta: RUN_DELTA }), productionApplicatorStore())

    // LINK 3→4: the production store object carried the setter and it wrote.
    const stored = useCanvasStore.getState().runDelta
    expect(stored, 'applyV5State did not reach the real store — the production store object is missing setRunDelta').not.toBeNull()

    // LINK 4→5: the identity the applicator stamped IS the one the dock reads back.
    // ⚠ Asserted by IDENTITY against the store's own value, never a literal: a
    // hand-written hash could match by accident and would not notice the two drifting.
    const displayedHash = useCanvasStore.getState().results?.hash
    expect(displayedHash, 'the analysis wrote no hash — there is no identity to join on').toBeTruthy()
    expect(stored?.analysisHash).toBe(displayedHash)
    expect(stored?.scenarioId).toBe('scn-int')

    // LINK 5→6: the hook resolves it onto the view model.
    const { result } = renderChain(displayedHash)
    expect(result.current.whatsChanged, 'the hook produced no view — the gate or the memo did not compose').not.toBeNull()

    // LINK 6→7: and the section renders the producer's claim.
    render(<WhatsChanged view={result.current.whatsChanged} />)
    const section = screen.getByTestId(WHATS_CHANGED_TESTID)
    expect(section).toHaveAttribute('data-attributable', 'true')
    expect(screen.getByTestId(`${WHATS_CHANGED_TESTID}-comparability`).textContent)
      .toMatch(/only difference/i)
    const row = screen.getByTestId(`${WHATS_CHANGED_TESTID}-movement`)
    expect(row).toHaveAttribute('data-option-id', 'opt_a')
    expect(row).toHaveAttribute('data-noise-verdict', 'signal')
  })
})

describe('⛔ the negative arms — each would otherwise render silently and wrongly', () => {
  it('a turn with NO delta leaves nothing to render', () => {
    applyV5State(wireResponse(), productionApplicatorStore())
    expect(useCanvasStore.getState().runDelta).toBeNull()
    const { result } = renderChain(useCanvasStore.getState().results?.hash)
    expect(result.current.whatsChanged).toBeNull()
    const { container } = render(<WhatsChanged view={result.current.whatsChanged} />)
    expect(container.innerHTML).toBe('')
  })

  it('a delta about a SUPERSEDED analysis is invisible', () => {
    applyV5State(wireResponse({ run_delta: RUN_DELTA }), productionApplicatorStore())
    expect(useCanvasStore.getState().runDelta).not.toBeNull()
    // The dock is displaying a different analysis than the one this delta describes.
    const { result } = renderChain('a-different-analysis-hash')
    expect(result.current.whatsChanged).toBeNull()
  })

  it('a delta from ANOTHER SCENARIO is invisible', () => {
    applyV5State(wireResponse({ run_delta: RUN_DELTA }), productionApplicatorStore())
    const displayedHash = useCanvasStore.getState().results?.hash
    useCanvasStore.setState({ currentScenarioId: 'scn-elsewhere' } as never)
    const { result } = renderChain(displayedHash)
    expect(result.current.whatsChanged).toBeNull()
  })

  it('an UNKNOWN displayed hash renders nothing rather than guessing', () => {
    applyV5State(wireResponse({ run_delta: RUN_DELTA }), productionApplicatorStore())
    const { result } = renderChain(undefined)
    expect(result.current.whatsChanged).toBeNull()
  })
})
