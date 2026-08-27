import { describe, it, expect } from 'vitest'
import {
  deriveOptionCoverage,
  rankingIsProvisional,
  buildCoverageDisclosure,
  type CoverageOption,
} from '../optionCoverage'

/**
 * ⚠ THE SHAPE HERE WAS WRONG ONCE, AND THE MUTATION KIT IS WHAT CAUGHT IT.
 * The first draft wrote each intervention as `{ normalised_value: 0 }`. The wire
 * sends a BARE NUMBER (`{"6886a726": 0}`) — `intervention_details` is the
 * separate object map. An object is always truthy, so with that fixture the
 * truthiness mutant SURVIVED: the "counts ZERO as SET" test asserted the right
 * thing and could not fail. A fixture you wrote yourself is not evidence about
 * the wire — a rule this file's own header quoted while getting the shape wrong.
 *
 * Fixture taken from a REAL capture, not invented:
 * `20260826T212322Z-fresh-extended-507050` / `step-T3_ANALYSE.json`
 * (CEE `58fdb11`, UI `f287c012`). A self-authored fixture encodes the author's
 * model of the producer rather than the producer — the exact trap that let a
 * reachability claim through on an impossible payload.
 *
 * Note what this real payload contains that an invented one would not have:
 *   · a genuine intervention VALUE OF ZERO (`keep what we have` on switching
 *     cost), which a truthiness check would misreport as unset;
 *   · a factor unset on BOTH options (adoption), so the asymmetry is NOT
 *     one-sided — an earlier draft of this feature described it as one-sided
 *     and was refuted at the drafting seam.
 */
const SWITCHING = '6886a726'
const LICENCE = 'ee70668c'
const ADOPTION = 'e0fe8ecc'
const MODEL_FACTORS = [SWITCHING, LICENCE, ADOPTION] as const

const CHALLENGER: CoverageOption = {
  id: '5f6f5e36',
  label: 'replace our current CRM with HubSpot next quarter',
  interventions: { [SWITCHING]: 0.4 },
}
const BASELINE: CoverageOption = {
  id: 'a551345f',
  label: 'keep what we have',
  interventions: { [SWITCHING]: 0, [LICENCE]: 0.5 },
}

describe('deriveOptionCoverage', () => {
  it('reports the captured run as uneven, and binds every cell by factor id', () => {
    const reading = deriveOptionCoverage([CHALLENGER, BASELINE], MODEL_FACTORS)
    expect(reading).not.toBeNull()
    expect(reading!.kind).toBe('uneven')

    // Bound by IDENTITY (option id), never by position or by label text —
    // a value predicate another option could satisfy is how a test passes on
    // the wrong object.
    const challenger = reading!.perOption.find((o) => o.optionId === '5f6f5e36')
    const baseline = reading!.perOption.find((o) => o.optionId === 'a551345f')
    expect(challenger).toBeDefined()
    expect(baseline).toBeDefined()

    expect(challenger!.setFactorIds).toEqual([SWITCHING])
    expect(challenger!.unsetFactorIds).toEqual([LICENCE, ADOPTION])
    expect(baseline!.setFactorIds).toEqual([SWITCHING, LICENCE])
    expect(baseline!.unsetFactorIds).toEqual([ADOPTION])
  })

  it('counts an intervention value of ZERO as SET', () => {
    // `keep what we have` sets switching cost to 0. That is a real, stated
    // effect. A truthiness test would report it missing and the strip would
    // tell the user a value they supplied was never set.
    const reading = deriveOptionCoverage([CHALLENGER, BASELINE], MODEL_FACTORS)
    const baseline = reading!.perOption.find((o) => o.optionId === 'a551345f')!
    expect(baseline.setFactorIds).toContain(SWITCHING)
    expect(baseline.unsetFactorIds).not.toContain(SWITCHING)
  })

  it('reports a factor unset on EVERY option against every option', () => {
    // The asymmetry in the captured run is NOT one-sided: adoption is empty on
    // both. A denominator derived from the union of intervened factors would
    // have dropped adoption entirely and reported a tidier, false ratio.
    const reading = deriveOptionCoverage([CHALLENGER, BASELINE], MODEL_FACTORS)
    for (const option of reading!.perOption) {
      expect(option.unsetFactorIds).toContain(ADOPTION)
    }
    expect(reading!.modelFactorIds).toContain(ADOPTION)
  })

  it('reports even coverage when both options set the same number of effects', () => {
    const evenChallenger: CoverageOption = {
      ...CHALLENGER,
      interventions: { [SWITCHING]: 0.4, [LICENCE]: 0.2 },
    }
    const reading = deriveOptionCoverage([evenChallenger, BASELINE], MODEL_FACTORS)
    expect(reading!.kind).toBe('even')
    // Honest at zero is SAID, not encoded as an absence: an even reading is a
    // real reading with real contents, never null.
    expect(reading!.perOption).toHaveLength(2)
  })

  it('echoes the caller-supplied denominator and never invents one', () => {
    const reading = deriveOptionCoverage([CHALLENGER, BASELINE], MODEL_FACTORS)
    expect(reading!.modelFactorIds).toEqual([SWITCHING, LICENCE, ADOPTION])
  })

  it('does not let a repeated factor id inflate the totals', () => {
    const reading = deriveOptionCoverage([CHALLENGER, BASELINE], [SWITCHING, SWITCHING, LICENCE, ADOPTION])
    expect(reading!.modelFactorIds).toEqual([SWITCHING, LICENCE, ADOPTION])
    const baseline = reading!.perOption.find((o) => o.optionId === 'a551345f')!
    expect(baseline.setFactorIds).toEqual([SWITCHING, LICENCE])
  })

  it('says nothing when there is nothing honest to say', () => {
    expect(deriveOptionCoverage([CHALLENGER], MODEL_FACTORS)).toBeNull()
    expect(deriveOptionCoverage([CHALLENGER, BASELINE], [])).toBeNull()
  })

  it('treats a missing or null interventions map as no effects set', () => {
    const bare: CoverageOption = { id: 'opt_bare', label: 'bare', interventions: null }
    const reading = deriveOptionCoverage([bare, BASELINE], MODEL_FACTORS)
    const bareRead = reading!.perOption.find((o) => o.optionId === 'opt_bare')!
    expect(bareRead.setFactorIds).toEqual([])
    expect(bareRead.unsetFactorIds).toEqual([SWITCHING, LICENCE, ADOPTION])
  })
})

describe('rankingIsProvisional', () => {
  it('is true exactly when coverage is uneven', () => {
    const uneven = deriveOptionCoverage([CHALLENGER, BASELINE], MODEL_FACTORS)
    expect(rankingIsProvisional(uneven)).toBe(true)

    const evenChallenger: CoverageOption = {
      ...CHALLENGER,
      interventions: { [SWITCHING]: 0.4, [LICENCE]: 0.2 },
    }
    const even = deriveOptionCoverage([evenChallenger, BASELINE], MODEL_FACTORS)
    expect(rankingIsProvisional(even)).toBe(false)
  })

  it('is false when there is no reading, rather than throwing', () => {
    expect(rankingIsProvisional(null)).toBe(false)
  })
})

describe('buildCoverageDisclosure', () => {
  const LABELS: Record<string, string> = {
    [SWITCHING]: 'One-Off Switching Cost',
    [LICENCE]: 'CRM Annual Licence Cost',
    [ADOPTION]: 'CRM Adoption and Usability',
  }
  const labelFor = (id: string) => LABELS[id] ?? null

  it('states the counts and hedges the RANKING, never the run', () => {
    const reading = deriveOptionCoverage([CHALLENGER, BASELINE], MODEL_FACTORS)
    const d = buildCoverageDisclosure(reading, labelFor)!
    expect(d.kind).toBe('uneven')
    expect(d.detail).toContain('1 of 3 set')
    expect(d.detail).toContain('2 of 3 set')
    // Paul's ruling: provisional register, never a named winner.
    expect(d.detail).toContain('currently scores higher')
    // ⛔ It must NOT read as a verdict on whether the analysis should have run —
    // 5 runs in a 122-run corpus are `ready` AND uneven, and contradicting the
    // producer on its own screen is the harm the `may_run` waiver prevents.
    expect(d.detail).not.toMatch(/unreliable|invalid|should not|cannot be trusted/i)
    // ⛔ And no direction, and no cause.
    expect(d.detail).not.toMatch(/would win|would change the (winner|ranking)|because/i)
  })

  it('names the unset factors per option, bound by the labels supplied', () => {
    const reading = deriveOptionCoverage([CHALLENGER, BASELINE], MODEL_FACTORS)
    const d = buildCoverageDisclosure(reading, labelFor)!
    const challenger = d.unsetByOption.find((o) => o.label.startsWith('replace our current CRM'))!
    expect(challenger.unsetLabels).toEqual(['CRM Annual Licence Cost', 'CRM Adoption and Usability'])
    const baseline = d.unsetByOption.find((o) => o.label === 'keep what we have')!
    expect(baseline.unsetLabels).toEqual(['CRM Adoption and Usability'])
  })

  it('DROPS a factor with no honest label rather than printing its id', () => {
    // An internal id at a user surface is the leak this estate has already paid
    // for. `resolveCanvasLabel` returns null rather than the id; this must obey.
    const reading = deriveOptionCoverage([CHALLENGER, BASELINE], MODEL_FACTORS)
    const d = buildCoverageDisclosure(reading, (id) => (id === LICENCE ? null : LABELS[id] ?? null))!
    const flat = d.unsetByOption.flatMap((o) => o.unsetLabels)
    expect(flat).not.toContain(LICENCE)
    expect(flat.some((l) => l.includes(LICENCE))).toBe(false)
    expect(flat).toContain('CRM Adoption and Usability')
  })

  it('SAYS the even case rather than rendering nothing', () => {
    const evenChallenger: CoverageOption = {
      ...CHALLENGER,
      interventions: { [SWITCHING]: 0.4, [LICENCE]: 0.2 },
    }
    const d = buildCoverageDisclosure(
      deriveOptionCoverage([evenChallenger, BASELINE], MODEL_FACTORS),
      labelFor,
    )!
    expect(d.kind).toBe('even')
    expect(d.headline).toBe('Every option has all its effects set')
    expect(d.unsetByOption).toEqual([])
  })

  it('returns null when there is no reading', () => {
    expect(buildCoverageDisclosure(null, labelFor)).toBeNull()
  })
})
