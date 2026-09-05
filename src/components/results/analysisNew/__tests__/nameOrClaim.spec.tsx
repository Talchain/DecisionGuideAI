/**
 * ⭐⭐ A NAME AND A CLAIM ARE DIFFERENT THINGS — design pick C2.
 *
 * The producer routinely returns the brief's own prose as a factor `label`,
 * and every surface then cuts it MID-WORD with the remainder reachable only
 * through `title`. `title` is hover-only: there is no hover on touch and no
 * major browser surfaces it on keyboard focus, so on a phone the rest of the
 * sentence is not hidden — it is unreachable. That is why the approved design
 * rejected "truncate + hover" (C1) and chose "truncate + expand" (C2).
 *
 * ⛔ THE RULE THESE EXIST TO HOLD: the UI truncates and discloses, and NEVER
 * rewrites. Shortening prose into a name is a judgement about the model, and a
 * render layer that guesses it will eventually put a sentence on screen that
 * the model does not support.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DriverInfluenceChart } from '../sections/DriverInfluenceChart'
import type { DriverInfluenceRow } from '../analysisNewTypes'
import {
  DISPLAY_CHAR_CUT,
  NAME_CHAR_BUDGET,
  isProseNotName,
  needsClaimDisclosure,
  truncateAtWord,
} from '../nameOrClaim'

vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    proposeFactorValue: vi.fn(() => 'dispatched'),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

const TID = 'chart'
afterEach(() => cleanup())

/** The real string, from Paul's 3 Sep run — 181 characters of brief prose. */
const CLAIM =
  "We've heard from three churned customers that they left because of missing " +
  'integrations, not price — so we think product gaps mediate the relationship ' +
  'between customer satisfaction and churn'

const row = (over: Partial<DriverInfluenceRow>): DriverInfluenceRow => ({
  id: 'f1',
  label: 'Factor one',
  fraction: 0.8,
  direction: 'positive',
  targetId: 'f1',
  ...over,
})

const byId = (id: string) =>
  screen.getAllByTestId(`${TID}-row`).find((el) => el.getAttribute('data-node-id') === id)!

const draw = (rows: DriverInfluenceRow[]) =>
  render(<DriverInfluenceChart rows={rows} onCommitOutcome={vi.fn()} testId={TID} />)

describe('truncateAtWord — cuts at a word, never invents one', () => {
  it('never cuts mid-word', () => {
    const out = truncateAtWord(CLAIM)
    const body = out.replace(/…$/, '')
    // ⚠ THE PROPERTY, not a fixed expected string: every word in the output
    // must be a whole word of the input. A character-budget cut fails this.
    const words = body.trim().split(/\s+/)
    const source = CLAIM.split(/\s+/)
    for (const w of words) expect(source).toContain(w)
    expect(out.endsWith('…')).toBe(true)
    expect(body.length).toBeLessThanOrEqual(DISPLAY_CHAR_CUT)
  })

  it('returns a short name completely unchanged — no ellipsis, no cut', () => {
    expect(truncateAtWord('Time Pressure')).toBe('Time Pressure')
  })

  it('returns an uncuttable single token unchanged rather than a mid-word fragment', () => {
    // No space to cut at. Returning `t.slice(0, budget)` here would reintroduce
    // exactly the defect this module exists to remove.
    const token = 'a'.repeat(DISPLAY_CHAR_CUT + 20)
    expect(truncateAtWord(token)).toBe(token)
  })

  /**
   * ⚠ THIS TEST USED TO BE INCAPABLE OF FAILING, and a reviewer proved it:
   * deleting the `.replace()` that strips the dangling punctuation left the
   * whole spec 12/12 GREEN. The budget it used (30) cut at
   * "…the mid-market", which never leaves punctuation at the boundary — so the
   * assertion was true for a reason that had nothing to do with the code.
   *
   * My own 6/6 mutant battery reported a perfect score and was silent here,
   * because none of the six targeted that line. A full kill-rate says nothing
   * about a line no mutant touches.
   *
   * At 34 the cut lands immediately after "segment," — so the comma IS at the
   * boundary, and removing the strip REDs this.
   */
  it('leaves no dangling punctuation at the cut', () => {
    const src = 'Growth in the mid-market segment, which we believe is'
    const cut = truncateAtWord(src, 34)
    // PRECONDITION: the cut must actually land on punctuation, or this passes
    // for the same empty reason the old version did.
    expect(src.slice(0, 34).trimEnd().endsWith(',')).toBe(true)
    expect(cut).not.toMatch(/[\s,;:–—-]…$/)
    expect(cut).toMatch(/segment…$/)
  })
})

describe('the two budgets answer different questions', () => {
  /**
   * ⚠ THE PIN THAT STOPS THEM COLLAPSING BACK INTO ONE. They were the same
   * constant for one revision and the floor cut a word in half, because a
   * threshold for "is this a name?" is not a budget for "what fits at 280px".
   * If a future edit makes them equal, this REDs with the reason.
   */
  it('the display cut is strictly smaller than the name threshold', () => {
    expect(DISPLAY_CHAR_CUT).toBeLessThan(NAME_CHAR_BUDGET)
  })

  it('classification uses the NAME threshold, not the display cut', () => {
    // A real label from the Model tab, whose length lands BETWEEN the two
    // numbers: longer than a row shows, still inside the name contract. It is
    // the case that distinguishes them, so a real one is worth more than a
    // constructed one.
    const between = 'Competitive Intensity in Target Market'
    expect(between.length).toBeGreaterThan(DISPLAY_CHAR_CUT)
    expect(between.length).toBeLessThanOrEqual(NAME_CHAR_BUDGET)
    expect(isProseNotName(between)).toBe(false)
  })
})

describe('isProseNotName', () => {
  it('a long multi-word string is prose', () => {
    expect(isProseNotName(CLAIM)).toBe(true)
  })
  it('a short noun phrase is a name', () => {
    expect(isProseNotName('Warm Network Activation')).toBe(false)
  })
  /**
   * ⚠ THIS CASE USED TO ASSERT THE OPPOSITE, ON A REASON A REVIEWER MEASURED
   * AS FALSE. The old rule excluded space-free labels because word truncation
   * "would return it unchanged and the affordance would promise a reveal that
   * shows the same string". The first half is true; the second does not
   * follow. The ROW still CSS-clips the token — a 72-character identifier
   * rendered at 463px inside a 254px column — so the reveal would have shown
   * 209px of otherwise unreachable text. "Unchanged by the cut" is not
   * "already visible", and the disclosure is a `<p>` that WRAPS.
   */
  it('a long SINGLE token is still longer than a name', () => {
    expect(isProseNotName('a'.repeat(NAME_CHAR_BUDGET + 20))).toBe(true)
  })
})

describe('needsClaimDisclosure — the DISPLAY question, not the contract one', () => {
  it('offers a route for a space-free token the row cannot show', () => {
    // The case the old predicate excluded. 72 chars, no boundary to cut at,
    // and clipped to roughly a third of its width at the 280px floor.
    expect(needsClaimDisclosure('urn:factor:'.concat('x'.repeat(61)))).toBe(true)
  })

  it('offers a route for U+00A0-separated prose', () => {
    // Producer prose arrives with non-breaking spaces. `lastIndexOf(' ')`
    // matches none of them, so the whole sentence read as one unbreakable
    // token and fell through every cut.
    const nbsp = 'We\u00a0heard\u00a0from\u00a0three\u00a0churned\u00a0customers\u00a0about\u00a0pricing'
    expect(needsClaimDisclosure(nbsp)).toBe(true)
    // and the cut now finds those boundaries
    expect(truncateAtWord(nbsp)).toMatch(/…$/)
    expect(truncateAtWord(nbsp)).not.toContain('\u00a0')
  })

  it('covers the band between the two budgets, which neither used to guard', () => {
    const between = 'Competitive Intensity in Target Market' // 38
    expect(between.length).toBeGreaterThan(DISPLAY_CHAR_CUT)
    expect(between.length).toBeLessThanOrEqual(NAME_CHAR_BUDGET)
    expect(needsClaimDisclosure(between)).toBe(true)
    expect(isProseNotName(between)).toBe(false) // still a name, by contract
  })

  it('offers NO route for a label the row can show in full', () => {
    // The discriminating twin: without this, "offers a route" passes on a
    // predicate that returns true for everything.
    expect(needsClaimDisclosure('Time Pressure')).toBe(false)
  })
})

describe('the claim is reachable without hover', () => {
  it('offers a real control, and reveals the full claim on press', async () => {
    draw([row({ id: 'churn', label: CLAIM })])
    const el = byId('churn')

    // PRECONDITION: the row must be showing a TRUNCATED label, or "the full
    // claim is revealed" is trivially true because it was never hidden.
    const label = el.querySelector('[data-prose-name="true"]')!
    expect(label).toBeInTheDocument()
    expect(label.textContent).not.toBe(CLAIM)
    expect(el.querySelector(`[data-testid="${TID}-claim"]`)).toBeNull()

    await userEvent.click(el.parentElement!.querySelector(`[data-testid="${TID}-claim-toggle"]`)!)

    const claim = screen.getByTestId(`${TID}-claim`)
    expect(claim).toHaveTextContent(CLAIM)
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. Without this, every assertion above passes on a
   * component that shows the toggle on EVERY row — which would put a "Show the
   * full claim" line under "Time Pressure" and defeat the entire point, since
   * the affordance is meant to BE the signal that a name is missing.
   */
  it('shows NO toggle for a factor that already has a real name', () => {
    draw([row({ id: 'short', label: 'Time Pressure' })])
    const li = byId('short').parentElement!
    expect(li.querySelector(`[data-testid="${TID}-claim-toggle"]`)).toBeNull()
    expect(byId('short').querySelector('[data-prose-name="true"]')).toBeNull()
  })

  /**
   * ⚠ WCAG 2.2 AA §2.5.8 — 24×24 CSS px minimum. A reviewer measured this
   * control at 106×15px, identical at all four dock widths: a sub-minimum
   * touch target on a PR whose entire premise is that TOUCH HAS NO HOVER, and
   * sitting directly beneath a full-width row button that opens the value
   * editor, so a mis-tap does the wrong thing.
   *
   * jsdom performs no layout, so this binds to the MECHANISM — the shared
   * class the height comes from. Measured in a browser at both dock widths
   * after the fix: 114×24, `wcag24: true`.
   */
  it('gives the claim control a touch target, not a text link', () => {
    draw([row({ id: 'churn', label: CLAIM })])
    const toggle = screen.getByTestId(`${TID}-claim-toggle`)
    expect(toggle.className).toContain('min-h-[24px]')
    expect(toggle.className).toContain('items-center')
  })

  /**
   * ⚠ THE CLASS THE OLD PREDICATE EXCLUDED. A 72-character space-free token
   * rendered at 463px inside a 254px column and had NO control — its
   * remainder lived in `title` only, which is precisely what this section
   * exists to escape.
   */
  it('offers the control for a space-free label the row cannot show', () => {
    const token = `urn:factor:${'x'.repeat(61)}`
    draw([row({ id: 'tok', label: token })])
    const li = byId('tok')
    expect(li.querySelector(`[data-testid="${TID}-claim-toggle"]`)).not.toBeNull()
  })

  it('renders the full name verbatim when it is short — it never rewrites', () => {
    draw([row({ id: 'short', label: 'Warm Network Activation' })])
    expect(byId('short')).toHaveTextContent('Warm Network Activation')
  })
})
