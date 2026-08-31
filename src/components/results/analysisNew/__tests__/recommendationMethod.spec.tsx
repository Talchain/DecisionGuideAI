/**
 * The method-to-finding attachment, and the two ways it can rot silently.
 *
 * ⚠ THE FAILURE MODE THIS EXISTS FOR IS A FEATURE DISAPPEARING, NOT A CRASH.
 * `methodForRecommendation` returns `null` for most findings BY DESIGN, so if a
 * catalogue rename or a builder-id change broke every lookup, the surface would
 * simply stop showing method chips and every existing test would stay green —
 * the map would have quietly become a no-op (CLAUDE.md trap 12). Both halves are
 * pinned here against their real sources, never against a copy.
 */

import { describe, expect, it } from 'vitest'

import {
  methodForRecommendation,
  MAPPED_METHOD_IDS,
  MAPPED_RECOMMENDATION_PREFIXES,
} from '../recommendationMethod'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'

describe('the map is anchored to both real sources', () => {
  it('every mapped method id exists in the catalogue', () => {
    const catalogueIds = new Set(METHOD_CATALOGUE.map((m) => m.id))
    const missing = MAPPED_METHOD_IDS.filter((id) => !catalogueIds.has(id))
    expect(
      missing,
      'a catalogue rename has turned these mappings into silent no-ops',
    ).toEqual([])
  })

  /**
   * ⭐ THE POSITIVE CONTROL, AND IT IS THE LOAD-BEARING ONE. The assertion above
   * passes trivially if the map is empty. This pins that the map is non-trivial
   * and that its lookups actually resolve, so hollowing it out REDs here.
   */
  it('the map is non-empty and every prefix resolves to a real method', () => {
    expect(MAPPED_RECOMMENDATION_PREFIXES.length).toBeGreaterThanOrEqual(3)
    for (const prefix of MAPPED_RECOMMENDATION_PREFIXES) {
      expect(methodForRecommendation(prefix), `${prefix} resolved to nothing`).not.toBeNull()
    }
  })
})

describe('attachment is exact, and absence is the common case', () => {
  it('matches a bare builder id', () => {
    expect(methodForRecommendation('strengthen:robustness')?.id).toBe('pre_mortem')
    expect(methodForRecommendation('strengthen:broaden')?.id).toBe('different_option')
  })

  it('matches a per-target id through its prefix', () => {
    // `strengthen:flip:${edgeId}` — four of the eight builders mint ids this way.
    expect(methodForRecommendation('strengthen:flip:e_warm_network')?.id).toBe(
      'consider_opposite',
    )
  })

  /**
   * ⚠ BINDS BY IDENTITY, NOT BY A PREDICATE ANOTHER ID COULD SATISFY (trap 19).
   * `strengthen:flipside` starts with the same eight characters as
   * `strengthen:flip` and must NOT match — a bare `startsWith` would attach
   * "Consider the opposite" to an unrelated future builder.
   */
  it('a longer id that merely starts with a prefix does not match', () => {
    expect(methodForRecommendation('strengthen:flipside')).toBeNull()
    expect(methodForRecommendation('strengthen:robustnessCheck')).toBeNull()
  })

  it('findings with no genuine technique get no method, not a default', () => {
    // These are real builder ids. None of the seven techniques IS the move they
    // describe, so the card must say nothing rather than guess.
    for (const id of [
      'strengthen:success-measure',
      'strengthen:commit',
      'strengthen:lehi:f_data_team',
      'strengthen:voi:f_platform_cost',
      'strengthen:phase3:some-wire-id',
    ]) {
      expect(methodForRecommendation(id), `${id} should carry no method`).toBeNull()
    }
  })

  it('an empty or unknown id is null rather than a throw', () => {
    expect(methodForRecommendation('')).toBeNull()
    expect(methodForRecommendation('something:else')).toBeNull()
  })
})
