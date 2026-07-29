/**
 * ROADMAP 2.113a slice 2 — the snapshot carries EVERY option, and the run's
 * OWN producer leader verdict.
 *
 * WHY THIS IS NOT COSMETIC. `AnalysisSnapshot.winnerId` is a client-side
 * ARGMAX over `option_comparison` (`analysisSnapshotFactory.ts`, "Sort options
 * by win_probability descending"). `src/lib/decisionVerdict.ts` exists because
 * sixteen surfaces were each classifying a leader that way, and its
 * "Authority 3" — the UI banding win probabilities for itself — was DELETED
 * after CEE #711 made producer silence meaningful: a withheld run still carries
 * per-option win probabilities, and rebuilding a leader from them republishes
 * the claim CEE just withheld.
 *
 * A side-by-side compare is exactly the surface that would have re-created it,
 * so the snapshot quotes the module instead. These tests pin that the quoting
 * is real — including that a run whose producer said nothing produces NO claim.
 */
import { describe, it, expect } from 'vitest'
import { buildAnalysisSnapshot } from '../analysisSnapshotFactory'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'

function build(raw: Partial<V2RunResponse>) {
  return buildAnalysisSnapshot({
    rawV2Response: raw as V2RunResponse,
    nodes: null,
    edges: null,
    runNumber: 1,
    events: [],
    previousSnapshotTimestamp: null,
  })
}

const TWO_OPTIONS = [
  { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.71 },
  { option_id: 'opt-b', option_label: 'Option B', win_probability: 0.29 },
]

describe('snapshot.options — every option, not just the top two', () => {
  it('keeps all options, sorted by win probability descending, as 0-100 integers', () => {
    const snapshot = build({
      option_comparison: [
        { option_id: 'opt-b', option_label: 'B', win_probability: 0.2 },
        { option_id: 'opt-a', option_label: 'A', win_probability: 0.5 },
        { option_id: 'opt-c', option_label: 'C', win_probability: 0.3 },
      ],
    } as Partial<V2RunResponse>)

    expect(snapshot.options).toEqual([
      { id: 'opt-a', label: 'A', winProbability: 50 },
      { id: 'opt-c', label: 'C', winProbability: 30 },
      { id: 'opt-b', label: 'B', winProbability: 20 },
    ])
  })

  it('drops an option with no usable id rather than keying it on the empty string', () => {
    // Two id-less options would COLLIDE into one row in the side-by-side table
    // and report a delta between two different options.
    const snapshot = build({
      option_comparison: [
        { option_id: 'opt-a', option_label: 'A', win_probability: 0.5 },
        { option_label: 'No id', win_probability: 0.3 },
        { option_label: 'Also no id', win_probability: 0.2 },
      ],
    } as unknown as Partial<V2RunResponse>)

    expect(snapshot.options.map(o => o.id)).toEqual(['opt-a'])
  })

  it('is [] when the producer sent no option comparison — not a phantom option', () => {
    expect(build({}).options).toEqual([])
  })
})

describe('snapshot.leaderVerdict — quoted from the producer, never derived', () => {
  it('the producer’s near_tie "not a tie" entitles a leader', () => {
    const snapshot = build({
      option_comparison: TWO_OPTIONS,
      robustness: {
        near_tie: { is_tie: false, top_option_id: 'opt-a', gap: 0.42 },
        recommended_option_id: 'opt-a',
      },
    } as unknown as Partial<V2RunResponse>)

    expect(snapshot.leaderVerdict.hasLeadingOption).toBe(true)
    expect(snapshot.leaderVerdict.leaderId).toBe('opt-a')
    expect(snapshot.leaderVerdict.source).toBe('producer_near_tie')
  })

  it('the producer’s near_tie "IS a tie" denies one — and `winnerId` still says opt-a', () => {
    const snapshot = build({
      option_comparison: [
        { option_id: 'opt-a', option_label: 'A', win_probability: 0.52 },
        { option_id: 'opt-b', option_label: 'B', win_probability: 0.48 },
      ],
      robustness: { near_tie: { is_tie: true, top_option_id: 'opt-a' } },
    } as unknown as Partial<V2RunResponse>)

    expect(snapshot.winnerId).toBe('opt-a')          // the argmax is unchanged…
    expect(snapshot.leaderVerdict.hasLeadingOption).toBe(false) // …and licenses nothing
    expect(snapshot.leaderVerdict.separation).toBe('tied')
  })

  it('the producer’s headline band refines the verdict', () => {
    const snapshot = build({
      option_comparison: TWO_OPTIONS,
      robustness: { near_tie: { is_tie: false, top_option_id: 'opt-a' } },
      decision_brief: {
        headline_banded: { band: 'slightly_ahead', leader_option_id: 'opt-a' },
      },
    } as unknown as Partial<V2RunResponse>)

    expect(snapshot.leaderVerdict.separation).toBe('slight')
    expect(snapshot.leaderVerdict.source).toBe('producer_band')
  })

  // ── The fail-closed half ────────────────────────────────────────────────
  it('NO producer signal ⇒ the NO-CLAIM verdict, even with a 88/12 split on the wire', () => {
    const snapshot = build({
      option_comparison: [
        { option_id: 'opt-a', option_label: 'A', win_probability: 0.88 },
        { option_id: 'opt-b', option_label: 'B', win_probability: 0.12 },
      ],
    } as unknown as Partial<V2RunResponse>)

    expect(snapshot.winnerProbability).toBe(88)
    expect(snapshot.leaderVerdict.hasLeadingOption).toBe(false)
    // 'unknown', NOT 'tied' — silence, never a denial (CEE #711 withheld-turn
    // semantics; see decisionVerdict.ts).
    expect(snapshot.leaderVerdict.separation).toBe('unknown')
    expect(snapshot.leaderVerdict.source).toBe('none')
  })

  it('a LEGACY boolean `near_tie` is not a producer signal — it falls to no-claim', () => {
    // The pre-slice-2 test fixture used `near_tie: false`, which does not exist
    // on the wire (790/790 live facts carry an OBJECT with a boolean is_tie).
    const snapshot = build({
      option_comparison: TWO_OPTIONS,
      robustness: { near_tie: false, recommended_option_id: 'opt-a' },
    } as unknown as Partial<V2RunResponse>)

    expect(snapshot.leaderVerdict.hasLeadingOption).toBe(false)
    expect(snapshot.leaderVerdict.source).toBe('none')
  })

  it('a producer claim about option X is never re-pointed at option Y', () => {
    // near_tie names opt-b as its top option, but the win-probability rank 1 is
    // opt-a — the identity gate in decisionVerdict refuses to apply it.
    const snapshot = build({
      option_comparison: TWO_OPTIONS,
      robustness: { near_tie: { is_tie: false, top_option_id: 'opt-b' } },
    } as unknown as Partial<V2RunResponse>)

    expect(snapshot.leaderVerdict.hasLeadingOption).toBe(false)
    expect(snapshot.leaderVerdict.source).toBe('none')
  })
})
