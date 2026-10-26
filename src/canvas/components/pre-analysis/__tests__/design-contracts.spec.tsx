/**
 * Design contract regression tests for pre-analysis components.
 *
 * Guards against reintroduction of:
 * 1. Coloured left-border (border-l-*) classes in pre-analysis content cards.
 *    Complete borders only — V7 L2 converted the last exceptions (§16 coaching
 *    cards, §17 toasts) to complete borders, so Paul's rule is categorical now.
 * 2. Em-dash characters (— / \u2014) in user-visible UI strings per the copy style guide.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelAdjustments } from '../../model-tab/ModelAdjustments'

vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns every className string present in the rendered container. */
function getAllClassNames(container: HTMLElement): string {
  const classes: string[] = []
  container.querySelectorAll('[class]').forEach(el => {
    // SVGAnimatedString (on SVG elements) has a .baseVal; HTML elements have a plain string
    const raw = el instanceof SVGElement ? el.className.baseVal : (el as HTMLElement).className
    if (typeof raw === 'string') {
      raw.split(/\s+/).forEach(c => { if (c) classes.push(c) })
    }
  })
  return classes.join(' ')
}

/**
 * Left-border patterns are banned outright in pre-analysis content cards:
 * - border-l-[3px] border-l-{colour} — the coaching-card accent, converted to a
 *   complete border in V7 L2 (§16); no coaching card renders here anyway.
 * - border-l-2 border-panel-border — neutral indent guides are also banned; all
 *   left borders are prohibited in analysis-tab content cards.
 *
 * This helper returns true if a class string contains any coloured/structural
 * left border.
 */
function hasNonExemptLeftBorder(classString: string): boolean {
  // Any border-l class is banned in pre-analysis content cards.
  return /\bborder-l-/.test(classString)
}

// ── Left-border contract ───────────────────────────────────────────────────

describe('Design contract: no non-exempt left borders in pre-analysis content', () => {
  it('ModelAdjustments technical detail panel has no left border', () => {
    const { container } = render(
      <ModelAdjustments
        adjustments={[{
          code: 'factor_reclassified',
          reason: 'Factor moved',
          technicalDetail: 'effect_direction positive contradicts strength_mean sign (0.5)',
        }]}
      />
    )

    // Expand the technical detail
    const detailBtn = screen.queryByText('Details')
    if (detailBtn) fireEvent.click(detailBtn)

    const classNames = getAllClassNames(container)
    expect(hasNonExemptLeftBorder(classNames)).toBe(false)
  })
})

// ── Em-dash contract ───────────────────────────────────────────────────────

describe('Design contract: no em dashes in pre-analysis rendered text', () => {
  it('ModelAdjustments rendered headlines contain no em dash', () => {
    const { container } = render(
      <ModelAdjustments
        adjustments={[{
          code: 'factor_reclassified',
          reason: 'Factor moved',
        }]}
      />
    )

    const allText = container.innerHTML
    expect(allText).not.toContain('\u2014')
    expect(allText).not.toContain('&mdash;')
  })
})
