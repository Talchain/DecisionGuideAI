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
 * nothing clears the selection when a turn is sent.
 *
 * ⚠ THE SENTENCE THAT FOLLOWED WAS A FALSE ABSENCE CLAIM — corrected 1 Sep 2026
 * on review. It read *"Nothing on either side reads the model's output, so no
 * usage claim can be licensed"*. CEE compares answer text against an element
 * label today (`answerContainsLabel`, `validation-priority.ts:182`, reachable
 * via `decideValidationBeat` ← `explain-results.ts:183`); that comparison feeds
 * a coaching-beat dedup decision and never reaches `_grounded_selection`. The
 * narrow truth this file actually pins: no usage evidence is carried on THIS
 * path, so no usage claim can be licensed HERE. See `GroundedOnNotice.tsx` for
 * the full derivation. Two questions under one name (CLAUDE.md trap 21): "what
 * did the user select?" is not "what did this answer draw on?".
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

function renderBubble(groundedSelection: GroundedSelection) {
  return render(<MessageBubble message={makeMsg({ groundedSelection })} onChipClick={noop} />)
}

beforeEach(() => {
  seedCanvas()
})

describe('grounding notice — ⭐⭐ the witnessed false provenance claim', () => {
  // AI-first subtract (DL, 12 Oct; friction N4): the elements line ("You had {x} selected when you asked.") is REMOVED.
  // The rows that pinned it ("states … SELECTED", the named discriminating pair, "multiple … all named") went with it.
  // What stays is the ban: no usage claim, on any state, and now no naming of the selection at all.
  it('THE WITNESS: an equity answer carrying a Warm-connection-density selection makes NO usage claim and names no element', () => {
    const { container } = renderBubble({ element_ids: [WARM_ID], unresolved: 'none' })
    // Positive control: the answer itself rendered, so the absence below is not an empty bubble.
    expect(container.textContent).toContain('co-founder equity')
    expect(screen.queryByTestId('grounded-on-notice')).toBeNull()
    const text = (container.textContent ?? '').toLowerCase()
    expect(text).not.toContain('you had')
    expect(text).not.toContain(WARM_LABEL.toLowerCase())
    for (const claim of USAGE_CLAIMS) {
      expect(text, `the bubble must not claim the answer USED the selection (found "${claim}")`).not.toContain(claim)
    }
  })

  it('the ban holds across EVERY unresolved state — the whole domain, not the witnessed path', () => {
    for (const unresolved of ['none', 'not_in_model', 'could_not_check'] as const) {
      const { container, unmount } = renderBubble({ element_ids: [WARM_ID], unresolved })
      const text = (container.textContent ?? '').toLowerCase()
      // Positive control per member: the two unresolved states still disclose, so silence cannot pass the ban.
      if (unresolved === 'none') expect(screen.queryByTestId('grounded-on-notice')).toBeNull()
      else expect(screen.getByTestId('grounded-on-unresolved').textContent).toMatch(/selected/)
      expect(text, `selection named on unresolved="${unresolved}"`).not.toContain(WARM_LABEL.toLowerCase())
      for (const claim of USAGE_CLAIMS) {
        expect(text, `usage claim "${claim}" leaked on unresolved="${unresolved}"`).not.toContain(claim)
      }
      unmount()
    }
  })
})
