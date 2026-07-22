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
import { AllImprovements } from '../AllImprovements'
import { ModelAdjustments } from '../../model-tab/ModelAdjustments'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'

vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

// ── Fixtures ───────────────────────────────────────────────────────────────

const fixItem = (overrides: Partial<ImprovementItem> = {}): ImprovementItem => ({
  key: 'item-1',
  category: 'fix',
  label: 'Fix something',
  detail: 'A detail',
  action: { kind: 'edit', label: 'Edit', targetId: 'node-1', targetType: 'node' },
  focus: { type: 'node', id: 'node-1' },
  bias: null,
  sourceBadge: null,
  ...overrides,
})

const verifyItem = (overrides: Partial<ImprovementItem> = {}): ImprovementItem => ({
  ...fixItem(),
  key: 'verify-1',
  category: 'verify',
  label: 'Check assumption',
  action: { kind: 'confirm', label: 'Confirm', targetId: 'node-2', targetType: 'node' },
  ...overrides,
})

const emptyCategoryMap = { fix: [], verify: [], add_evidence: [], strengthen: [] }
const emptyTiers = {
  mustAddress: { items: [], count: 0 },
  reviewAssumptions: { items: [], count: 0 },
  optional: { items: [], count: 0 },
}

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
  it('AllImprovements renders tier and category sections with full borders only', () => {
    const { container } = render(
      <AllImprovements
        improvementsByCategory={{ ...emptyCategoryMap, fix: [fixItem()], verify: [verifyItem()] }}
        tiers={{
          mustAddress: { items: [fixItem()], count: 1 },
          reviewAssumptions: { items: [verifyItem()], count: 1 },
          optional: { items: [], count: 0 },
        }}
        totalImprovements={2}
      />
    )

    const classNames = getAllClassNames(container)
    expect(hasNonExemptLeftBorder(classNames)).toBe(false)
  })

  it('AllImprovements expanded reviewed item has no left border', () => {
    const { container } = render(
      <AllImprovements
        improvementsByCategory={{ ...emptyCategoryMap, verify: [verifyItem()] }}
        tiers={{
          ...emptyTiers,
          reviewAssumptions: { items: [verifyItem()], count: 1 },
        }}
        totalImprovements={1}
        actionHandlers={{
          onConfirm: vi.fn(),
          onAssumption: vi.fn(),
        }}
      />
    )

    const classNames = getAllClassNames(container)
    expect(hasNonExemptLeftBorder(classNames)).toBe(false)
  })

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
  it('AllImprovements tooltip strings contain no em dash', () => {
    const { container } = render(
      <AllImprovements
        improvementsByCategory={{ ...emptyCategoryMap, verify: [verifyItem()] }}
        tiers={{
          ...emptyTiers,
          reviewAssumptions: { items: [verifyItem()], count: 1 },
        }}
        totalImprovements={1}
        actionHandlers={{ onAssumption: vi.fn() }}
      />
    )

    // Check all tooltip attributes (title, aria-label, data-tooltip)
    const allText = container.innerHTML
    expect(allText).not.toContain('\u2014')
    expect(allText).not.toContain('&mdash;')
  })

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
