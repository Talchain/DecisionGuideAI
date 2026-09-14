/**
 * "What's changed" — the comparability case and the movement are TWO CLAIMS,
 * and this file exists because an earlier draft fused them.
 *
 * The three fixtures at the top are not hypothetical. All three PARSE against
 * the installed 0.55.0 schema, because `refineRunDelta` constrains
 * `pair_provenance` and says nothing about `win_probabilities`. A surface that
 * derives "nothing moved" or "this differs" from the case enum is therefore
 * making a claim the producer never made.
 */
import { describe, it, expect } from 'vitest'
import type { RunDelta } from '@talchain/schemas/boundary'
import { buildRunDeltaView } from '../runDeltaView'
import { ANALYSIS_HERO_BANNED_TERMS } from '../../utils/glossaryCheck'

const LABELS: Record<string, string> = { opt_a: 'Raise the price', opt_b: 'Hold the price' }
const labelFor = (id: string): string | null => LABELS[id] ?? null

function delta(over: Partial<RunDelta> = {}): RunDelta {
  return {
    attribution_case: 'C1_attributable',
    pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true },
    leader: { changed: false, noise_verdict: 'signal', prior_leading_option_id: 'opt_a', current_leading_option_id: 'opt_a' },
    win_probabilities: [
      { option_id: 'opt_a', prior: 0.6, current: 0.7, noise_verdict: 'signal' },
    ],
    flip_thresholds: [],
    ...over,
  } as RunDelta
}

describe('the comparability line never speaks about movement', () => {
  it('C0_identical WITH differing probabilities does not claim nothing moved', () => {
    const v = buildRunDeltaView(delta({
      attribution_case: 'C0_identical',
      pair_provenance: { seed_equal: true, hash_equal: true, builds_equal: 'equal', n_equal: true },
      win_probabilities: [{ option_id: 'opt_a', prior: 0.10, current: 0.90, noise_verdict: 'signal' }],
    }), labelFor)
    expect(v.comparability).not.toMatch(/nothing moved|no change|identical results|unchanged/i)
    // and the movement it DOES carry is reported, not suppressed by the case
    expect(v.movements).toHaveLength(1)
    expect(v.movements[0].prior).toBe(0.10)
    expect(v.movements[0].current).toBe(0.90)
    expect(v.movements[0].direction).toBe('up')
  })

  it('C1_attributable WITH no movement does not claim something moved', () => {
    const v = buildRunDeltaView(delta({ win_probabilities: [] }), labelFor)
    expect(v.comparability).not.toMatch(/differs|moved|changed to|higher|lower/i)
    expect(v.attributable).toBe(true)
    expect(v.movementsUnavailable).toBe(true)
    expect(v.movements).toHaveLength(0)
  })

  it('C2_unpaired WITH identical probabilities still refuses attribution', () => {
    const v = buildRunDeltaView(delta({
      attribution_case: 'C2_unpaired',
      pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'equal', n_equal: true },
      win_probabilities: [{ option_id: 'opt_a', prior: 0.5, current: 0.5, noise_verdict: 'within_noise' }],
    }), labelFor)
    expect(v.attributable).toBe(false)
    expect(v.attributionLimit).toBeTruthy()
    expect(v.comparability).not.toMatch(/differs|moved/i)
    expect(v.movements[0].direction).toBe('level')
  })
})

describe('only C1_attributable licenses a causal reading', () => {
  const cases: Array<RunDelta['attribution_case']> = [
    'C0_identical', 'C2_unpaired', 'C3_engine_drift', 'C4_budget_drift',
  ]
  it.each(cases)('%s is not attributable and carries the limit', (c) => {
    const v = buildRunDeltaView(delta({ attribution_case: c }), labelFor)
    expect(v.attributable).toBe(false)
    expect(v.attributionLimit).toMatch(/cannot be put down to your change/i)
  })

  it('C1_attributable is attributable and carries NO limit rider', () => {
    const v = buildRunDeltaView(delta(), labelFor)
    expect(v.attributable).toBe(true)
    expect(v.attributionLimit).toBeNull()
  })

  it('every case produces a DISTINCT comparability sentence', () => {
    const all: Array<RunDelta['attribution_case']> = [
      'C0_identical', 'C1_attributable', 'C2_unpaired', 'C3_engine_drift', 'C4_budget_drift',
    ]
    const seen = all.map((c) => buildRunDeltaView(delta({ attribution_case: c }), labelFor).comparability)
    expect(new Set(seen).size).toBe(all.length)
  })
})

describe('the noise tag is producer-owned and never collapsed', () => {
  it('carries all three states through verbatim', () => {
    const v = buildRunDeltaView(delta({
      win_probabilities: [
        { option_id: 'opt_a', prior: 0.1, current: 0.2, noise_verdict: 'signal' },
        { option_id: 'opt_b', prior: 0.3, current: 0.4, noise_verdict: 'within_noise' },
        { option_id: 'opt_c', prior: 0.5, current: 0.6, noise_verdict: 'not_noise_qualified' },
      ],
    }), labelFor)
    expect(v.movements.map((m) => m.noiseVerdict))
      .toEqual(['signal', 'within_noise', 'not_noise_qualified'])
  })

  it('not_noise_qualified is direction ONLY — magnitude is withheld', () => {
    const v = buildRunDeltaView(delta({
      win_probabilities: [{ option_id: 'opt_a', prior: 0.2, current: 0.8, noise_verdict: 'not_noise_qualified' }],
    }), labelFor)
    expect(v.movements[0].mayShowMagnitude).toBe(false)
    expect(v.movements[0].direction).toBe('up')
  })

  it('signal and within_noise both MAY show magnitude — the distinction is the tag, not the numbers', () => {
    const v = buildRunDeltaView(delta({
      win_probabilities: [
        { option_id: 'opt_a', prior: 0.2, current: 0.8, noise_verdict: 'signal' },
        { option_id: 'opt_b', prior: 0.2, current: 0.8, noise_verdict: 'within_noise' },
      ],
    }), labelFor)
    expect(v.movements.map((m) => m.mayShowMagnitude)).toEqual([true, true])
  })
})

describe('an absent leader id is never named', () => {
  it('withholds naming when the prior id is absent', () => {
    const v = buildRunDeltaView(delta({
      leader: { changed: true, noise_verdict: 'signal', current_leading_option_id: 'opt_b' },
    }), labelFor)
    expect(v.leader?.mayName).toBe(false)
    expect(v.leader?.priorLabel).toBeNull()
    expect(v.leader?.currentLabel).toBeNull()
    expect(v.leader?.changed).toBe(true)
  })

  it('withholds naming when the current id is absent', () => {
    const v = buildRunDeltaView(delta({
      leader: { changed: true, noise_verdict: 'signal', prior_leading_option_id: 'opt_a' },
    }), labelFor)
    expect(v.leader?.mayName).toBe(false)
    expect(v.leader?.currentLabel).toBeNull()
  })

  it('names both only when BOTH ids are present', () => {
    const v = buildRunDeltaView(delta({
      leader: { changed: true, noise_verdict: 'signal', prior_leading_option_id: 'opt_a', current_leading_option_id: 'opt_b' },
    }), labelFor)
    expect(v.leader?.mayName).toBe(true)
    expect(v.leader?.priorLabel).toBe('Raise the price')
    expect(v.leader?.currentLabel).toBe('Hold the price')
  })
})

describe('an option id binds by identity, never by position', () => {
  it('an unresolvable id yields a null label rather than a neighbour\'s', () => {
    const v = buildRunDeltaView(delta({
      win_probabilities: [{ option_id: 'opt_unknown', prior: 0.1, current: 0.2, noise_verdict: 'signal' }],
    }), labelFor)
    expect(v.movements[0].optionId).toBe('opt_unknown')
    expect(v.movements[0].label).toBeNull()
  })
})

describe('withheld producer fields are not read', () => {
  it('a populated flip_thresholds changes NOTHING in the view model', () => {
    const bare = buildRunDeltaView(delta(), labelFor)
    const withFlips = buildRunDeltaView(delta({
      flip_thresholds: [
        { factor_id: 'fac_x', band_verdict: 'bands_disjoint', prior_median: 1, current_median: 2 },
      ],
    } as Partial<RunDelta>), labelFor)
    expect(withFlips).toEqual(bare)
  })

  it('an edit_list changes NOTHING in the view model (Core has not shipped it)', () => {
    const bare = buildRunDeltaView(delta(), labelFor)
    const withEdits = buildRunDeltaView(delta({ edit_list: ['nodes.fac_x.value'] } as Partial<RunDelta>), labelFor)
    expect(withEdits).toEqual(bare)
  })
})

describe('the copy clears the estate vocabulary guard', () => {
  it('no comparability sentence or rider contains a banned term', () => {
    const all: Array<RunDelta['attribution_case']> = [
      'C0_identical', 'C1_attributable', 'C2_unpaired', 'C3_engine_drift', 'C4_budget_drift',
    ]
    const strings = all.flatMap((c) => {
      const v = buildRunDeltaView(delta({ attribution_case: c }), labelFor)
      return [v.comparability, v.attributionLimit ?? '']
    })
    for (const s of strings) {
      for (const term of ANALYSIS_HERO_BANNED_TERMS) {
        expect(s.toLowerCase(), `"${s}" contains banned term "${term}"`).not.toContain(term.toLowerCase())
      }
    }
  })
})
