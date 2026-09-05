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
import { DISPLAY_CHAR_CUT, NAME_CHAR_BUDGET, isProseNotName, truncateAtWord } from '../nameOrClaim'

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

  it('leaves no dangling punctuation at the cut', () => {
    expect(truncateAtWord('Growth in the mid-market segment, which we believe is', 30)).not.toMatch(
      /[\s,;:–—-]…$/,
    )
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
  it('a long SINGLE token is not prose — there is no boundary to cut at', () => {
    expect(isProseNotName('a'.repeat(NAME_CHAR_BUDGET + 20))).toBe(false)
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

  it('renders the full name verbatim when it is short — it never rewrites', () => {
    draw([row({ id: 'short', label: 'Warm Network Activation' })])
    expect(byId('short')).toHaveTextContent('Warm Network Activation')
  })
})
