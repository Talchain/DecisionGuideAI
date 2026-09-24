/**
 * One datum, one claim — at every zoom level.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────────
 * At full zoom a factor card says **"Most influential · of 5"**. At the reduced
 * rung the same card said **"Influence 62%"**. One number, two different
 * claims, eight pixels of zoom apart — and the bare percentage is the one that
 * invites the wrong reading (*62% of the answer*), which is not what relative
 * influence measures.
 *
 * ⛔ THE PERCENTAGE IS NOT THE DEFECT. `FactorNode:762,780` renders it too, on
 * the same branch, when the rank is unlicensed — so it is a legitimate
 * fallback. What was wrong was taking that fallback where a rank EXISTED,
 * because the reduced line had no rank arm at all.
 *
 * ⭐ WHY IT COULD NOT SIMPLY BE READ. A rank is licensed by TWO conditions and
 * one of them is a STORE question: `useAnalysisResultsAreCurrent`. A resolver
 * handed only `data` and `displayMetadata` can never answer it — the same
 * shape as an option's change count, and the reason `LodMetricFacts` exists.
 * The pair now lives in `useInfluenceRank`, which both surfaces read.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOCKED CANVAS DESIGN (23 Sep 2026) — WHAT THE CARD NOW SAYS
 * ─────────────────────────────────────────────────────────────────────────────
 * The card's rank is now its driver line, `Driver N of M analysed`
 * (ED 02:31Z D1a: "`Driver N of M`, not `Driver #N of M`"), and the bare
 * percentage is no longer a face fallback at ANY rung (ED 11:52Z: "no
 * pseudo-precise `% influence` on the face") — it lives in the driver line's
 * tooltip and accessible name, beside the words that say what it is relative
 * to. So "one datum, one claim" now reads: the reduced line states the SAME
 * driver caption the card states (`driverLineCaption`, the card's owner), and
 * where no current rank exists it states no influence figure at all.
 *
 * The licence did not move: `BaseNode` builds the resolver's `driverRank` fact
 * from `useInfluenceRank` (current run only; a set of one is refused by its
 * owner). The resolver half is pinned below as before, and because the stale
 * gate now lives in that composition rather than in the resolver's input, a
 * mounted discriminating pair pins it where it runs.
 *
 * CLAIM SCOPE (trap 3): jsdom proves the STRING, never the pixels it occupies.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { resolveLodMetricLineDetail } from '../shared/lodMetricLine'
import { influenceRankReadout } from '../../../components/results/influenceScaleCopy'
import { driverLineCaption, driverLineExplanation } from '../shared/FactorDriverLine'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let storeState: Record<string, unknown> = {}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector(storeState)),
}))

let mountedMetadata: Record<string, unknown> = {}

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => mountedMetadata),
}))

/** No stated value, so the resolver reaches its influence arm. */
const FACTOR_WITH_ONLY_AN_INFLUENCE_SCORE = {
  label: 'Conversion Rate',
  kind: 'factor',
  category: 'controllable',
  observedState: { source: 'cee_inference' },
}

const metadata = {
  sensitivityRank: 1,
  influence: 0.62,
  influenceProvenance: 'influence_score',
  influenceSetSize: 5,
  // The ranked count — the publication guard; the printed M is the analysed
  // set (ED #63 5806207128), deliberately a different number.
  influenceRankedCount: 3,
  confidence: null,
  inSensitivityAnalysis: false,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: null,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: true,
}

const line = (facts?: Record<string, unknown>) =>
  resolveLodMetricLineDetail({
    nodeType: 'factor',
    data: FACTOR_WITH_ONLY_AN_INFLUENCE_SCORE,
    label: 'Conversion Rate',
    displayMetadata: metadata as never,
    facts: facts as never,
  }).text

describe('the reduced line names the rank the card names', () => {
  it('⭐ says what the card says when a rank is licensed — RED at pristine, where it said "Influence 62%"', () => {
    // Locked Canvas design (23 Sep 2026): the card's rank is its driver line
    // (ED 02:31Z D1a). The caption is built by its OWNER, not re-typed here, so
    // this asserts agreement with the card rather than with my memory of it.
    const rank = { rank: 1, setSize: 5 }
    const caption = driverLineCaption(rank)
    expect(caption, 'the owner built no rank caption — fixture is vacuous').toContain('1 of 5')

    const text = line({ driverRank: rank })
    expect(text).toBe(caption)
    // ED 11:52Z: no pseudo-precise `% influence` on the face.
    expect(text).not.toContain('%')
  })

  it('⛔ keeps the DENOMINATOR, because the caption alone is the half a reader cannot check', () => {
    // Locked Canvas design (23 Sep 2026): same rule, driver-line wording.
    const text = line({ driverRank: { rank: 2, setSize: 5 } })
    expect(text).toContain('of 5')
    // "Driver 2" without "of 5" is a claim with no scale — the same defect as
    // the bare percentage, wearing the other costume.
    expect(text).not.toBe('Driver 2')
  })

  it('CONTRAST — with NO rank the line states no influence figure; the % lives in the driver line’s disclosure', () => {
    // Locked Canvas design (23 Sep 2026), ED 11:52Z: the old fallback here was
    // the bare "Influence 62%". It is gone from the face at every rung…
    const text = line(undefined)
    expect(text).toBeNull()
    // …and MOVED, not deleted: the card's driver line carries the percentage
    // in its tooltip/accessible name, beside what it is relative to.
    // (Contract v3.1 pt 5: the line is ranked-only now, so the disclosure is
    // read off a ranked line; an unranked factor's figure is in the inspector.)
    const disclosure = driverLineExplanation({
      rank: { rank: 1, setSize: 3 },
      value: metadata.influence,
      provenance: 'influence_score',
      importanceBasis: null,
    })
    expect(disclosure).toContain('62% of the strongest factor')
  })

  it('CONTRAST — a stale run withholds the rank rather than naming the wrong factor', () => {
    // `useInfluenceRank` returns null when the results are not current, and
    // `BaseNode` then hands `driverRank: null`. The resolver must behave exactly
    // as if no rank existed: a rank is a comparison ACROSS factors, so a stale
    // one does not merely age — it names a different factor as the leader.
    // Locked Canvas design (23 Sep 2026): and with no rank there is no bare
    // percentage either (ED 11:52Z). The mounted pair below pins the gate.
    const text = line({ influenceRank: null, driverRank: null })
    expect(text).toBeNull()
  })

  it('PINS THE OWNER’S OWN GUARD — a set of one licenses no rank at either rung', () => {
    // The owner refuses the set of one, so `BaseNode`'s driverRank (gated on the
    // owner's readout) is null and the reduced line names no rank.
    expect(influenceRankReadout(1, 1)).toBeNull()
    expect(line({ influenceRank: influenceRankReadout(1, 1), driverRank: null })).toBeNull()
  })
})

describe('mounted — the current-run licence reaches the reduced line (locked Canvas design, 23 Sep 2026)', () => {
  const NODE_ID = 'fac_conversion_rate'
  type Currency = 'current' | 'changed' | 'cannot_confirm'
  const makeStore = (currency: Currency) => ({
    results: { status: 'complete', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    editedSinceRunNodeIds: new Set(),
    analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    hoveredOptionId: null,
    ceeAnalysisReady: null,
    edges: [],
    nodes: [{ id: NODE_ID, type: 'factor', data: FACTOR_WITH_ONLY_AN_INFLUENCE_SCORE }],
    viewMode: 'standard',
    lodRung: 'line',
    // `useAnalysisResultsAreCurrent()` — the ONE licence `useInfluenceRank`
    // reads. The CHANGED arm differs ONLY in the dirty bit; the cannot-confirm
    // arm only in CEE's verdict (a restored run's `hydrated_without_capture`).
    analysisFreshness: currency === 'cannot_confirm'
      ? { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' }
      : { freshness: 'fresh' },
    analysisFreshnessDirty: currency === 'changed',
    importPendingServerRegistration: false,
  })

  const mount = (currency: Currency) => {
    storeState = makeStore(currency)
    mountedMetadata = { ...metadata }
    return render(
      <ReactFlowProvider>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <FactorNode {...({ id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any)} data={FACTOR_WITH_ONLY_AN_INFLUENCE_SCORE as any} />
      </ReactFlowProvider>,
    )
  }

  it('a CURRENT run: the reduced line states the card’s driver caption', () => {
    mount('current')
    // ED #63 5806207128: M is the analysed set (5), never the ranked count (3).
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe(
      driverLineCaption({ rank: 1, setSize: 5 }),
    )
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe('Driver 1 of 5 analysed')
  })

  /*
   * ⭐ DESIGN INTEGRATION (23 Sep 2026) — #1891's rule on this rung. A model
   * KNOWN to have changed since the run (the dirty overlay → composed
   * `'changed'`) keeps the rank and LABELS it `Last run · ` (Paul's Ruling 3,
   * ROADMAP 2.651; visual contract v3). A run the product cannot vouch for
   * (cannot-confirm) still states no rank and no percentage (ED 02:31Z Q2).
   */
  it('CHANGED — the SAME card labels the rank as the last run’s, never as current', () => {
    mount('changed')
    // ED 5806207128 stale form: "Last run · Driver N of M analysed".
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe(
      `Last run · ${driverLineCaption({ rank: 1, setSize: 5 })}`,
    )
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe('Last run · Driver 1 of 5 analysed')
  })

  it('CONTRAST — the SAME card on a cannot-confirm run states no rank and no percentage', () => {
    const { container } = mount('cannot_confirm')
    // Positive control first (trap 13): the card mounted.
    expect(screen.getByText('Conversion Rate')).toBeInTheDocument()
    expect(screen.queryByTestId('node-lod-line')).toBeNull()
    expect(container.textContent).not.toContain('Driver 1 of')
    expect(container.textContent).not.toContain('62%')
    expect(container.textContent).not.toContain('Last run')
  })
})
