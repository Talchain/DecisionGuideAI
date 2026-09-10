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
    expect(screen.getByTestId(EXPLAIN)).toHaveAttribute('aria-label', 'Explain in more detail')
    expect(screen.getByTestId(SUMMARISE)).toHaveAttribute('aria-label', 'Summarise this response')
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
