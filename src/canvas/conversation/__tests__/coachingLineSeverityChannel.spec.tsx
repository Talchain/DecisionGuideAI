/**
 * The collapsed line keeps the review card's SEVERITY channel.
 *
 * ## The defect, and how it got past #1450's own spec
 *
 * #1450's compact line derives its icon from the block's guidance `category`.
 * `adaptTypedReviewCardBlock` does not carry `category` — a review card sends
 * `severity`; only `v5_coaching` sends a category — so `blockCategory`
 * returned null on EVERY review card and every line drew the same `Lightbulb`
 * in `text-info`. On `live-analysis-turn-walkA-2026-08-04` that flattened the
 * turn's one `warning` card ("How robust is this?") into the four `info`s
 * around it. The full card would have drawn an amber `AlertTriangle`.
 *
 * ⛔ #1450'S SPEC PASSED THROUGHOUT, AND THE REASON IS THE POINT OF THIS FILE.
 * Its fixtures were written by hand and every one carried a `category`, so the
 * chip-and-icon assertions exercised a shape no real review card has. A
 * self-authored fixture encodes the author's model of the producer, and here
 * that model was wrong in exactly the way that mattered.
 *
 * ⚠⚠ SO THIS FILE BUILDS ITS BLOCKS FROM A DATED LIVE CAPTURE, THROUGH THE
 * SHIPPED ADAPTER. `live-analysis-turn-walkA-2026-08-04.json` is read-only
 * evidence (historic fixtures are append-only — it is never written to), and
 * `adaptTypedReviewCardBlock` is the same function the product runs. Nothing
 * below hand-writes a block.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoachingLine } from '../CoachingLine'
import { adaptTypedReviewCardBlock } from '../../../v5/phase3TypedBlocks'
import { reviewSeverityVisual } from '../../../v5/blocks/reviewCardSeverity'
import type { ConversationBlock } from '../types'
import capture from '../../../v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'

vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isCompactCoachingLinesEnabled: vi.fn(() => true),
}))

/** Every review card in the capture, adapted by the shipped adapter. */
const CARDS = ((capture as { blocks?: unknown[] }).blocks ?? [])
  .map((b) => adaptTypedReviewCardBlock(b))
  .filter((b): b is NonNullable<ReturnType<typeof adaptTypedReviewCardBlock>> => b !== null)

const bySeverity = (s: string) => CARDS.filter((c) => c.severity === s)

const lineFor = (block: unknown) =>
  render(
    <CoachingLine block={block as ConversationBlock}>
      <div data-testid="card-body">body</div>
    </CoachingLine>,
  )

const iconOf = (container: HTMLElement): SVGElement | null =>
  container.querySelector('summary svg')

describe('the capture really carries the shape this file is about', () => {
  /**
   * PIN THE PRECONDITION IN-TEST. If the capture ever stopped carrying a
   * non-info review card, every assertion below would still pass while
   * discriminating nothing.
   */
  it('carries at least one info AND at least one non-info review card', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(5)
    expect(bySeverity('info').length).toBeGreaterThanOrEqual(1)
    expect(CARDS.filter((c) => c.severity !== 'info').length).toBeGreaterThanOrEqual(1)
  })

  it('the adapter really drops `category` — the cause of the defect', () => {
    for (const card of CARDS) {
      expect((card as { category?: unknown }).category).toBeUndefined()
    }
  })
})

describe('severity reaches the collapsed line as glyph and tint', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('a warning review card does not render as an info one', () => {
    const warn = CARDS.find((c) => c.severity === 'warning')
    const info = CARDS.find((c) => c.severity === 'info')
    expect(warn, 'capture must carry a warning card').toBeTruthy()
    expect(info, 'capture must carry an info card').toBeTruthy()

    const { container: warnC } = lineFor(warn)
    const warnIcon = iconOf(warnC)
    const { container: infoC } = lineFor(info)
    const infoIcon = iconOf(infoC)

    expect(warnIcon).toBeTruthy()
    expect(infoIcon).toBeTruthy()
    // The whole defect in one assertion: these were identical.
    expect(warnIcon?.getAttribute('class')).not.toBe(infoIcon?.getAttribute('class'))
  })

  it('each card takes the SAME glyph and tint the full card would draw', () => {
    for (const card of CARDS) {
      document.body.innerHTML = ''
      const expected = reviewSeverityVisual(card.severity)
      const { container } = lineFor(card)
      const icon = iconOf(container)
      expect(icon, `no icon for ${card.severity}`).toBeTruthy()
      const cls = icon?.getAttribute('class') ?? ''
      expect(cls, `${card.severity} tint`).toContain(expected.tintClass)
      // Glyph identity, not just colour: lucide stamps its own name on the svg.
      const glyph = expected.Icon === reviewSeverityVisual('info').Icon ? 'lightbulb' : 'alert-triangle'
      expect(cls, `${card.severity} glyph`).toContain(glyph)
    }
  })

  it('renders NO severity copy — the channel is visual only', () => {
    const warn = CARDS.find((c) => c.severity === 'warning')!
    const { container } = lineFor(warn)
    const summary = container.querySelector('summary')
    expect(summary?.textContent).toBe(warn.title)
  })

  it('renders no category chip, because a review card sends no category', () => {
    const card = CARDS[0]
    const { container } = lineFor(card)
    expect(
      container.querySelector(`[data-testid^="coaching-line-category-"]`),
      'a chip here would be a UI fabrication',
    ).toBeNull()
  })

  it('still renders the producer title verbatim, and still collapses', () => {
    const warn = CARDS.find((c) => c.severity === 'warning')!
    lineFor(warn)
    expect(screen.getByText(warn.title)).toBeVisible()
    expect(screen.getByTestId('card-body')).not.toBeVisible()
  })
})
