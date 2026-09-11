/**
 * The evidence block shares the severity COLOUR channel and keeps its OWN glyph.
 *
 * ## The risk this exists to make un-reintroducible
 *
 * `V5EvidenceBlock` held byte-identical copies of the severity→border and
 * severity→tint maps — the THIRD hand-maintained mirror of one mapping, after
 * the review-card pair had already drifted once (a collapsed review card drew
 * `text-info` for every severity, flattening a warning into routine). Removing
 * the mirror is obviously right.
 *
 * ⛔ WHAT IS NOT OBVIOUS, AND IS THE WHOLE POINT OF THIS FILE: the natural way
 * to remove it is to call `reviewSeverityVisual` and destructure all three
 * values. That compiles, passes every existing spec, and SILENTLY REPLACES THE
 * MAGNIFYING GLASS WITH A LIGHTBULB — because `reviewSeverityVisual` returns
 * `Lightbulb` for `info` and this block draws `Search`. A behaviour change
 * wearing a refactor's clothes, in the exact class of defect the shared module
 * was created to end.
 *
 * So `severityChannel` returns the colours WITHOUT a glyph, and the assertions
 * below pin both halves: the colours must come from the shared authority, and
 * the glyph must not.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { V5EvidenceBlock } from '../V5EvidenceBlock'
import { severityChannel } from '../severityChannel'
import type { V5EvidenceBlock as V5EvidenceBlockType } from '../../../canvas/conversation/types'
// The estate's existing evidence factory — cast-free and already the shape the
// block requires. Hand-rolling a second one here would have been a fixture
// mirror in a file about mirrors.
import { evidence } from '../../../canvas/conversation/__tests__/fixtures/phase3PacingShapes'

const SEVERITIES = ['info', 'warning', 'critical'] as const

/**
 * Literal, hand-written — never derived from the module under test. Deriving
 * them would let both sides move together, which is the blind spot a sibling
 * spec was found to have on the review-card side.
 */
const EXPECTED_COLOUR = {
  info: { tint: 'text-info', border: 'border-info/30' },
  warning: { tint: 'text-warning', border: 'border-warning/30' },
  critical: { tint: 'text-danger', border: 'border-danger/30' },
} as const

function evidenceBlock(severity: (typeof SEVERITIES)[number]): V5EvidenceBlockType {
  return { ...evidence(1), severity }
}

const iconOf = (c: HTMLElement) => c.querySelector('svg')

describe('the evidence block keeps its own glyph', () => {
  /**
   * THE LOAD-BEARING ASSERTION. `info` must draw the magnifying glass, and it
   * must NOT draw the review card's lightbulb. Both halves are stated: a spec
   * that only asserted "search" would still pass if a future refactor rendered
   * both glyphs, and one that only asserted "not lightbulb" would pass on an
   * empty render.
   */
  it('info draws Search, and never the review card’s Lightbulb', () => {
    const { container } = render(<V5EvidenceBlock block={evidenceBlock('info')} />)
    expect(
      iconOf(container)?.getAttribute('class') ?? '',
      'the magnifying glass is the evidence block’s own glyph',
    ).toContain('lucide-search')

    /*
      ⚠ ACROSS EVERY GLYPH, NOT JUST THE FIRST. An earlier revision asserted
      `.not.toContain('lucide-lightbulb')` on `iconOf`, which is
      `querySelector('svg')` — the FIRST svg only. Its comment claimed to catch
      a refactor that rendered BOTH glyphs; it could not. If Search came first
      the assertion passed and the lightbulb went unseen, and if Lightbulb came
      first the positive assertion above had already failed. A guard that can
      only fire when another guard has already fired is not a guard.
    */
    const everyGlyph = [...container.querySelectorAll('svg')]
      .map((svg) => svg.getAttribute('class') ?? '')
      .join(' ')
    expect(everyGlyph, 'taking the whole review-card resolver would land Lightbulb here')
      .not.toContain('lucide-lightbulb')
  })

  it('non-info severities draw AlertTriangle, as they did before the mirror was removed', () => {
    for (const severity of ['warning', 'critical'] as const) {
      const { container } = render(<V5EvidenceBlock block={evidenceBlock(severity)} />)
      const cls = iconOf(container)?.getAttribute('class') ?? ''
      expect(cls, severity).toContain('lucide-alert-triangle')
    }
  })
})

describe('the evidence block takes its colours from the shared authority', () => {
  for (const severity of SEVERITIES) {
    it(`${severity} → ${EXPECTED_COLOUR[severity].tint} / ${EXPECTED_COLOUR[severity].border}`, () => {
      const { container } = render(<V5EvidenceBlock block={evidenceBlock(severity)} />)
      const root = container.firstElementChild
      const cls = iconOf(container)?.getAttribute('class') ?? ''
      expect(cls, 'tint').toContain(EXPECTED_COLOUR[severity].tint)
      expect(root?.getAttribute('class') ?? '', 'border').toContain(EXPECTED_COLOUR[severity].border)

      /*
        And the module itself returns those same literals, so "the block
        renders the DS colours" plus this gives "the block renders the MODULE's
        colours" — i.e. it is not a fourth copy that merely agrees today. This
        is a claim about a pure function, so it needs no second render; an
        earlier revision spent three extra mounts asserting it through the DOM.
      */
      expect(severityChannel(severity)).toEqual({
        tintClass: EXPECTED_COLOUR[severity].tint,
        borderClass: EXPECTED_COLOUR[severity].border,
      })
    })
  }

})
