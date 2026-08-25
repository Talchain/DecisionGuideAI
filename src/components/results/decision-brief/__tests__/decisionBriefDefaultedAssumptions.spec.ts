/**
 * Decision Brief — `defaulted_assumptions`, category identity, cap and poison-row behaviour.
 *
 * WHY THIS FILE EXISTS. Four defects were found by cross-review and confirmed here at the
 * bytes against real captures:
 *
 *  1. "What this rests on" rendered `key_assumptions`, which is a SUBSET of `top_drivers`
 *     on every capture measured (3 Aug: identical as sets, 3/3; 25 Aug live: 3/3 contained).
 *     A subset can never be a distinct answer, so the two categories showed the same list.
 *     The honest source for "what did the analysis have to assume" is `defaulted_assumptions`,
 *     which carries the PRODUCER'S OWN PROSE and answers a different question.
 *  2. A category emptied completely when the producer exceeded its own declared cap
 *     (`length > max` returned `[]`), so 11 items rendered as zero.
 *  3. One malformed row emptied its whole category, suppressing valid siblings.
 *  4. The note interpolates a USER-AUTHORED factor label, and the glossary guard bans
 *     ordinary business vocabulary (`variance`, `intervention`, `blocked`, `win rate`).
 *     Measured: 0 of 17 distinct captured notes trip it today — but "Budget Variance" is an
 *     entirely ordinary factor name, so the collision is REACHABLE and UNOBSERVED. It is
 *     pinned here rather than discovered in production.
 *
 * The rule this file enforces (brief §6): VET the whole rendered join, never REWRITE it.
 * A row whose producer sentence cannot be shown unchanged is WITHHELD, never repaired —
 * substituting a fallback into the producer's sentence would change its meaning.
 */
import { describe, it, expect } from 'vitest'
import { readDecisionBriefViewModel } from '../decisionBriefViewModel'

const BRIEF_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const CREATED_AT = '2026-08-25T08:16:20.000Z'

const note = (label: string) =>
  `No starting value was provided for "${label}" — the analysis used a default. `
  + 'Setting a real value or range would make this result more trustworthy.'

const defaulted = (label: string) => ({
  factor_label: label,
  note: note(label),
  source: 'value_defaulted',
  doctrine: 'provisional_doctrine_v0',
})

function brief(extra: Record<string, unknown>) {
  return { version: '1', brief_id: BRIEF_ID, created_at: CREATED_AT, ...extra }
}

describe('defaulted_assumptions reaches the view model', () => {
  it('carries the producer note verbatim, anchored by its factor label', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [defaulted('Available Growth Budget')],
    }))
    expect(vm?.defaultedAssumptions).toEqual([
      { factorLabel: 'Available Growth Budget', note: note('Available Growth Budget') },
    ])
  })

  it('withholds a row whose source is not the producer value_defaulted token', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [
        { ...defaulted('Current ARR'), source: 'something_else' },
        defaulted('B2B Market Demand'),
      ],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel)).toEqual(['B2B Market Demand'])
  })

  it('renders nothing for the category when the producer sends an empty list', () => {
    // Measured on the 25 Aug live wire: the key is present and empty on real runs.
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [],
      top_drivers: [{ factor_label: 'Churn Trend', sensitivity: 0.4, direction: 'positive' }],
    }))
    expect(vm?.defaultedAssumptions).toEqual([])
  })
})

describe('producer prose safety — vet, never rewrite (brief §6)', () => {
  it('WITHHOLDS a row whose note trips the glossary guard, keeping valid siblings', () => {
    // "Budget Variance" is an ordinary factor name; `variance` is a banned term.
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [defaulted('Budget Variance'), defaulted('Current ARR')],
    }))
    expect(vm?.defaultedAssumptions.map(d => d.factorLabel)).toEqual(['Current ARR'])
  })

  it('never substitutes a fallback into the producer sentence', () => {
    const vm = readDecisionBriefViewModel(brief({
      defaulted_assumptions: [defaulted('Clinical Intervention Cost')],
    }))
    // The row is gone entirely; no repaired sentence is emitted in its place.
    expect(vm?.defaultedAssumptions ?? []).toEqual([])
    const joined = JSON.stringify(vm ?? {})
    expect(joined).not.toContain('this factor')
    expect(joined).not.toContain('Intervention')
  })
})

describe('cap at the producer maximum truncates, never empties', () => {
  it('renders 10 of 11 key assumptions rather than zero', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `Assumption ${i + 1}`)
    const vm = readDecisionBriefViewModel(brief({ key_assumptions: eleven }))
    expect(vm?.keyAssumptions).toHaveLength(10)
    expect(vm?.keyAssumptions[0]).toBe('Assumption 1')
  })

  it('renders 5 of 6 top drivers rather than zero', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      factor_label: `Driver ${i + 1}`, sensitivity: 1 - i / 10, direction: 'positive' as const,
    }))
    const vm = readDecisionBriefViewModel(brief({ top_drivers: six }))
    expect(vm?.topDrivers.map(d => d.label)).toEqual([
      'Driver 1', 'Driver 2', 'Driver 3', 'Driver 4', 'Driver 5',
    ])
  })
})

describe('one bad row cannot suppress valid siblings', () => {
  it('keeps the valid leading rows of a ranked category and truncates at the first bad one', () => {
    // Ranked data: dropping a middle row would silently re-rank what follows, so the
    // honest response is a prefix, not a filter.
    const vm = readDecisionBriefViewModel(brief({
      what_would_change: ['Demand holds', 'deadbeefcafe1234', 'Costs fall'],
    }))
    expect(vm?.whatWouldChange).toEqual(['Demand holds'])
  })

  it('keeps valid drivers when a later driver row is malformed', () => {
    const vm = readDecisionBriefViewModel(brief({
      top_drivers: [
        { factor_label: 'Churn Trend', sensitivity: 0.9, direction: 'positive' },
        { factor_label: 'Broken', sensitivity: 'nope', direction: 'positive' },
      ],
    }))
    expect(vm?.topDrivers.map(d => d.label)).toEqual(['Churn Trend'])
  })

  /**
   * ⚠ ADDED AFTER A SURVIVING MUTANT. Mutating the null-row `break` to `return []`
   * left the whole suite green, because the only malformed row in the fixture
   * above is ID-SHAPED and is caught by the *second* break. The corpus therefore
   * never exercised the first one. That is a gap in this kit, not an equivalent
   * mutant — a non-string row behaves differently in general — so the case is
   * added rather than the survivor being explained away.
   */
  it('truncates at a non-string row, keeping the valid rows before it', () => {
    const vm = readDecisionBriefViewModel(brief({
      what_would_change: ['Demand holds', 42 as unknown as string, 'Costs fall'],
    }))
    expect(vm?.whatWouldChange).toEqual(['Demand holds'])
  })

  it('truncates at a blank row, keeping the valid rows before it', () => {
    const vm = readDecisionBriefViewModel(brief({
      key_assumptions: ['Demand holds', '   ', 'Costs fall'],
    }))
    expect(vm?.keyAssumptions).toEqual(['Demand holds'])
  })
})
