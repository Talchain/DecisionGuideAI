/**
 * B4 / ledger N-20 — "you said: …" provenance reaches a screen.
 *
 * THE FINDING, re-derived at this tip before building on it (a ledger row is a
 * claim, not evidence):
 *
 *   · `source_quote` IS carried end to end. `applyV5State.ts:421` copies it onto
 *     the persisted `CEEGoalConstraint`, and `constraintsDeepEqual` includes it,
 *     so a change to the quote alone forces a write. It is authoritative
 *     persisted state, which is what lets a "you said" claim satisfy P5.
 *   · It is typed at `adapters/cee/types.ts:314`.
 *   · It had ZERO render consumers. Contrast control run in the same sweep:
 *     `goalThreshold` resolves in 82 files. So this was real absence, not a
 *     blind grep.
 *   · The row's other half, `label_authored`, returns ZERO hits anywhere in
 *     `src/` at this tip — it is not a UI field here at all. The ledger row
 *     names two fields; only one of them exists. Reported, not silently fixed.
 *
 * WHAT THIS SURFACE MAY AND MAY NOT CLAIM. It renders the stored quote VERBATIM
 * and attributes it as the user's own words, because that is exactly what the
 * producer stored it as. It does not paraphrase, does not summarise, and — the
 * load-bearing one — does not render at all when no quote is stored. A "you
 * said" line over an inferred constraint would be the fabrication class this
 * estate treats as its most serious defect, so the absent case is pinned as
 * hard as the present one.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

const QUOTE = 'we cannot let gross margin fall below 78%'
const CONSTRAINT_ID = 'c_margin_floor'
const OTHER_CONSTRAINT_ID = 'c_headcount_cap'

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { stripComments } from '../../../../../tests/helpers/stripSourceComments'
import {
  GoalConstraintProvenance,
  GOAL_CONSTRAINT_PROVENANCE_TESTID,
} from '../shared/GoalConstraintProvenance'

describe('B4 / N-20 · a constraint the user stated shows the user’s own words', () => {
  it('renders the stored quote VERBATIM, attributed to the user', () => {
    render(<GoalConstraintProvenance constraintId={CONSTRAINT_ID} sourceQuote={QUOTE} />)

    // Bound BY IDENTITY to this constraint's own provenance node — not by
    // searching the document for the quote text, which a second constraint
    // could also carry (trap 19).
    const node = screen.getByTestId(`goal-constraint-${CONSTRAINT_ID}-source-quote`)
    expect(node).toHaveTextContent('You said')
    // Verbatim: the exact stored string, not a paraphrase and not truncated.
    expect(node).toHaveTextContent(QUOTE)
  })

  it('renders NOTHING when no quote is stored — it never attributes words the user did not say', () => {
    // The opposite-direction twin, and the more important of the two. A
    // component that always rendered would put "You said …" over an
    // Olumi-inferred constraint, which is a fabrication of provenance.
    const { container } = render(
      <GoalConstraintProvenance constraintId={CONSTRAINT_ID} sourceQuote={undefined} />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId(`goal-constraint-${CONSTRAINT_ID}-source-quote`)).toBeNull()
  })

  it('renders nothing for a blank or whitespace-only quote', () => {
    // An empty string is not a statement. Rendering `You said: ""` asserts the
    // user said something while showing that they said nothing.
    for (const empty of ['', '   ', '\n']) {
      const { container, unmount } = render(
        <GoalConstraintProvenance constraintId={CONSTRAINT_ID} sourceQuote={empty} />,
      )
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
  })

  it('two constraints carry their OWN quotes, each addressed by its own id', () => {
    render(
      <div>
        <GoalConstraintProvenance constraintId={CONSTRAINT_ID} sourceQuote={QUOTE} />
        <GoalConstraintProvenance constraintId={OTHER_CONSTRAINT_ID} sourceQuote="keep the team under 40 people" />
      </div>,
    )
    expect(
      screen.getByTestId(`goal-constraint-${CONSTRAINT_ID}-source-quote`),
    ).toHaveTextContent(QUOTE)
    expect(
      screen.getByTestId(`goal-constraint-${OTHER_CONSTRAINT_ID}-source-quote`),
    ).toHaveTextContent('keep the team under 40 people')
    // Discriminating: each node holds its own quote and not the other's.
    expect(
      screen.getByTestId(`goal-constraint-${CONSTRAINT_ID}-source-quote`),
    ).not.toHaveTextContent('keep the team under 40 people')
  })
})

// ── The mount: the panel actually renders it ─────────────────────────────────

/**
 * ⚠ BOUND TO THE MOUNT PATH (trap 3b). A green component spec says nothing
 * about a component the panel does not render — this estate has shipped that
 * exact defect twice in one feature, both times with every component-level
 * assertion green.
 *
 * STATED PRECISELY, because this is a source scan and not a render: it proves
 * `GoalPanel` RENDERS the component in JSX (not merely imports it) and feeds it
 * the PERSISTED field. It does not prove the surrounding branch is reachable
 * for a given user — that is what the goal-constraint journey witness covers.
 * Deleting the call site, or rewiring it to a different field, goes RED here
 * while every assertion above stays green.
 */
describe('B4 / N-20 · the Goal panel MOUNTS the provenance line', () => {
  const panelSource = stripComments(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'panels', 'GoalPanel.tsx'), 'utf8'),
    'GoalPanel.tsx',
  )

  it('POSITIVE CONTROL: the scan is reading the real panel', () => {
    // A read that silently returned '' would satisfy no assertion below by
    // testing nothing. Anchor on something the panel indisputably contains.
    expect(panelSource.length).toBeGreaterThan(10_000)
    expect(panelSource).toContain('GoalPanel')
    expect(panelSource).toContain('add-constraint-button')
  })

  it('CONTRAST CONTROL: the scan discriminates — it does not report a symbol the panel lacks', () => {
    expect(panelSource).not.toContain('GoalConstraintProvenanceThatDoesNotExist')
  })

  it('the panel RENDERS the provenance component, fed from the persisted field', () => {
    /*
     * ⚠ A WORD BOUNDARY, NOT A SUBSTRING — this assertion was
     * `toContain('<GoalConstraintProvenance')` and a mutant that renamed the
     * element to `<GoalConstraintProvenanceUNMOUNTED` SURVIVED it, because the
     * original name is still a substring of the renamed one. A `toContain` on a
     * component name cannot tell a mount from a lookalike that renders nothing.
     */
    expect(panelSource).toMatch(/<GoalConstraintProvenance[\s/>]/)
    expect(panelSource).toContain('sourceQuote={c.source_quote}')
  })

  it('CONTRAST CONTROL: the boundary matcher REJECTS a renamed lookalike', () => {
    // Proves the fix above is discriminating rather than merely different.
    expect('<GoalConstraintProvenanceUNMOUNTED\n').not.toMatch(/<GoalConstraintProvenance[\s/>]/)
    expect('<GoalConstraintProvenance\n').toMatch(/<GoalConstraintProvenance[\s/>]/)
  })

  it('the testid the panel will emit is the one this spec asserts on', () => {
    // Derived from the component's own exported builder, so the spec cannot
    // drift from the surface about what it is looking for (trap 12).
    expect(GOAL_CONSTRAINT_PROVENANCE_TESTID(CONSTRAINT_ID)).toBe(
      `goal-constraint-${CONSTRAINT_ID}-source-quote`,
    )
  })
})
