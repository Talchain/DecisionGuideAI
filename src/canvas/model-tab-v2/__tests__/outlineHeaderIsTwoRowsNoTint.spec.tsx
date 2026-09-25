/**
 * ⭐⭐ V2 GAP 31 — OUTLINE HEADER CONTROLS USE TINT FILLS, THE PLAIN/ADVANCED
 * TOGGLE IS 16PX TALL, AND THE HEADER WRAPS TO 3 ROWS AT 280PX.
 *
 * `FIDELITY-GAPS-INDEX-20260924.txt` #31 (high/quick). Witnessed on served
 * `4549b66b`: the filter was `bg-panel-hover` (a beige tint, computed
 * `rgb(254 249 243)`), the tier toggle's pressed state was the SAME tint on
 * the SAME tint (`bg-panel-hover` for both the group ground and the pressed
 * button), the buttons were 16px tall (`buttonSmall` = `leading-none` +
 * `py-0.5`, no height floor — below the 24px WCAG 2.2 AA §2.5.8 target every
 * other control on the outline carries), and the single `flex-wrap` header
 * row stacked to THREE rows at the 280px dock floor.
 *
 * jsdom performs no layout, so this file does not re-measure "3 rows" in
 * pixels. It pins what MAKES three rows unnecessary and what MADE it
 * happen instead: the filter is now its own full-width row (so it can never
 * compete for space with the title/toggle row), and every tint that used to
 * sit under `bg-panel-hover` is gone. Four independent assertions, bound so a
 * mutant reverting any ONE production edit REDs only its own line.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

import { ModelTabV2Panel } from '../ModelTabV2Panel'

afterEach(cleanup)

function classTokens(el: Element): string[] {
  return el.className.split(/\s+/).filter(Boolean)
}

function renderPanel() {
  render(<ModelTabV2Panel nodes={[]} edges={[]} goalThreshold={null} />)
}

describe('1. the filter carries no tinted ground', () => {
  it('bg-panel + border-field, never bg-panel-hover', () => {
    renderPanel()
    const tokens = classTokens(screen.getByTestId('model-tab-v2-filter'))
    expect(tokens).toContain('bg-panel')
    expect(tokens).toContain('border-field')
    expect(tokens).not.toContain('bg-panel-hover')
  })

  it('is on its OWN full-width row, not sharing a row with the title/toggle', () => {
    renderPanel()
    const filter = screen.getByTestId('model-tab-v2-filter')
    const heading = screen.getByText('Model outline')
    // The title's own row is an ANCESTOR of the filter, never a SIBLING —
    // if they were still crammed onto one flex-wrap row, the title's parent
    // would equal the filter's parent.
    expect(filter.parentElement).not.toBe(heading.parentElement)
    expect(classTokens(filter)).toContain('w-full')
  })
})

describe('2. the tier toggle is a pill group, not a tinted rectangle', () => {
  it('rounded-full with a 3px inset padding/gap, matching the segmented-control shape', () => {
    renderPanel()
    const tokens = classTokens(screen.getByTestId('model-tab-v2-tier-toggle'))
    expect(tokens).toContain('rounded-full')
    expect(tokens).toContain('p-[3px]')
    expect(tokens).toContain('gap-[3px]')
    expect(tokens).not.toContain('rounded')
  })
})

describe('3. the pressed tier is filled, never tinted the same as its own ground', () => {
  it('pressed: bg-primary text-text-on-color, not bg-panel-hover', () => {
    renderPanel()
    const pressed = screen.getByTestId('model-tab-v2-tier-plain') // default tier is plain
    const tokens = classTokens(pressed)
    expect(pressed).toHaveAttribute('aria-pressed', 'true')
    expect(tokens).toContain('bg-primary')
    expect(tokens).toContain('text-text-on-color')
    expect(tokens).not.toContain('bg-panel-hover')
  })

  it('unpressed: no fill at all', () => {
    renderPanel()
    const unpressed = screen.getByTestId('model-tab-v2-tier-advanced')
    expect(unpressed).toHaveAttribute('aria-pressed', 'false')
    const tokens = classTokens(unpressed)
    expect(tokens).not.toContain('bg-primary')
    expect(tokens).not.toContain('bg-panel-hover')
  })
})

describe('4. both tier buttons carry a real ≥24px target', () => {
  /* ⭐ MODEL-6: 24px → 28px. TYPE-11/D1 moved these arms off `buttonSmall`
     (12px/600) onto `panelBody` (12px/400), matching the row's own Rename
     and the prototype's `.lens>button` (min-height:28px). The 24px floor
     stays met — 28 is the estate's own 28px control height, not a new
     rule. */
  it('min-h-[28px] on Plain and Advanced', () => {
    renderPanel()
    expect(classTokens(screen.getByTestId('model-tab-v2-tier-plain'))).toContain('min-h-[28px]')
    expect(classTokens(screen.getByTestId('model-tab-v2-tier-advanced'))).toContain('min-h-[28px]')
  })
})
