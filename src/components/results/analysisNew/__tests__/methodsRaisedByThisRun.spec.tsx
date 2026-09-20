/**
 * ⭐⭐ THE SHELF SAYS WHICH MOVES THIS RUN RAISED — AND ITS OWN SUBTITLE WAS THE
 * CONFESSION.
 *
 * `MethodsYouCanRun` shipped with *"Science-grounded moves you can make
 * yourself — whether or not this run raised them."* Seven equal chips in the
 * panel's FIRST SCREEN (ZONE: FOCUS), unconditioned by the model in front of
 * the reader, while the genuinely run-specific coaching sits four sections
 * further down. That is a reference list in the prime slot, and the subtitle
 * said so.
 *
 * ⛔ THE FIX IS A GROUPING, NEVER A RANKING. Nothing on the wire orders these
 * seven, so an ordering invented here would be a UI claim wearing a finding's
 * clothes — the same defect as re-sorting incommensurable driver metrics. The
 * membership question has an existing owner: `methodForRecommendation` already
 * decides whether a finding and a technique are the SAME MOVE, and its header
 * records why that map is deliberately short. `methodIdsRaisedBy` asks it and
 * nothing else.
 *
 * ⚠ BOTH DIRECTIONS ARE ASSERTED. A grouping that fired whenever ANY method
 * matched would put a "Raised by this run" heading over nothing on the common
 * empty run, and one that never fired would leave today's defect in place.
 * Neither passes below (trap 22b — a corpus testing one direction is a guard
 * watching one door).
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MethodsYouCanRun } from '../sections/MethodsYouCanRun'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { methodIdsRaisedBy } from '../recommendationMethod'

afterEach(cleanup)

const TESTID = 'analysis-new-methods-you-can-run'
const ids = (scope: HTMLElement): string[] =>
  within(scope)
    .getAllByTestId(`${TESTID}-method`)
    .map((b) => b.getAttribute('data-method-id') ?? '')

/** ⚠ ASSERT THE CORPUS EXISTS. An empty catalogue would make every case below
 *  iterate nothing and pass, which is a green suite that ran no product code. */
describe('the catalogue this spec is about', () => {
  it('carries more than one method', () => {
    expect(METHOD_CATALOGUE.length).toBeGreaterThan(1)
  })
})

describe('methodIdsRaisedBy — membership, from the existing owner', () => {
  it('is empty for findings no technique matches', () => {
    expect(methodIdsRaisedBy([{ id: 'strengthen:commit' }]).size).toBe(0)
    expect(methodIdsRaisedBy([]).size).toBe(0)
  })

  /**
   * ⭐ BOUND TO THE OWNER, NOT TO A LIST. The prefixes live in
   * `recommendationMethod.ts`; re-spelling one here would be the hand-maintained
   * mirror that module's own drift guard exists to catch. So the case is built
   * from a recommendation id the mapper is known to answer, and the assertion is
   * that SOMETHING was raised and that it is a real catalogue member.
   */
  it('raises a catalogue member for a finding that maps to one', () => {
    const raised = methodIdsRaisedBy([{ id: 'strengthen:broaden' }])
    expect(raised.size).toBeGreaterThan(0)
    for (const id of raised) {
      expect(METHOD_CATALOGUE.some((m) => m.id === id)).toBe(true)
    }
  })

  it('does not depend on the order findings arrive in', () => {
    const recs = [{ id: 'strengthen:broaden' }, { id: 'strengthen:commit' }]
    expect([...methodIdsRaisedBy(recs)].sort()).toEqual(
      [...methodIdsRaisedBy([...recs].reverse())].sort(),
    )
  })
})

describe('the shelf falls back to today’s flat list', () => {
  it.each([
    ['no prop at all', undefined],
    ['an empty set', new Set<string>()],
    ['every method raised', new Set(METHOD_CATALOGUE.map((m) => m.id))],
  ])('renders one ungrouped list and the original subtitle given %s', (_label, raised) => {
    render(<MethodsYouCanRun raisedMethodIds={raised as ReadonlySet<string> | undefined} />)
    expect(screen.getByTestId(`${TESTID}-list`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TESTID}-group-this-run`)).toBeNull()
    expect(screen.queryByTestId(`${TESTID}-group-other`)).toBeNull()
    // ⚠ THE DISCLAIMER IS TRUE HERE AND MUST SURVIVE. It is the sentence the
    // section was written around, and it is only misleading once a group above
    // it says otherwise.
    expect(
      screen.getByText(/whether or not this run raised them/i),
    ).toBeInTheDocument()
    expect(ids(screen.getByTestId(TESTID))).toEqual(METHOD_CATALOGUE.map((m) => m.id))
  })
})

describe('the shelf groups when — and only when — both groups have members', () => {
  const first = METHOD_CATALOGUE[0].id

  it('names the run’s own moves above the rest, and drops the disclaimer', () => {
    render(<MethodsYouCanRun raisedMethodIds={new Set([first])} />)
    expect(screen.getByTestId(`${TESTID}-group-this-run`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TESTID}-group-other`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TESTID}-list`)).toBeNull()
    // The disclaimer would now contradict the heading directly above it.
    expect(screen.queryByText(/whether or not this run raised them/i)).toBeNull()
  })

  it('puts every method in exactly one group, losing none', () => {
    render(<MethodsYouCanRun raisedMethodIds={new Set([first])} />)
    const inRun = ids(screen.getByTestId(`${TESTID}-list-this-run`))
    const inOther = ids(screen.getByTestId(`${TESTID}-list-other`))
    expect(inRun).toEqual([first])
    expect([...inRun, ...inOther].sort()).toEqual(METHOD_CATALOGUE.map((m) => m.id).sort())
    expect(inRun.filter((id) => inOther.includes(id))).toEqual([])
  })

  /**
   * ⭐⭐ THE CONTRAST CONTROL FOR "NO RANKING". Grouping is a partition, so each
   * group must keep the CATALOGUE's order — not the order the ids were raised
   * in, and not a sort. Raising two members in reverse catalogue order must
   * change nothing about how they render.
   */
  it('keeps the catalogue’s order inside each group', () => {
    const a = METHOD_CATALOGUE[0].id
    const b = METHOD_CATALOGUE[2].id
    render(<MethodsYouCanRun raisedMethodIds={new Set([b, a])} />)
    expect(ids(screen.getByTestId(`${TESTID}-list-this-run`))).toEqual([a, b])
    expect(ids(screen.getByTestId(`${TESTID}-list-other`))).toEqual(
      METHOD_CATALOGUE.filter((m) => m.id !== a && m.id !== b).map((m) => m.id),
    )
  })

  /**
   * ⚠ EVERY CHIP STAYS PRESSABLE AND STAYS 24px. The whole point of the shelf
   * is that all seven are USER-invocable; a grouping that quietly demoted the
   * unraised ones into something unreachable would undo it.
   */
  it('leaves every method a real control at the minimum touch size', () => {
    render(<MethodsYouCanRun raisedMethodIds={new Set([first])} />)
    const all = screen.getAllByTestId(`${TESTID}-method`)
    expect(all).toHaveLength(METHOD_CATALOGUE.length)
    for (const b of all) {
      expect(b.tagName).toBe('BUTTON')
      expect(b).toBeEnabled()
      expect(b.className).toContain('min-h-[24px]')
      expect(b.className).toContain('min-w-[24px]')
    }
  })
})
