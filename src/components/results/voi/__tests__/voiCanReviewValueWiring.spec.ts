/**
 * ⚠ WRITTEN BECAUSE A MUTANT SURVIVED, and the mutant was a real hole.
 *
 * The review affordance's whole safety property lives at the CALLER: the hero
 * component only renders what `canReviewValue` tells it, and the caller is what
 * decides that. Mutating the caller to `canReviewValue: true` — offering the
 * control on every row including unset ones, which is precisely the dead end the
 * gate exists to prevent — left the component suite 7/7 GREEN.
 *
 * A component spec cannot see its caller. So this asserts the wiring structurally:
 * the resolver must consult the ONE exported authority, by name, and must not
 * hand back a constant.
 *
 * WHAT THIS CANNOT SEE: a caller that imports the authority and then ignores its
 * result. That would need the hook under test, which is not proportionate here —
 * so it is named rather than implied.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const CALLER = 'src/components/results/useResultsSectionData.ts'
const AUTHORITY = 'factorHasConfirmableValue'

describe('canReviewValue is decided by the single authority', () => {
  const source = readFileSync(CALLER, 'utf8')

  it('the caller is tracked and readable (positive control)', () => {
    const tracked = execFileSync('git', ['ls-files', CALLER], { encoding: 'utf8' }).trim()
    expect(tracked, `${CALLER} is not tracked — this guard would read a stale or absent file`).toBe(CALLER)
    expect(source.length).toBeGreaterThan(1000)
  })

  it('imports the authority rather than re-spelling the predicate', () => {
    expect(
      new RegExp(`import\\s*\\{[^}]*\\b${AUTHORITY}\\b`).test(source),
      `${CALLER} must import ${AUTHORITY}. Five surfaces once answered this question `
        + 'four ways; that module exists to end it, and a local re-spelling would restart it.',
    ).toBe(true)
  })

  it('consults it when resolving a voi row, and does not hand back a constant', () => {
    // The resolver block, bounded so an unrelated use elsewhere cannot satisfy this.
    const start = source.indexOf('resolveLabel: (factorId)')
    expect(start, 'the voi resolveLabel resolver was not found — has it been renamed?').toBeGreaterThan(-1)
    const block = source.slice(start, start + 1600)

    expect(
      block.includes(`${AUTHORITY}(`),
      `the voi resolver must call ${AUTHORITY}; without it the review control can be `
        + 'offered on a factor the Model tab renders as an inert "Not set", which is an '
        + 'advertised action terminating in nothing.',
    ).toBe(true)

    expect(
      /canReviewValue:\s*(?:true|false)\s*,/.test(block),
      'canReviewValue must be derived, never a literal — a constant `true` offers the '
        + 'control on unset rows, whose rerun also refuses (baseline_scale_unresolved).',
    ).toBe(false)
  })
})
