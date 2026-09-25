/**
 * ⭐⭐ V2 GAP 32 — THREE DIFFERENT DISCLOSURE GLYPHS IN ONE TAB, INCLUDING TEXT
 * TRIANGLES ON ALL FIVE OUTLINE HEADINGS.
 *
 * `FIDELITY-GAPS-INDEX-20260924.txt` #32 (high/quick). Witnessed on served
 * `4549b66b`: `ModelOutline.tsx` rendered the Unicode characters `▾`/`▸` on
 * every group heading (goal, options, factors, outcomes-risks,
 * relationships — all five, at rest), the Model card two components below
 * used a Lucide `ChevronRight` that ROTATES (`Accordion.tsx`), and
 * `ModelAdjustments` SWAPPED between two separate Lucide icons
 * (`ChevronDown`/`ChevronRight`) at two of its own toggles. Three glyphs, two
 * mechanisms, one tab; the design authority's `.disclose .chev` is the same
 * rotating chevron everywhere.
 *
 * Two components, three toggles, each bound by IDENTITY (a real SVG element
 * found by its Lucide class, never inferred from a snapshot):
 *   1. `ModelOutline`'s group heading — no text triangle, a rotating
 *      `ChevronRight`.
 *   2. `ModelAdjustments`' main toggle — ONE element that rotates, not two
 *      that swap.
 *   3. `ModelAdjustments`' post-run-repairs toggle — the same.
 *
 * A mutant reverting any ONE of the three REDs only its own assertions.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'

vi.mock('../../store', () => ({ useCanvasStore: (sel: (s: unknown) => unknown) => sel({ nodes: [] }) }))

import { ModelOutline } from '../ModelOutline'
import type { ModelRow } from '../types'
import { ModelAdjustments } from '../../components/model-tab/ModelAdjustments'

afterEach(cleanup)

const row = (id: string, label: string): ModelRow => ({
  id,
  kind: 'factor',
  group: 'factors',
  label,
  primaryValue: '60,000',
  provenanceSource: 'user',
  attention: [],
  editable: true,
})

/** Every group starts closed, matching how `ModelTabV2Panel` actually wires
 *  `ModelOutline` (`initiallyClosedGroups={MODEL_GROUP_IDS}`) — `ModelOutline`
 *  itself defaults every group OPEN when the prop is omitted, which is not
 *  the state this gap was witnessed in. */
const ALL_GROUPS = ['goal', 'options', 'factors', 'outcomes-risks', 'relationships'] as const

describe('1. ModelOutline group heading — a rotating chevron, never a text triangle', () => {
  it('carries no ▾/▸ character in its rendered text', () => {
    render(
      <ModelOutline rows={[row('f1', 'Annual cost')]} tier="plain" filter="" initiallyClosedGroups={ALL_GROUPS} />,
    )
    const toggle = screen.getByTestId('model-group-v2-factors-toggle')
    expect(toggle.textContent).not.toMatch(/[▾▸]/)
  })

  it('renders a Lucide chevron-right SVG that rotates open/closed', () => {
    render(
      <ModelOutline rows={[row('f1', 'Annual cost')]} tier="plain" filter="" initiallyClosedGroups={ALL_GROUPS} />,
    )
    const toggle = screen.getByTestId('model-group-v2-factors-toggle')
    const glyph = toggle.querySelector('.lucide-chevron-right')
    expect(glyph, 'no chevron-right glyph on the outline toggle').not.toBeNull()

    // Closed at rest.
    expect(glyph!.getAttribute('class')).not.toMatch(/rotate-90/)

    fireEvent.click(toggle)
    const glyphAfter = toggle.querySelector('.lucide-chevron-right')
    expect(glyphAfter!.getAttribute('class')).toMatch(/rotate-90/)
  })
})

describe('2. ModelAdjustments main toggle — one element, not a swap', () => {
  // ⚠ TWO adjustments, DIFFERENT codes — a single adjustment renders the
  // compact one-item layout (a "Details" link, no collapsible toggle at
  // all), which would make this test vacuous (trap 13b).
  const ADJUSTMENTS = [
    { code: 'factor_reclassified', reason: 'Moved "A" to external' },
    { code: 'risk_coefficient_corrected', reason: 'Direction mismatch' },
  ]

  it('exactly one chevron-right glyph at rest, and it stays the same element after expanding', () => {
    render(<ModelAdjustments adjustments={ADJUSTMENTS} />)
    const button = within(screen.getByTestId('model-adjustments')).getAllByRole('button')[0]
    expect(button.querySelectorAll('.lucide-chevron-down')).toHaveLength(0)
    expect(button.querySelectorAll('.lucide-chevron-right')).toHaveLength(1)

    fireEvent.click(button)
    // Still exactly one glyph, still chevron-right (rotated), never swapped
    // for a different icon.
    expect(button.querySelectorAll('.lucide-chevron-down')).toHaveLength(0)
    const glyphs = button.querySelectorAll('.lucide-chevron-right')
    expect(glyphs).toHaveLength(1)
    expect(glyphs[0].getAttribute('class')).toMatch(/rotate-90/)
  })
})

describe('3. ModelAdjustments post-run-repairs toggle — one element, not a swap', () => {
  const POST_RUN_ONLY = [{ label: 'Edge weight', action: 'clamped', reason: 'out of range' }]

  it('exactly one chevron-right glyph, rotating, never a chevron-down swap', () => {
    render(<ModelAdjustments adjustments={[]} postRunRepairs={POST_RUN_ONLY} />)
    const toggle = screen.getByTestId('post-run-repairs-toggle')
    expect(toggle.querySelectorAll('.lucide-chevron-down')).toHaveLength(0)
    expect(toggle.querySelectorAll('.lucide-chevron-right')).toHaveLength(1)

    fireEvent.click(toggle)
    expect(toggle.querySelectorAll('.lucide-chevron-down')).toHaveLength(0)
    const glyphs = toggle.querySelectorAll('.lucide-chevron-right')
    expect(glyphs).toHaveLength(1)
    expect(glyphs[0].getAttribute('class')).toMatch(/rotate-90/)
  })
})
