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
  return {
    type: 'v5_evidence',
    block_id: `ev-${severity}`,
    factor_label: 'Churn Trend',
    target_refs: [],
    current_confidence: 'low',
    evidence_gap: 'No recent cohort data',
    suggested_technique: 'Pull the last two quarters',
    impact_if_gathered: 'Would settle the ordering',
    priority_rank: 1,
    severity,
    freshness: 'fresh',
  } as V5EvidenceBlockType
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
    const cls = iconOf(container)?.getAttribute('class') ?? ''
    expect(cls, 'the magnifying glass is the evidence block’s own glyph').toContain('lucide-search')
    expect(cls, 'taking the whole review-card resolver would land Lightbulb here').not.toContain(
      'lucide-lightbulb',
    )
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
    })
  }

  /**
   * And it is genuinely the SHARED authority, not a fourth copy that happens to
   * agree today. If `severityChannel` stops returning what this block renders,
   * the block has re-grown a mirror.
   */
  it('renders exactly what `severityChannel` returns — no fourth copy', () => {
    for (const severity of SEVERITIES) {
      const { tintClass, borderClass } = severityChannel(severity)
      const { container } = render(<V5EvidenceBlock block={evidenceBlock(severity)} />)
      expect(iconOf(container)?.getAttribute('class') ?? '').toContain(tintClass)
      expect(container.firstElementChild?.getAttribute('class') ?? '').toContain(borderClass)
    }
  })
})
