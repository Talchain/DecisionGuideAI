/**
 * ConstraintBadge unit tests (A.6)
 * Verifies: rendering, accessible attributes, pointer-events-none, hover zone, no deps on store.
 */
import { describe, it, expect } from 'vitest'
import { CANVAS_CORNER_OFFSET_CLASSES_LEFT, CANVAS_GLYPH_SIZE_CLASSES } from '../shared/canvasGlyphScale'
import { render } from '@testing-library/react'
import { ConstraintBadge } from '../ConstraintBadge'

describe('ConstraintBadge', () => {
  it('renders with data-testid="constraint-badge"', () => {
    const { container } = render(<ConstraintBadge tooltip="Constrained: Revenue >= 1000" />)
    const badge = container.querySelector('[data-testid="constraint-badge"]')
    expect(badge).not.toBeNull()
  })

  it('hover zone title attribute contains constraint description', () => {
    const { container } = render(<ConstraintBadge tooltip="Constrained: Cost <= 500" />)
    const hover = container.querySelector('[data-testid="constraint-badge-hover"]')
    expect(hover?.getAttribute('title')).toBe('Constrained: Cost <= 500')
  })

  it('hover zone aria-label matches the tooltip', () => {
    const { container } = render(<ConstraintBadge tooltip="Constrained: Time >= 10" />)
    const hover = container.querySelector('[data-testid="constraint-badge-hover"]')
    expect(hover?.getAttribute('aria-label')).toBe('Constrained: Time >= 10')
  })

  it('visual badge has pointer-events-none class', () => {
    const { container } = render(<ConstraintBadge tooltip="test" />)
    const badge = container.querySelector('[data-testid="constraint-badge"]')
    expect(badge?.className).toContain('pointer-events-none')
  })

  it('hover zone does NOT have pointer-events-none (allows tooltip)', () => {
    const { container } = render(<ConstraintBadge tooltip="test" />)
    const hover = container.querySelector('[data-testid="constraint-badge-hover"]')
    expect(hover?.className).not.toContain('pointer-events-none')
  })

  it('positions at bottom-left (complementing EvidenceGapBadge at bottom-right)', () => {
    const { container } = render(<ConstraintBadge tooltip="test" />)
    const badge = container.querySelector('[data-testid="constraint-badge"]')
    expect(badge?.className).toContain('absolute')
    // ⛔ WAS `-bottom-1.5 -left-1.5` — RAW CSS PX INSIDE A TRANSFORMED VIEWPORT.
    // With `size={7}` inside a `w-3 h-3` box, the user got a 6px circle holding
    // a 3.5px glyph at the settle zoom, against this estate's own exported
    // `MIN_TARGET_RENDERED_PX` of 24. `EvidenceGapBadge` was migrated to the
    // counter-scaled maps and this one, its stated complement, never was — so
    // the two "complementing" badges were drawn to different rules.
    expect(badge?.className).toContain(CANVAS_CORNER_OFFSET_CLASSES_LEFT[6])
    expect(badge?.className).toContain(CANVAS_GLYPH_SIZE_CLASSES[12])
  })

  /**
   * ⭐ THE PROPERTY THE LITERAL WAS STANDING IN FOR, asserted directly: both
   * the visual badge and its larger hit target must carry the counter-scale, or
   * they come apart at zoom and the transparent target slides off the mark it
   * exists to be a target FOR.
   */
  it('⭐ both the badge and its hit target carry the counter-scale', () => {
    const { container } = render(<ConstraintBadge tooltip="test" />)
    for (const tid of ['constraint-badge', 'constraint-badge-hover']) {
      const el = container.querySelector(`[data-testid="${tid}"]`)
      expect(el?.className, `${tid} is not counter-scaled`).toContain('var(--canvas-label-scale')
    }
  })

  it('is a circle (rounded-full)', () => {
    const { container } = render(<ConstraintBadge tooltip="test" />)
    const badge = container.querySelector('[data-testid="constraint-badge"]')
    expect(badge?.className).toContain('rounded-full')
  })
})
