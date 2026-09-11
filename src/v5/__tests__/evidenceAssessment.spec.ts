/**
 * ⭐ THE EVIDENCE ASSESSMENT IS READ OFF THE TURN, OR NO CLAIM IS MADE.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * The evidence check renders "Evidence not assessed" on every run, because the
 * only thing that ever answered it was `runMeta.m1Coaching.evidence_gaps` — and
 * the sole writer of that field is `hydrateAnalysis`, the RESTORE-from-Supabase
 * path. The live turn path (`applyV5State`) never wrote it, so on a real journey
 * the question could not be answered at all. Journey-witnessed on deployed
 * staging, 10 Sep 2026, two briefs, every run.
 *
 * CEE now projects a narrow, claim-safe `evidence_assessment` block past the
 * Tier-3 transport ban (olumi-assistants-service, the projection carries labels
 * and binding ids, never a VOI score). This reads it.
 *
 * ⛔⛔ THE ACCEPTANCE CONDITION, AND IT IS THE FIRST CASE.
 * The view model renders an empty gap list beside `assessed: true` as a
 * LICENSED ALL-CLEAR — "No evidence gaps flagged". So a list that arrives
 * SHORT is not a smaller truth: past the last gap it becomes a false statement
 * about the user's evidence, which is worse than the honest refusal it
 * replaces. Every malformed shape therefore yields `null` — make no claim, and
 * leave "Evidence not assessed" standing.
 *
 * ⚠ CLAIM TYPE. Assertions about the parsed value and the store write. Nothing
 * here says what any surface renders.
 */
import { describe, it, expect } from 'vitest'
import { readEvidenceAssessment } from '../evidenceAssessment'

const GAPS = [
  { factor_id: 'f1', factor_label: 'Repeat question volume' },
  { factor_id: 'f2', factor_label: 'Agent capacity' },
]

describe('the evidence assessment is read whole, or not at all', () => {
  /** ⛔ A happy path structurally cannot observe this failure. It goes first. */
  it('ACCEPTANCE — a payload carrying gaps never parses to assessed-with-an-empty-list', () => {
    const read = readEvidenceAssessment({ evidence_assessment: { assessed: true, gaps: GAPS } })
    const licensedAllClear = read?.assessed === true && read.gaps.length === 0
    expect(licensedAllClear, 'parsed a licensed all-clear from a payload naming 2 gaps').toBe(false)
  })

  it('carries every gap, with the id that binds it and the label that names it', () => {
    expect(readEvidenceAssessment({ evidence_assessment: { assessed: true, gaps: GAPS } })).toEqual({
      assessed: true,
      gaps: [
        { factorId: 'f1', factorLabel: 'Repeat question volume' },
        { factorId: 'f2', factorLabel: 'Agent capacity' },
      ],
    })
  })

  /**
   * ⛔⛔ INVERTED FROM THE FIRST VERSION, WHICH ASSERTED THAT AN EMPTY LIST IS
   * "a real all-clear and is carried as one". That was the false all-clear
   * itself, written into the guard meant to prevent it.
   *
   * Upstream, `evidence_gaps` is `safeCompute(..., [], ...)` — `[]` on ANY
   * exception — and is also `[]` when nothing is assessable. So an empty list
   * cannot be told from a crash, and the view model renders assessed-with-empty
   * as the licensed all-clear "No evidence gaps flagged".
   *
   * The producer now declines on empty; this declines too rather than trusting
   * it, so the two seams cannot drift into opposite defaults for one question.
   */
  it('an EMPTY gap list makes NO claim — it cannot be told from a crash', () => {
    expect(readEvidenceAssessment({ evidence_assessment: { assessed: true, gaps: [] } })).toBeNull()
  })

  it('makes NO claim when the block is absent — the honest refusal survives', () => {
    expect(readEvidenceAssessment({})).toBeNull()
    expect(readEvidenceAssessment(undefined)).toBeNull()
    expect(readEvidenceAssessment(null)).toBeNull()
  })

  /**
   * ⛔ FAIL CLOSED ON A PARTIAL SHAPE. Dropping the unusable entries would
   * shrink the list below what the producer found — and past the last gap that
   * is the false all-clear.
   */
  it('makes NO claim when any gap is missing its id or its label', () => {
    for (const bad of [
      [{ factor_id: 'f1' }],
      [{ factor_label: 'Repeat question volume' }],
      [{ factor_id: 'f1', factor_label: 'Repeat question volume' }, { factor_id: 'f2' }],
      [{ factor_id: '  ', factor_label: 'Agent capacity' }],
    ]) {
      expect(
        readEvidenceAssessment({ evidence_assessment: { assessed: true, gaps: bad } }),
        `accepted a partial gap list: ${JSON.stringify(bad)}`,
      ).toBeNull()
    }
  })

  it('makes NO claim when gaps is not an array, and does not throw on a keyed object', () => {
    for (const notAnArray of ['soon', { f1: { factor_id: 'f1', factor_label: 'x' } }, 3]) {
      let out: unknown
      expect(() => { out = readEvidenceAssessment({ evidence_assessment: { assessed: true, gaps: notAnArray } }) })
        .not.toThrow()
      expect(out).toBeNull()
    }
  })

  /**
   * ⚠ `assessed` IS THE PRODUCER SAYING IT LOOKED. Anything other than a literal
   * true is silence, and silence is not an assessment — the same rule the view
   * model already applies one level up.
   */
  it('makes NO claim when assessed is not literally true', () => {
    for (const assessed of [false, 'true', 1, null, undefined]) {
      expect(readEvidenceAssessment({ evidence_assessment: { assessed, gaps: GAPS } })).toBeNull()
    }
  })
})

/**
 * ⭐ THE WRITE SITE — and this is the gap that actually shipped.
 *
 * The parser above is inert unless something calls it on a LIVE turn. Nothing
 * did: `runMeta.m1Coaching` was written only by `hydrateAnalysis` (restore from
 * Supabase), so on a real journey the evidence
 * check had no source at all. These cases pin the write itself, through the same
 * store double the sibling `applyV5State` specs use.
 */
import { vi } from 'vitest'
import { applyV5State } from '../applyV5State'

function makeStore() {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    nodes: [],
    edges: [],
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setAnalysisFreshness: vi.fn(),
    setAnalysisRefusalNotice: vi.fn(),
    setAnalysisStateV1: vi.fn(),
  }
}

function applyAnalysisTurn(enrichment: Record<string, unknown>) {
  const store = makeStore()
  applyV5State(
    {
      response_version: 2,
      assistant_text: 'ok',
      blocks: [{ type: 'analysis_result', enrichment }],
    } as never,
    store as never,
  )
  const writes = store.setRunMeta.mock.calls
    .map(c => c[0] as Record<string, unknown>)
    .filter(m => Object.prototype.hasOwnProperty.call(m, 'evidenceAssessment'))
  return { store, writes }
}

describe('the live analysis turn writes the assessment', () => {
  it('writes the parsed assessment to runMeta on an analysis turn', () => {
    const { writes } = applyAnalysisTurn({ evidence_assessment: { assessed: true, gaps: GAPS } })
    expect(writes).toHaveLength(1)
    expect(writes[0]!.evidenceAssessment).toEqual({
      assessed: true,
      gaps: [
        { factorId: 'f1', factorLabel: 'Repeat question volume' },
        { factorId: 'f2', factorLabel: 'Agent capacity' },
      ],
    })
  })

  /**
   * ⛔ NEVER LEFT STALE. A turn carrying no assessment must EVICT the previous
   * run's, not retain it — the same discipline the decision review beside it
   * follows. Retaining would answer a question about THIS run with a previous
   * run's evidence, which is the quietest kind of wrong.
   */
  it('EVICTS a previous run’s assessment when this turn carries none', () => {
    const { writes } = applyAnalysisTurn({})
    expect(writes).toHaveLength(1)
    expect(writes[0]!.evidenceAssessment).toBeNull()
  })

  it('EVICTS rather than salvaging when the block is malformed', () => {
    const { writes } = applyAnalysisTurn({
      evidence_assessment: { assessed: true, gaps: [{ factor_id: 'f1' }] },
    })
    expect(writes).toHaveLength(1)
    expect(writes[0]!.evidenceAssessment).toBeNull()
  })
})
