/**
 * Design contract regression tests for pre-analysis components.
 *
 * Guards against reintroduction of:
 * 1. Non-exempt coloured left-border (border-l-*) classes — only coaching/MVS/alert/toast
 *    cards may have left-accent borders per §6.4 / §16–§17 of the design system.
 * 2. Em-dash characters (— / \u2014) in user-visible UI strings per the copy style guide.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AllImprovements } from '../AllImprovements'
import M1TopActions from '../M1TopActions'
import { ModelAdjustments } from '../ModelAdjustments'
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
 * Exempt left-border patterns per §6.4 / §16–§17:
 * - border-l-[3px] border-l-{colour} — coaching card (§16) / MVS card (§16.1)
 * - border-l-2 border-panel-border — neutral indent guides are NOT exempt; all
 *   left borders are banned in analysis-tab content cards after this pass.
 *
 * This helper returns true if a class string contains a non-exempt coloured left border.
 */
function hasNonExemptLeftBorder(classString: string): boolean {
  // Any border-l class is non-exempt in pre-analysis content cards.
  // (ConfidenceSection MVS card is in results/, not tested here.)
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

  it('M1TopActions renders action cards with full borders only', () => {
    const { container } = render(
      <M1TopActions
        topActions={[
          fixItem({ key: 'a1', category: 'fix' }),
          verifyItem({ key: 'a2' }),
        ]}
        onConfirm={vi.fn()}
        onAssumption={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    const classNames = getAllClassNames(container)
    expect(hasNonExemptLeftBorder(classNames)).toBe(false)
  })

  it('M1TopActions reviewed-state expanded row has no left border', () => {
    const { container, rerender } = render(
      <M1TopActions
        topActions={[verifyItem({ key: 'v1' })]}
        onConfirm={vi.fn()}
        onAssumption={vi.fn()}
      />
    )
    // Confirm the item so it enters reviewed state
    const confirmBtn = container.querySelector('[aria-label*="onfirm"], [title*="onfirm"]') as HTMLElement | null
    if (confirmBtn) fireEvent.click(confirmBtn)

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

  it('M1TopActions tooltip strings contain no em dash', () => {
    const { container } = render(
      <M1TopActions
        topActions={[verifyItem({ key: 'v1' })]}
        onAssumption={vi.fn()}
      />
    )

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
