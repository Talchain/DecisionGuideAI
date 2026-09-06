/**
 * exportBundle.rankWithheld — the debug bundle must not re-derive a rank the
 * product withheld.
 *
 * `rank_displayed` / `rank_source` are DIAGNOSTIC fields. They are the bundle's
 * own re-derivation, not a capture of a rendered badge: the product ships no
 * numeric rank badge (`OptionCards.tsx` — "D17: '#N of M' rank prefix removed";
 * `rank` there drives an `aria-hidden` colour swatch and the crowned border).
 *
 * The defect these tests pin: when CEE withholds the comparative-leader
 * licence, `OptionCards.tsx` already suppresses rank outright
 * (`const rank = designationsWithheld ? undefined : ...`), while
 * `captureDisplayState` went on emitting `rank_displayed: 1|2|3` with
 * `rank_source: 'canvas_order'`. Two investigations read that re-derivation as
 * the product presenting display order as a finding. It never did.
 *
 * SCOPE, STATED EXACTLY. These tests bind to Q1 only — "does the MODEL license
 * a comparative-leader claim?", answered by the imported
 * `licensesComparativeLeaderClaim` over `ceeAnalysisReady.analysis_admission`.
 * The product's `designationsWithheld` is the conjunction of Q1 AND Q2 ("did
 * THIS run separate the arms?", `deriveDecisionVerdict().hasLeadingOption`,
 * `src/lib/decisionVerdict.ts`). Q2 is not derivable from the canvas store at
 * capture time, and re-deriving it here would build the second authority this
 * change exists to remove. The Q2-withheld case therefore remains
 * un-suppressed in the bundle; that gap is recorded, not closed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AnalysisAdmissionV1, PermittedAnalysisMode } from '../../../adapters/cee/types'

interface MockCanvasState {
  nodes: Array<{ id: string; data: Record<string, unknown> }>
  edges: Array<{ id: string }>
  results: { status: string; report?: unknown } | null
  rawV2Response: Record<string, unknown> | null
  ceeAnalysisReady:
    | { status?: string; analysis_admission?: AnalysisAdmissionV1 }
    | null
  graphEditedSinceLastRun: boolean
}

let mockState: MockCanvasState

vi.mock('../../../canvas/store', () => ({
  useCanvasStore: { getState: () => mockState },
}))

async function importCapture() {
  const mod = await import('../utils/exportBundle')
  return mod.captureDisplayState
}

function admission(mode: PermittedAnalysisMode): AnalysisAdmissionV1 {
  return {
    permitted_analysis_mode: mode,
    // By contract `reasons` is never empty on a refusal.
    reasons: mode === 'none' ? [{ field: 'test', message: 'withheld for test' }] : [],
  }
}

/**
 * Two option nodes, both carrying a finite win_probability on the raw V2 wire,
 * ordered so that the ANALYTICAL rank (win_probability desc) and the CANVAS
 * order DISAGREE: canvas order is [opt-alpha, opt-beta]; win probability puts
 * opt-beta first. Any test below that reads rank 1 therefore discriminates
 * between the two rank sources rather than agreeing with both.
 */
function makeState(
  admissionValue?: AnalysisAdmissionV1,
): MockCanvasState {
  return {
    nodes: [
      { id: 'opt-alpha', data: { kind: 'option', label: 'Alpha' } },
      { id: 'opt-beta', data: { kind: 'option', label: 'Beta' } },
    ],
    edges: [],
    results: { status: 'complete', report: { option_comparison: [] } },
    rawV2Response: {
      option_comparison: [
        { option_id: 'opt-alpha', option_label: 'Alpha', win_probability: 0.25 },
        { option_id: 'opt-beta', option_label: 'Beta', win_probability: 0.75 },
      ],
    },
    ceeAnalysisReady: {
      status: 'ready',
      ...(admissionValue ? { analysis_admission: admissionValue } : {}),
    },
    graphEditedSinceLastRun: false,
  }
}

/** Bind by IDENTITY: find the emitted row by its node id, never by a value. */
function rowById(
  rendered: Awaited<ReturnType<Awaited<ReturnType<typeof importCapture>>>>['rendered_options'],
  id: string,
) {
  const row = (rendered ?? []).find((r) => r.id === id)
  if (!row) throw new Error(`no rendered_options row with id=${id}`)
  return row
}

describe('captureDisplayState — rank is withheld, never re-derived', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('WITHHELD: permitted_analysis_mode=none emits rank_source=withheld and rank_displayed=null', async () => {
    mockState = makeState(admission('none'))
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()

    const rendered = result.rendered_options
    // PRECONDITION, pinned in-test: the capture must actually have emitted the
    // two option rows. Without this the assertions below would pass vacuously
    // on an empty/null rendered_options.
    expect(rendered).not.toBeNull()
    expect(rendered).toHaveLength(2)

    const alpha = rowById(rendered, 'opt-alpha')
    const beta = rowById(rendered, 'opt-beta')

    expect(alpha.rank_source).toBe('withheld')
    expect(beta.rank_source).toBe('withheld')
    expect(alpha.rank_displayed).toBeNull()
    expect(beta.rank_displayed).toBeNull()

    // The win probability itself is NOT withheld — only the rank is. This
    // guards against the fix over-reaching into a field it must not touch.
    expect(beta.win_probability_displayed).toBe(0.75)
    expect(alpha.win_probability_displayed).toBe(0.25)
  })

  it('WITHHELD: exploratory and quantified_provisional also withhold the rank', async () => {
    for (const mode of ['exploratory', 'quantified_provisional'] as const) {
      vi.resetModules()
      mockState = makeState(admission(mode))
      const captureDisplayState = await importCapture()
      const result = await captureDisplayState()
      const beta = rowById(result.rendered_options, 'opt-beta')
      expect(beta.rank_source, `mode=${mode}`).toBe('withheld')
      expect(beta.rank_displayed, `mode=${mode}`).toBeNull()
    }
  })

  // ── DISCRIMINATING PAIR ───────────────────────────────────────────────────
  // The two tests below must stay GREEN. They are what stops the fix from
  // having simply blanked the field: an entitled run still ranks, and still
  // ranks ANALYTICALLY (opt-beta first, from win_probability desc — not
  // opt-alpha, which is what canvas order would give).

  it('ENTITLED: permitted_analysis_mode=comparative_leader still emits win_probability_desc with a real rank', async () => {
    mockState = makeState(admission('comparative_leader'))
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()

    const alpha = rowById(result.rendered_options, 'opt-alpha')
    const beta = rowById(result.rendered_options, 'opt-beta')

    expect(beta.rank_source).toBe('win_probability_desc')
    expect(alpha.rank_source).toBe('win_probability_desc')
    // Analytical order, not canvas order: beta (0.75) outranks alpha (0.25).
    expect(beta.rank_displayed).toBe(1)
    expect(alpha.rank_displayed).toBe(2)
  })

  it('ABSENT ADMISSION: a pre-admission CEE ranks exactly as it did before (fail-open, Q1 absence arm)', async () => {
    mockState = makeState(undefined)
    const captureDisplayState = await importCapture()
    const result = await captureDisplayState()

    const beta = rowById(result.rendered_options, 'opt-beta')
    // `licensesComparativeLeaderClaim(undefined) === true` is load-bearing and
    // documented on the selector: absence means the producer has not spoken,
    // so nothing changes. Collapsing it to a refusal would blank the rank on
    // every legacy payload.
    expect(beta.rank_source).toBe('win_probability_desc')
    expect(beta.rank_displayed).toBe(1)
  })
})
