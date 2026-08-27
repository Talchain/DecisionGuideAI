import { describe, it, expect } from 'vitest'
import {
  deriveOptionCoverage,
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

  // ⚠ THIS TEST ONCE ASSERTED `kind === 'even'` ON THIS FIXTURE AND THE COPY
  // CLAIMED "Every option has all its effects set". Adoption is unset on BOTH
  // options here, so that was a fabrication the suite was pinning: the invariant
  // had been written against the failure mode in hand (uneven counts) rather
  // than against the claim the copy makes (completeness).
  it('does NOT call matching counts complete when a factor is unset on every option', () => {
    const evenChallenger: CoverageOption = {
      ...CHALLENGER,
      interventions: { [SWITCHING]: 0.4, [LICENCE]: 0.2 },
    }
    const reading = deriveOptionCoverage([evenChallenger, BASELINE], MODEL_FACTORS)
    expect(reading!.kind).toBe('even-incomplete')
    expect(reading!.perOption).toHaveLength(2)
  })

  it('calls it complete only when every option sets every factor', () => {
    const all = (id: string): CoverageOption => ({
      id, label: `Option ${id.toUpperCase()}`, interventions: { [SWITCHING]: 0.4, [LICENCE]: 0.5, [ADOPTION]: 0.6 },
    })
    expect(deriveOptionCoverage([all('a'), all('b')], MODEL_FACTORS)!.kind).toBe('complete')
  })

  // ⭐ THE REACHABLE PATH THAT MADE THE OLD PREDICATE SERIOUS: the feature's own
  // remedy produced the fabrication. The strip asks the user to set the missing
  // licence cost; they set it; both options reach 2 of 3; the old predicate
  // flipped to `even` and the product declared the model COMPLETE while adoption
  // sat empty on both.
  it('does not flip to complete when the user resolves only the asymmetry', () => {
    const repaired: CoverageOption = {
      ...CHALLENGER,
      interventions: { [SWITCHING]: 0.4, [LICENCE]: 0.5 },
    }
    const reading = deriveOptionCoverage([repaired, BASELINE], MODEL_FACTORS)
    expect(reading!.kind).not.toBe('complete')
    expect(reading!.perOption.every((o) => o.unsetFactorIds.includes(ADOPTION))).toBe(true)
  })

  it('does not call disjoint or empty coverage complete', () => {
    const onlyA: CoverageOption = { id: 'a', label: 'Option A', interventions: { [SWITCHING]: 1 } }
    const onlyB: CoverageOption = { id: 'b', label: 'Option B', interventions: { [LICENCE]: 1 } }
    expect(deriveOptionCoverage([onlyA, onlyB], MODEL_FACTORS)!.kind).toBe('even-incomplete')

    const noneA: CoverageOption = { id: 'a', label: 'Option A', interventions: {} }
    const noneB: CoverageOption = { id: 'b', label: 'Option B', interventions: {} }
    expect(deriveOptionCoverage([noneA, noneB], MODEL_FACTORS)!.kind).toBe('even-incomplete')
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

  it('says NOTHING when an option cannot be honestly named', () => {
    // ⚠ THE GUARD CAUGHT THIS SPEC'S OWN FIXTURES. Three tests here used the id
    // as the label — the exact laziness the guard forbids — and went red. The
    // fixtures were wrong, not the guard.
    //
    // It lives in the MODULE rather than a caller because there is now more than
    // one caller, and an option we cannot name aborts the WHOLE reading rather
    // than being dropped: omitting a participant can turn uneven into even and
    // incomplete into COMPLETE.
    const unnameable: CoverageOption = { id: '5f6f5e36', label: '5f6f5e36', interventions: {} }
    expect(deriveOptionCoverage([unnameable, BASELINE], MODEL_FACTORS)).toBeNull()
    const unlabelled = { id: 'opt_x', label: '', interventions: {} } as CoverageOption
    expect(deriveOptionCoverage([unlabelled, BASELINE], MODEL_FACTORS)).toBeNull()
  })

  it('says nothing when there is nothing honest to say', () => {
    expect(deriveOptionCoverage([CHALLENGER], MODEL_FACTORS)).toBeNull()
    expect(deriveOptionCoverage([CHALLENGER, BASELINE], [])).toBeNull()
  })

  it('treats a missing or null interventions map as no effects set', () => {
    const bare: CoverageOption = { id: 'opt_bare', label: 'A bare option', interventions: null }
    const reading = deriveOptionCoverage([bare, BASELINE], MODEL_FACTORS)
    const bareRead = reading!.perOption.find((o) => o.optionId === 'opt_bare')!
    expect(bareRead.setFactorIds).toEqual([])
    expect(bareRead.unsetFactorIds).toEqual([SWITCHING, LICENCE, ADOPTION])
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

  it('SAYS the complete case rather than rendering nothing', () => {
    const all = (id: string): CoverageOption => ({
      id, label: `Option ${id.toUpperCase()}`, interventions: { [SWITCHING]: 0.4, [LICENCE]: 0.5, [ADOPTION]: 0.6 },
    })
    const d = buildCoverageDisclosure(deriveOptionCoverage([all('a'), all('b')], MODEL_FACTORS), labelFor)!
    expect(d.kind).toBe('complete')
    expect(d.headline).toBe('Every option has all its effects set')
    expect(d.unsetByOption).toEqual([])
  })

  it('NEVER claims completeness on a model that merely has matching counts', () => {
    const evenChallenger: CoverageOption = {
      ...CHALLENGER,
      interventions: { [SWITCHING]: 0.4, [LICENCE]: 0.2 },
    }
    const d = buildCoverageDisclosure(
      deriveOptionCoverage([evenChallenger, BASELINE], MODEL_FACTORS), labelFor,
    )!
    expect(d.kind).toBe('even-incomplete')
    expect(d.headline).not.toBe('Every option has all its effects set')
    expect(d.detail).not.toMatch(/complete model/i)
    // and it must still name what is missing
    expect(d.unsetByOption.flatMap((o) => o.unsetLabels)).toContain('CRM Adoption and Usability')
  })

  it('returns null when there is no reading', () => {
    expect(buildCoverageDisclosure(null, labelFor)).toBeNull()
  })
})
