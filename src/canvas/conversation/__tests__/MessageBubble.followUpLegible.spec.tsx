/**
 * The two follow-up actions say what they do, on screen.
 *
 * ## ⚠ A CORRECTED PREMISE, NOT A BUG REPORT — AND THE DISTINCTION MATTERS
 *
 * These controls were reported as "two unlabelled icon buttons with no text and
 * no obvious affordance", with a warning to check for the estate's
 * `onDoubleClick` defect (where Enter and Space dispatch `click` and never
 * `dblclick`, so a control has no keyboard route at all).
 *
 * Checked at the source. THREE PARTS OF THAT ARE ALREADY FALSE, and this file
 * pins them so nobody re-derives the same wrong premise later:
 *
 *   · both buttons carry an `aria-label` AND a `title`, so they are NOT
 *     unlabelled to assistive technology;
 *   · both are native `<button>` with `onClick`, so both are keyboard-operable,
 *     and NEITHER uses `onDoubleClick` anywhere;
 *   · both reach a live handler — `onArtefactMessage` → `sendMessage` — so
 *     neither is a dead affordance.
 *
 * Those properties are pinned in `MessageBubble.actions.spec.tsx` and are
 * asserted again below as the PRECONDITION of this file, because a change that
 * added a visible label while silently dropping the accessible one would be a
 * regression wearing an improvement's clothes.
 *
 * ## What was genuinely missing
 *
 * VISIBLE meaning. The buttons render icon-only, and neither glyph reads as its
 * action: `ListPlus` for "explain in more detail" and `AlignLeft` for
 * "summarise" are conventions nobody arrives already knowing. A sighted user
 * who has not hovered has no way to tell what either does — which is the report
 * that was correct.
 *
 * So each button gains a visible text label beside its icon. The accessible
 * name is unchanged.
 *
 * ## ⚠⚠ AND THE PROPERTY THIS FILE ORIGINALLY FAILED TO GUARD
 *
 * The first draft asserted the two halves INDEPENDENTLY — the `aria-label`
 * attribute in one arm, the visible `textContent` in another — and never
 * compared them. So it pinned a WCAG 2.1 SC 2.5.3 (Label in Name, Level A)
 * failure in place while staying green: the Explain button read "Explain more"
 * and was NAMED "Explain in more detail", a name that does not contain its own
 * visible text. An independent review caught it; this file did not.
 *
 * Asserting an attribute is a different claim from asserting the COMPUTED
 * accessible name, which is what assistive technology actually resolves — and
 * `aria-label` outranks contents, so the two can disagree silently. Every name
 * assertion below now goes through `getByRole('button', { name })`, which
 * computes the name the same way AT does, and the containment property is
 * asserted MECHANICALLY from the DOM rather than restated per button — so it
 * also catches the next label edit.
 *
 * ## And the icon size
 *
 * `panelIcons.ts` gives standalone controls `ICON_STANDALONE = 16` at
 * `ICON_STROKE = 2`, and records that the panel had shipped seven sizes written
 * five ways. These two were `w-3.5 h-3.5` — 14px, as a raw Tailwind class
 * rather than the constant — while `FeedbackRow`, the row immediately beneath
 * them that this one was explicitly built to match in weight, already uses both
 * constants. Two adjacent rows of icon buttons at different sizes is the drift
 * `panelIcons.ts` exists to end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

import { MessageBubble } from '../MessageBubble'
import { ICON_STANDALONE } from '../panelIcons'
import type { ConversationMessage } from '../types'

beforeEach(() => {
  try { window.localStorage.setItem('feature.aiPanelV2', 'true') } catch { /* jsdom */ }
})

/** Same shape MessageBubble.actions.spec.tsx uses, so the two agree. */
const assistantMessage: ConversationMessage = {
  id: 'turn-1',
  role: 'assistant',
  content: 'Here is a first model for the decision you described.',
  clientTurnId: 'client-turn-1',
} as ConversationMessage

const renderBubble = () =>
  render(
    <MessageBubble
      message={assistantMessage}
      onChipClick={vi.fn(async () => {})}
      patchBlockStates={new Map()}
      onArtefactMessage={vi.fn()}
    />,
  )

const EXPLAIN = 'message-action-explain-more'
const SUMMARISE = 'message-action-summarise'

describe('precondition — the properties the report got wrong are already true', () => {
  /**
   * ⚠ ASSERTED FIRST, AND DELIBERATELY. Every claim below about a NEW visible
   * label is only an improvement if the EXISTING accessible name survives it.
   * If a later edit swaps the aria-label for the visible text, this arm reds.
   */
  it('both buttons already have accessible names, and keep them', () => {
    renderBubble()
    // Bound to the COMPUTED name via getByRole — an `aria-label` attribute
    // assertion would pass on a name no AT ever resolves this way.
    expect(screen.getByRole('button', { name: 'Explain more about this response' }))
      .toBe(screen.getByTestId(EXPLAIN))
    expect(screen.getByRole('button', { name: 'Summarise this response' }))
      .toBe(screen.getByTestId(SUMMARISE))
  })

  it('both are native buttons — so both have a keyboard route already', () => {
    renderBubble()
    // The estate's `onDoubleClick` defect cannot exist on a native button with
    // onClick: Enter and Space dispatch click. Pinned as the element, because
    // that IS the property.
    expect(screen.getByTestId(EXPLAIN).tagName).toBe('BUTTON')
    expect(screen.getByTestId(SUMMARISE).tagName).toBe('BUTTON')
    expect(screen.getByTestId(EXPLAIN)).toHaveAttribute('type', 'button')
    expect(screen.getByTestId(SUMMARISE)).toHaveAttribute('type', 'button')
  })
})

describe('the buttons say what they do, on screen', () => {
  /**
   * ⭐ THE DEFECT THIS FILE EXISTS FOR. Asserted on `textContent` rather than a
   * `getByText` lookup, so it is specifically THIS button that carries the
   * word — a label rendered anywhere else on the turn would satisfy a loose
   * query and leave the button as opaque as it was.
   */
  it('the explain button carries visible text, not only a glyph', () => {
    renderBubble()
    expect(screen.getByTestId(EXPLAIN).textContent?.trim()).toBe('Explain more')
  })

  it('the summarise button carries visible text, not only a glyph', () => {
    renderBubble()
    expect(screen.getByTestId(SUMMARISE).textContent?.trim()).toBe('Summarise')
  })

  /**
   * ⚠ THE MATCHER'S OWN CONTROL. Both assertions above would pass on a button
   * whose text came from an `sr-only` span — invisible to exactly the user who
   * reported the problem. `innerText` is not implemented in jsdom, so this
   * checks the property that actually distinguishes them: the label must not be
   * inside a visually-hidden element.
   */
  it('the label is VISIBLE text, never an sr-only span', () => {
    renderBubble()
    for (const id of [EXPLAIN, SUMMARISE]) {
      const btn = screen.getByTestId(id)
      expect(btn.querySelector('.sr-only'), `${id} hides its label from sight`).toBeNull()
      const labelEl = [...btn.children].find((c) => (c.textContent ?? '').trim().length > 0)
      expect(labelEl, `${id} renders no text element at all`).toBeTruthy()
      expect(labelEl).toBeVisible()
    }
  })
})

describe('WCAG 2.1 SC 2.5.3 — the accessible name contains the visible label', () => {
  /**
   * ⭐⭐ THE ARM THE FIRST DRAFT WAS MISSING, and the one that reds on the
   * defect review found. Derived from the DOM rather than restated per button:
   * take each button's own visible text, then require the control to still be
   * findable BY ROLE under a name containing it. `getByRole` computes the
   * accessible name with the same algorithm assistive technology uses, so a
   * name that does not contain the visible label simply does not match and the
   * query throws.
   *
   * The harm this pins is concrete, not a conformance technicality: a
   * speech-input user says "click Explain more", the matcher resolves against
   * the ACCESSIBLE NAME, and the command misses a control they can see.
   *
   * ⚠ It is written over EVERY button in the row, so a third action added later
   * is covered without anyone remembering to extend this file.
   */
  it('every follow-up button is reachable by its own visible text', () => {
    renderBubble()
    const row = screen.getByTestId('message-follow-up-actions')
    const buttons = [...row.querySelectorAll('button')]
    // Floor: an empty row would satisfy every assertion in the loop vacuously.
    expect(buttons.length, 'the follow-up row rendered no buttons').toBe(2)

    for (const btn of buttons) {
      // The glyphs are aria-hidden <svg> and contribute no text, so the
      // button's own textContent IS its visible label.
      const visible = (btn.textContent ?? '').trim()
      expect(visible.length, 'a button with no visible text cannot be checked').toBeGreaterThan(0)

      const escaped = visible.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const byName = screen.getByRole('button', { name: new RegExp(escaped, 'i') })
      expect(
        byName,
        `"${visible}" is not contained in this button's accessible name — ` +
          'a speech-input user saying it would miss the control (SC 2.5.3)',
      ).toBe(btn)
    }
  })

  /**
   * ⚠ NO `title` ON EITHER BUTTON. With `aria-label` supplying the name, a
   * `title` is not a fallback tooltip — it becomes the accessible DESCRIPTION,
   * announced after the name at common NVDA/JAWS verbosity, so the visible
   * label got read back at the user. `FeedbackRow`, the row this one matches in
   * weight, carries none for the same reason.
   */
  it('neither button carries a title that would double as a description', () => {
    renderBubble()
    for (const id of [EXPLAIN, SUMMARISE]) {
      expect(screen.getByTestId(id)).not.toHaveAttribute('title')
    }
  })
})

describe('the icons are on the panel scale', () => {
  /**
   * `panelIcons.ts` is the estate's authority; `FeedbackRow` — the row directly
   * beneath these two, which they were built to match in weight — already uses
   * `ICON_STANDALONE`. Bound to the CONSTANT rather than to the number 16, so a
   * deliberate rescale of the whole panel moves this with it instead of
   * stranding one row behind a hard-coded literal.
   */
  it('both glyphs render at the standalone-control size', () => {
    renderBubble()
    for (const id of [EXPLAIN, SUMMARISE]) {
      const svg = screen.getByTestId(id).querySelector('svg')
      expect(svg, `${id} renders no icon`).not.toBeNull()
      expect(svg).toHaveAttribute('width', String(ICON_STANDALONE))
      expect(svg).toHaveAttribute('height', String(ICON_STANDALONE))
    }
  })

  it('the glyphs stay decorative — the button’s name is its label, not its icon', () => {
    renderBubble()
    for (const id of [EXPLAIN, SUMMARISE]) {
      expect(screen.getByTestId(id).querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })
})
