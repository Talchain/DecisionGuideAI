/**
 * GroundedOnNotice — the rendered consumer of CEE's `_grounded_selection`.
 *
 * THREE PROPERTIES CARRY THIS SLICE, and each is pinned in a way that fails for
 * the right reason:
 *
 *  1. FABRICATION IS IMPOSSIBLE. A reply with no sidecar makes NO grounding
 *     claim. Pinned through the REAL `MessageBubble` (not the notice in
 *     isolation), because the mount condition is where a fabrication would be
 *     introduced.
 *  2. IDENTITY BINDING, proven by a DISCRIMINATING PAIR (CLAUDE.md trap 19).
 *     The notice names the element the ANSWER WAS GROUNDED ON — asserted via
 *     `data-element-id`, the canonical id, never via label text another element
 *     could carry. A single biting mutant proves sensitivity to *something*;
 *     only the RED/GREEN pair proves sensitivity to the NAMED object.
 *  3. `not_in_model` AND `could_not_check` DO NOT COLLAPSE — the producer's
 *     explicit ruling (grounded-selection.ts:71-79). Pinned as a DIFFERENCE
 *     between the two rendered sentences AND as a ban on absence language in
 *     the `could_not_check` copy, so a future copy edit that quietly makes them
 *     synonymous REDs.
 *
 * MOUNT (trap 3b — this estate has shipped the same badge dark twice by testing
 * a component the deployed flags do not mount): every assertion below drives
 * `MessageBubble`, the post-#736 render authority for an assistant turn, and
 * NOTHING here sets a flag — because the producer emits unconditionally and
 * this consumer is deliberately unflagged. A test that rendered
 * `GroundedOnNotice` directly would pass identically if the mount were deleted.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import { useCanvasStore } from '../../store'
import { resolveGroundedLabels } from '../GroundedOnNotice'
import type { ConversationMessage } from '../types'
import type { GroundedSelection } from '../groundedSelection'

const noop = async () => {}

/** Canonical ids — non-guessable tokens, so any match is an identity match. */
const SALARY_ID = 'node-engineer-salary-7c1f'
const CONTRACTOR_ID = 'node-hire-contractor-93ab'
const ABSENT_ID = 'node-deleted-since-0000'
const EDGE_ID = 'edge-salary-to-margin-5d2e'
const MARGIN_ID = 'node-gross-margin-4f88'

const SALARY_LABEL = 'Engineer salary'
const CONTRACTOR_LABEL = 'Hire a contractor'
const MARGIN_LABEL = 'Gross margin'

/** Seed the canvas the label join reads. Two nodes so "a different element" exists. */
function seedCanvas() {
  useCanvasStore.setState({
    nodes: [
      { id: SALARY_ID, position: { x: 0, y: 0 }, data: { label: SALARY_LABEL } },
      { id: CONTRACTOR_ID, position: { x: 0, y: 0 }, data: { label: CONTRACTOR_LABEL } },
      { id: MARGIN_ID, position: { x: 0, y: 0 }, data: { label: MARGIN_LABEL } },
    ] as never,
    edges: [{ id: EDGE_ID, source: SALARY_ID, target: MARGIN_ID }] as never,
  })
}

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'Engineer salary is the biggest cost driver in this model.',
    timestamp: new Date(),
    ...overrides,
  }
}

const groundedOnSalary: GroundedSelection = {
  element_ids: [SALARY_ID],
  unresolved: 'none',
}

beforeEach(() => {
  seedCanvas()
})

describe('GroundedOnNotice — ⭐ fabrication guard (no sidecar ⇒ no claim)', () => {
  it('a reply with NO groundedSelection renders NO grounding notice at all', () => {
    render(<MessageBubble message={makeMsg()} onChipClick={noop} />)
    expect(screen.queryByTestId('grounded-on-notice')).toBeNull()
    expect(screen.queryByTestId('grounded-on-elements')).toBeNull()
    expect(screen.queryByTestId('grounded-on-unresolved')).toBeNull()
  })

  it('the ungrounded reply names NO canvas element anywhere in the bubble', () => {
    // The strong form: not merely "the testid is absent", but that the element's
    // label never reaches the DOM. A notice rendered under a different testid
    // would still be a fabrication and must still fail.
    render(<MessageBubble message={makeMsg()} onChipClick={noop} />)
    expect(screen.queryByText(SALARY_LABEL)).toBeNull()
  })

  it('a USER message never carries a grounding notice, even with a sidecar attached', () => {
    // A grounding is a fact about an ANSWER. The user's own bubble is not one.
    render(
      <MessageBubble
        message={makeMsg({ role: 'user', groundedSelection: groundedOnSalary })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('grounded-on-notice')).toBeNull()
  })
})

describe('GroundedOnNotice — ⭐ identity binding (the DISCRIMINATING PAIR, trap 19)', () => {
  it('names the element the answer WAS grounded on, by canonical id', () => {
    render(
      <MessageBubble
        message={makeMsg({ groundedSelection: groundedOnSalary })}
        onChipClick={noop}
      />,
    )
    const named = screen.getAllByTestId('grounded-on-element')
    expect(named).toHaveLength(1)
    expect(named[0].getAttribute('data-element-id')).toBe(SALARY_ID)
    expect(named[0].textContent).toContain(SALARY_LABEL)
  })

  it('does NOT name a DIFFERENT element that exists on the same canvas', () => {
    // The other half of the pair. A fixed-id implementation, or one that named
    // every node, passes the test above and FAILS here.
    render(
      <MessageBubble
        message={makeMsg({ groundedSelection: groundedOnSalary })}
        onChipClick={noop}
      />,
    )
    const ids = screen
      .getAllByTestId('grounded-on-element')
      .map((el) => el.getAttribute('data-element-id'))
    expect(ids).not.toContain(CONTRACTOR_ID)
    expect(screen.queryByText(CONTRACTOR_LABEL)).toBeNull()
  })

  it('a DIFFERENT grounded id names the OTHER element — the notice tracks the payload', () => {
    render(
      <MessageBubble
        message={makeMsg({
          groundedSelection: { element_ids: [CONTRACTOR_ID], unresolved: 'none' },
        })}
        onChipClick={noop}
      />,
    )
    const named = screen.getAllByTestId('grounded-on-element')
    expect(named).toHaveLength(1)
    expect(named[0].getAttribute('data-element-id')).toBe(CONTRACTOR_ID)
    // ⭐ The discrimination: the two payloads must not render the same thing.
    expect(named[0].getAttribute('data-element-id')).not.toBe(SALARY_ID)
  })

  it('names MULTIPLE grounded elements in the order received (persisted-graph order)', () => {
    render(
      <MessageBubble
        message={makeMsg({
          groundedSelection: { element_ids: [CONTRACTOR_ID, SALARY_ID], unresolved: 'none' },
        })}
        onChipClick={noop}
      />,
    )
    expect(
      screen.getAllByTestId('grounded-on-element').map((el) => el.getAttribute('data-element-id')),
    ).toEqual([CONTRACTOR_ID, SALARY_ID])
  })
})

describe('GroundedOnNotice — ⭐⭐ not_in_model and could_not_check MUST NOT COLLAPSE', () => {
  function renderWith(unresolved: GroundedSelection['unresolved'], element_ids: string[] = []) {
    const { unmount } = render(
      <MessageBubble
        message={makeMsg({ groundedSelection: { element_ids, unresolved } })}
        onChipClick={noop}
      />,
    )
    const text = screen.getByTestId('grounded-on-unresolved').textContent ?? ''
    unmount()
    return text
  }

  it('renders DIFFERENT sentences for the two states', () => {
    const notInModel = renderWith('not_in_model')
    const couldNotCheck = renderWith('could_not_check')
    expect(notInModel.length).toBeGreaterThan(0)
    expect(couldNotCheck.length).toBeGreaterThan(0)
    expect(notInModel).not.toBe(couldNotCheck)
  })

  it('`not_in_model` asserts the absence — the graph WAS read', () => {
    expect(renderWith('not_in_model').toLowerCase()).toContain("isn't in this model")
  })

  it('⭐ `could_not_check` claims NOTHING about presence — it says only that it could not look', () => {
    // The producer's words: "a consumer that renders that as 'not found'
    // reintroduces the conflation hop 3 and hop 4 spent their whole design
    // keeping apart". This is the ban, not just a difference check: any copy
    // edit that reintroduces absence language here REDs.
    const text = renderWith('could_not_check').toLowerCase()
    expect(text).toContain("couldn't read your model")
    for (const banned of ["isn't in", 'not in this model', 'not found', 'does not exist']) {
      expect(text, `could_not_check must not claim absence (found "${banned}")`).not.toContain(
        banned,
      )
    }
  })

  it('surfaces the state machine-readably, undegraded, for each member', () => {
    for (const member of ['none', 'not_in_model', 'could_not_check'] as const) {
      const { unmount } = render(
        <MessageBubble
          message={makeMsg({ groundedSelection: { element_ids: [SALARY_ID], unresolved: member } })}
          onChipClick={noop}
        />,
      )
      expect(screen.getByTestId('grounded-on-notice').getAttribute('data-unresolved')).toBe(member)
      unmount()
    }
  })

  it('`none` discloses nothing — there is nothing missing to report', () => {
    render(
      <MessageBubble
        message={makeMsg({ groundedSelection: groundedOnSalary })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('grounded-on-unresolved')).toBeNull()
  })
})

describe('GroundedOnNotice — the empty-and-honest producer states', () => {
  it('empty ids + not_in_model → the disclosure alone, and NO grounding claim', () => {
    render(
      <MessageBubble
        message={makeMsg({ groundedSelection: { element_ids: [], unresolved: 'not_in_model' } })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('grounded-on-unresolved')).toBeTruthy()
    expect(screen.queryByTestId('grounded-on-elements')).toBeNull()
  })

  it('empty ids + none → nothing renders at all (silence is the honest output)', () => {
    render(
      <MessageBubble
        message={makeMsg({ groundedSelection: { element_ids: [], unresolved: 'none' } })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('grounded-on-notice')).toBeNull()
  })

  it('an id this canvas cannot name is DROPPED, never rendered as a raw id', () => {
    render(
      <MessageBubble
        message={makeMsg({ groundedSelection: { element_ids: [ABSENT_ID], unresolved: 'none' } })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('grounded-on-notice')).toBeNull()
    expect(screen.queryByText(ABSENT_ID)).toBeNull()
  })

  it('a partial join names what it can and states NO count', () => {
    render(
      <MessageBubble
        message={makeMsg({
          groundedSelection: { element_ids: [SALARY_ID, ABSENT_ID], unresolved: 'none' },
        })}
        onChipClick={noop}
      />,
    )
    const named = screen.getAllByTestId('grounded-on-element')
    expect(named).toHaveLength(1)
    expect(named[0].getAttribute('data-element-id')).toBe(SALARY_ID)
    // No quantity claim anywhere in the notice — a count would be false here.
    expect(screen.getByTestId('grounded-on-notice').textContent).not.toMatch(/\b2\b|\btwo\b/i)
  })
})

describe('resolveGroundedLabels — the id-first, fail-closed join', () => {
  // Naming is DELEGATED to `resolveElementLabel`, the repo's existing authority
  // (see the component docstring). These cases pin the id-binding and the
  // fail-closed dropping, which is the part this module owns.
  const nodes = [
    { id: SALARY_ID, data: { label: SALARY_LABEL } },
    { id: MARGIN_ID, data: { label: MARGIN_LABEL } },
  ] as never
  const edges = [{ id: EDGE_ID, source: SALARY_ID, target: MARGIN_ID }] as never

  it('joins a node id to its label, keyed on id', () => {
    expect(resolveGroundedLabels([SALARY_ID], nodes, edges)).toEqual([
      { id: SALARY_ID, label: SALARY_LABEL },
    ])
  })

  it('names an edge from its endpoints, via the delegated label authority', () => {
    // The composed form is `resolveElementLabel`'s, NOT a second convention
    // invented here. ⚠ Note it uses an ASCII arrow while `useSelectionContext`
    // (the SelectionPill the user clicked) uses `→` — a PRE-EXISTING divergence
    // in the estate, reported rather than silently taken a side on. Pinned here
    // so the notice cannot drift from whichever authority owns the name.
    const named = resolveGroundedLabels([EDGE_ID], nodes, edges)
    expect(named).toHaveLength(1)
    expect(named[0].id).toBe(EDGE_ID)
    expect(named[0].label).toContain(SALARY_LABEL)
    expect(named[0].label).toContain(MARGIN_LABEL)
  })

  it('drops an unknown id rather than fabricating a label', () => {
    expect(resolveGroundedLabels([ABSENT_ID], nodes, edges)).toEqual([])
  })

  it('drops a node with no usable label rather than echoing its id at the user', () => {
    expect(
      resolveGroundedLabels(['n-blank'], [{ id: 'n-blank', data: { label: '  ' } }] as never, []),
    ).toEqual([])
    expect(resolveGroundedLabels(['n-none'], [{ id: 'n-none' }] as never, [])).toEqual([])
  })

  it('preserves input order and does not sort', () => {
    expect(resolveGroundedLabels([MARGIN_ID, SALARY_ID], nodes, edges).map((e) => e.id)).toEqual([
      MARGIN_ID,
      SALARY_ID,
    ])
  })
})
