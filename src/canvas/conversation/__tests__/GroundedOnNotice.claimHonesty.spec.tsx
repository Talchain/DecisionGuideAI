/**
 * THE GROUNDING NOTICE MAY NOT CLAIM THE ANSWER USED WHAT THE USER SELECTED.
 *
 * ── THE WITNESS THIS FILE REPRODUCES ──────────────────────────────────────
 * Fresh-guest witness on deployed staging (CEE `18b84b0`, UI `6e58c921`,
 * 1 Sep 2026): a user asked about **co-founder equity** and Olumi footered the
 * answer *"Answered using Warm Connection Density"* — a node the answer never
 * drew on. It was the node they had most recently selected, and it persisted
 * across turns.
 *
 * ── WHY IT WAS FALSE BY CONSTRUCTION, NOT BY ACCIDENT ─────────────────────
 * `_grounded_selection.element_ids` is the user's CANVAS SELECTION on every
 * path there is — CEE's `projectGroundedSelection` reads `selection.elements`,
 * the UI attaches `selected_elements` from the live store on EVERY send, and
 * nothing clears the selection when a turn is sent. Nothing on either side
 * reads the model's output, so no usage claim can be licensed. Two questions
 * under one name (CLAUDE.md trap 21): "what did the user select?" is not
 * "what did this answer draw on?".
 *
 * ── WHAT THESE TESTS BIND TO, AND WHY THEY CANNOT PASS VACUOUSLY ──────────
 * Every case asserts BOTH halves together (CLAUDE.md trap 13 — an absence
 * assertion needs to prove it can see a presence):
 *   · POSITIVE — the selected element IS still named, bound by its CANONICAL
 *     ID via `data-element-id`, never by label text another node could carry
 *     (trap 19). Deleting the notice outright therefore REDs these tests; it
 *     does not silently satisfy them.
 *   · ABSENCE  — the sentence carries NO usage verb.
 * A test that only banned the phrase would go green the moment someone deleted
 * the block, which is a different change with different consequences.
 *
 * MOUNT (trap 3b): every case drives the REAL `MessageBubble`, the render
 * authority for an assistant turn, exactly as the sibling spec does. Nothing
 * here sets a flag — the producer emits unconditionally and this consumer is
 * deliberately unflagged.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import { useCanvasStore } from '../../store'
import type { ConversationMessage } from '../types'
import type { GroundedSelection } from '../groundedSelection'

const noop = async () => {}

/**
 * Canonical ids — non-guessable tokens, so any match is an identity match and
 * never a coincidence of labelling.
 */
const WARM_ID = 'node-warm-connection-density-a41c'
const EQUITY_ID = 'node-cofounder-equity-split-8b73'

const WARM_LABEL = 'Warm connection density'
const EQUITY_LABEL = 'Co-founder equity split'

/**
 * THE USAGE VERBS, AS DATA. The load-bearing member is `answered using` — the
 * exact string that shipped. The rest are the same claim in other clothes, so a
 * later "rewording" cannot reintroduce the defect under a synonym.
 */
const USAGE_CLAIMS = [
  'answered using',
  'answer used',
  'based on',
  'drew on',
  'draws on',
  'grounded on',
  'grounded in',
  'produced using',
  'derived from',
] as const

/** The answer the user actually received — about equity, not about the selection. */
const EQUITY_ANSWER =
  'A common starting point for co-founder equity is an equal split, revisited against ' +
  'each founder’s commitment and the risk they are carrying.'

function seedCanvas() {
  useCanvasStore.setState({
    nodes: [
      { id: WARM_ID, position: { x: 0, y: 0 }, data: { label: WARM_LABEL } },
      { id: EQUITY_ID, position: { x: 0, y: 0 }, data: { label: EQUITY_LABEL } },
    ] as never,
    edges: [] as never,
  })
}

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-equity-1',
    role: 'assistant',
    content: EQUITY_ANSWER,
    timestamp: new Date(),
    ...overrides,
  }
}

function renderGrounded(groundedSelection: GroundedSelection) {
  render(<MessageBubble message={makeMsg({ groundedSelection })} onChipClick={noop} />)
  return screen.getByTestId('grounded-on-notice')
}

beforeEach(() => {
  seedCanvas()
})

describe('grounding notice — ⭐⭐ the witnessed false provenance claim', () => {
  it('THE WITNESS: an equity answer carrying a Warm-connection-density selection makes NO usage claim', () => {
    const notice = renderGrounded({ element_ids: [WARM_ID], unresolved: 'none' })

    // POSITIVE HALF — the element is still named, bound by canonical id. Without
    // this, deleting the notice would satisfy the ban below by rendering nothing.
    const named = screen.getAllByTestId('grounded-on-element')
    expect(named).toHaveLength(1)
    expect(named[0].getAttribute('data-element-id')).toBe(WARM_ID)

    // ABSENCE HALF — and `answered using` is the exact string that shipped.
    const text = (notice.textContent ?? '').toLowerCase()
    expect(text.length).toBeGreaterThan(0)
    for (const claim of USAGE_CLAIMS) {
      expect(
        text,
        `the notice must not claim the answer USED the selection (found "${claim}")`,
      ).not.toContain(claim)
    }
  })

  it('states the fact it can actually license: that the user had the element SELECTED', () => {
    const notice = renderGrounded({ element_ids: [WARM_ID], unresolved: 'none' })
    const text = (notice.textContent ?? '').toLowerCase()

    expect(text).toContain('selected')
    // Bound to THIS element by id, and the label is what the sentence names.
    const named = screen.getAllByTestId('grounded-on-element')
    expect(named[0].getAttribute('data-element-id')).toBe(WARM_ID)
    expect(named[0].textContent).toContain(WARM_LABEL)
  })

  it('DISCRIMINATING PAIR: a DIFFERENT selected element is the one named, and the other is not', () => {
    // Same answer text, same canvas — only the payload differs. An implementation
    // that named "some node", or a fixed one, passes the case above and FAILS here.
    const notice = renderGrounded({ element_ids: [EQUITY_ID], unresolved: 'none' })

    const ids = screen
      .getAllByTestId('grounded-on-element')
      .map((el) => el.getAttribute('data-element-id'))
    expect(ids).toEqual([EQUITY_ID])
    expect(ids).not.toContain(WARM_ID)
    expect(screen.queryByText(WARM_LABEL)).toBeNull()

    // The claim ban holds for this element too — it is a property of the
    // sentence, not of one fixture.
    const text = (notice.textContent ?? '').toLowerCase()
    for (const claim of USAGE_CLAIMS) {
      expect(text, `usage claim "${claim}" leaked on the second payload`).not.toContain(claim)
    }
  })

  it('the ban holds across EVERY unresolved state — the whole domain, not the witnessed path', () => {
    // A provenance line's truth condition is a claim about the whole domain, so
    // the ban is asserted on all three members rather than on the one witnessed.
    for (const unresolved of ['none', 'not_in_model', 'could_not_check'] as const) {
      const { unmount } = render(
        <MessageBubble
          message={makeMsg({ groundedSelection: { element_ids: [WARM_ID], unresolved } })}
          onChipClick={noop}
        />,
      )
      const notice = screen.getByTestId('grounded-on-notice')
      const text = (notice.textContent ?? '').toLowerCase()

      // Positive control per member: the element is named here too, so a state
      // that rendered nothing could not pass the ban by silence.
      expect(
        screen.getAllByTestId('grounded-on-element')[0].getAttribute('data-element-id'),
        `element not named for unresolved="${unresolved}"`,
      ).toBe(WARM_ID)
      for (const claim of USAGE_CLAIMS) {
        expect(text, `usage claim "${claim}" leaked on unresolved="${unresolved}"`).not.toContain(
          claim,
        )
      }
      unmount()
    }
  })

  it('multiple selected elements are all named, and still without a usage claim', () => {
    const notice = renderGrounded({
      element_ids: [WARM_ID, EQUITY_ID],
      unresolved: 'none',
    })

    expect(
      screen.getAllByTestId('grounded-on-element').map((el) => el.getAttribute('data-element-id')),
    ).toEqual([WARM_ID, EQUITY_ID])

    const text = (notice.textContent ?? '').toLowerCase()
    for (const claim of USAGE_CLAIMS) {
      expect(text, `usage claim "${claim}" leaked on a multi-element notice`).not.toContain(claim)
    }
  })
})
