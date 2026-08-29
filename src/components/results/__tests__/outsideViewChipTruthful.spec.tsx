/**
 * THE OUTSIDE-VIEW CHIP MUST NOT PROMISE RETRIEVAL WE CANNOT PERFORM.
 *
 * ## The defect this pins
 *
 * The chip read **"Research this"**, its draft opened with **"Research how
 * X typically performs versus Y…"**, and the turn it sent raised the loading
 * hint **"Researching evidence…"**. There is no research tool: it was deleted
 * on 22 Jul 2026, and CEE answers *"I can't fetch external sources"*. The
 * product therefore advertised an action that reliably terminates in refusal.
 *
 * This is the SAME defect ROADMAP 2.816 already ruled on for the dominant-
 * factor nudge — *"Two honest fixes: remove the CTA, or build the producer.
 * There is no third option that leaves the button where it is."* — and
 * `researchCtaRetired.spec.tsx` names this chip, in its header, as the
 * surviving instance. This file closes it by the OTHER honest route: the
 * underlying prompt is genuinely good and fully answerable from model
 * knowledge, so the capability stays and only the retrieval promise goes.
 *
 * ## The three surfaces, because fixing one leaves the other two lying
 *
 * A tester meets the promise three times — on the chip, in the draft they are
 * about to send, and in the spinner while it runs. Each is produced by a
 * different module, so each gets its own case.
 *
 * ## Case (d) is the contrast control (standing brief §2/§3)
 *
 * Deleting the hint branch could be done two ways: removing the one dishonest
 * branch, or gutting `inferLoadingHint` so everything falls through to
 * "Thinking…". Case (d) proves the function still discriminates — a sibling
 * branch that is TRUE of the product still fires. Without it, case (c) passes
 * just as well against a function that returns a constant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))
vi.mock('../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { StressTestSection } from '../StressTestSection'
import { buildOutsideViewCard } from '../utils/stressTestTemplates'
import { openAskOlumi } from '../coaching/askOlumiStore'
import { inferLoadingHint } from '@/canvas/conversation/useConversation'

/**
 * Language that asserts the product will GO AND GET something. Sourced from
 * the refusal itself ("I can't fetch external sources") and from the retired
 * CTA's own copy, not from this author's imagination.
 */
const PROMISES_RETRIEVAL = /research|fetch|look ?up|search|retriev|external source|citation|sources\b/i

describe('the outside-view chip is truthful about what it can do', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(a) the chip label makes no retrieval promise', () => {
    const card = buildOutsideViewCard({ winnerLabel: 'Option A', alternativeLabel: 'Option B' })
    expect(card.chipLabel).toBe('Take an outside view')
    expect(card.chipLabel).not.toMatch(PROMISES_RETRIEVAL)
  })

  it('(b) the draft the chip actually sends makes no retrieval promise', () => {
    render(
      <StressTestSection
        drivers={[]}
        fragileEdges={[]}
        winnerLabel="Option A"
        alternativeLabel="Option B"
        onSendMessage={() => {}}
        designationsWithheld={false}
        flipThresholds={null}
      />,
    )
    // Positive control: the card and its chip mounted, so the assertions below
    // are facts about a rendered control and not about an absent one.
    const card = screen.getByTestId('stress-test-outside-view')
    const chip = screen.getByRole('button', { name: 'Take an outside view' })
    expect(card).toBeInTheDocument()

    fireEvent.click(chip)
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(openAskOlumi).mock.calls[0][0] as { draft: string; label: string }
    expect(arg.draft).not.toMatch(PROMISES_RETRIEVAL)
    expect(arg.label).not.toMatch(PROMISES_RETRIEVAL)
    // And the draft still asks the outside-view question — the capability is
    // kept, not deleted. Bound to the option labels by identity.
    expect(arg.draft).toContain('Option A')
    expect(arg.draft).toContain('Option B')
  })

  it('(c) the spinner never claims to be researching evidence', () => {
    render(
      <StressTestSection
        drivers={[]}
        fragileEdges={[]}
        winnerLabel="Option A"
        alternativeLabel="Option B"
        onSendMessage={() => {}}
        designationsWithheld={false}
        flipThresholds={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Take an outside view' }))
    const { draft } = vi.mocked(openAskOlumi).mock.calls[0][0] as { draft: string }

    // The draft this product actually sends…
    expect(inferLoadingHint(draft, 3)).not.toBe('Researching evidence…')
    // …and any message at all, because the tool is gone for every path, not
    // just for this chip's wording. A user typing this gets the same lie.
    expect(inferLoadingHint('find evidence on this', 3)).not.toBe('Researching evidence…')
    expect(inferLoadingHint('research the base rates', 3)).not.toBe('Researching evidence…')
  })

  it('(d) CONTRAST — a hint that IS true of the product still fires', () => {
    expect(inferLoadingHint('analyse my options', 3)).toBe('Analysing your options…')
    expect(inferLoadingHint('explain this to me', 3)).toBe('Preparing explanation…')
    expect(inferLoadingHint('hello there', 3)).toBe('Thinking…')
  })
})
