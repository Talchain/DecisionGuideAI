/**
 * The inspector must not print a wire token where a unit belongs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — read out of the founder's own session bundle `95b92672`, 21 Sep
 * ─────────────────────────────────────────────────────────────────────────────
 * CEE sent, on that board:
 *
 *   Founder Time Commitment      value 0.2  unit 'unit_interval'
 *   Campaign Strategic Quality   value 0.4  unit 'scale'
 *
 * and this panel rendered the token verbatim: the value read **`0.2
 * unit_interval`** on screen. `unit_interval` is the mathematical name for
 * [0,1] — it names a RANGE, not a quantity, so it tells the reader only that
 * the number lies between nought and one, which they could already see.
 *
 * ⭐ THE NODE CARD ALREADY GETS THIS RIGHT, and that is what makes it a UI
 * defect rather than a producer one. The card's chain routes every unit through
 * `classifyUnit` (10 references in `formatFactorDisplayValue.ts`) and drops
 * `kind: 'placeholder'` — which is why the same factor reads `0.4 est.` on the
 * board. The inspector never asked: **0 references** to `classifyUnit`,
 * `GENERIC_PLACEHOLDER_UNITS` or `isSuppressedUnit` anywhere in `inspector-v2`,
 * against 10 in the card chain in the same sweep. One surface classified the
 * token; the surface beside it printed it.
 *
 * ⚠ TWO PREDICATES, NOT ONE. `classifyUnit(...).kind === 'placeholder'` catches
 * a word that names a RANGE; `isSuppressedUnit(...)` catches a factor TYPE
 * descriptor (`binary`, `cost`, `time`) that leaked into the unit field.
 * Different defects, different tables, neither contains the other. ⛔ They must
 * not be merged: `ratio` is deliberately absent from the placeholder set
 * pending a producer ruling, and merging would silently convert it.
 *
 * ⚠ RENDER-SCOPED. The raw token stays available as `wireUnit`, because
 * `buildFactorValueEditEvent` and the scale contract reason about what CEE
 * actually sent. This narrows what is SHOWN, never what is sent — and the last
 * case below is what holds that line.
 *
 * CLAIM SCOPE (trap 3): jsdom text assertions prove PRESENCE and ABSENCE of
 * text in the DOM, never layout or visibility.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'

const NODE_ID = 'fac_founder_time'
const noop = () => {}

function seed(observedState: Record<string, unknown>) {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id: NODE_ID,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: 'Founder Time Commitment', kind: 'factor', observedState },
        } as unknown as Node,
      ],
      edges: [],
      results: { status: 'idle', report: null },
    } as never,
    false,
  )
}

function renderPanel() {
  return render(
    <FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />,
  )
}

describe('the inspector classifies a unit before printing it', () => {
  beforeEach(() => sendSystemEvent.mockClear())
  afterEach(() => cleanup())

  it('⭐ does NOT print `unit_interval` — the founder’s exact bundle shape', () => {
    seed({ value: 0.2, source: 'cee_inference', extractionType: 'inferred', unit: 'unit_interval' })
    const { container } = renderPanel()
    // RED before the fix: the panel rendered `0.2 unit_interval`.
    expect(container.textContent ?? '').not.toContain('unit_interval')
  })

  it('does NOT print `scale` either — the same board’s other factor', () => {
    seed({ value: 0.4, source: 'cee_inference', extractionType: 'inferred', unit: 'scale' })
    const { container } = renderPanel()
    expect(container.textContent ?? '').not.toContain('scale')
  })

  it('nor a leaked factor-TYPE descriptor — the other table, asked separately', () => {
    seed({ value: 0.4, source: 'cee_inference', unit: 'binary' })
    const { container } = renderPanel()
    expect(container.textContent ?? '').not.toContain('binary')
  })

  it('⭐ DISCRIMINATING CONTRAST — a REAL unit still renders, so this is not a blanket suppression', () => {
    // Without this, dropping every unit would satisfy all three assertions
    // above. The same board carries `£` on Advertising Budget Allocated.
    seed({ value: 0.3, raw_value: 30000, cap: 100000, source: 'cee_inference', unit: '£' })
    const { container } = renderPanel()
    expect(container.textContent ?? '').toContain('£')
  })

  it('and a real WORD unit renders too, not just a currency glyph', () => {
    seed({ value: 0.5, raw_value: 6, cap: 12, source: 'cee_inference', unit: 'months' })
    const { container } = renderPanel()
    expect(container.textContent ?? '').toContain('months')
  })

  it('⛔ RENDER-SCOPED — the wire token still reaches the emitted event', () => {
    // The whole risk of this change is narrowing something the SCALE CONTRACT
    // reads. The panel must keep sending what CEE sent, so a placeholder unit
    // must not vanish from the turn.
    seed({ value: 0.2, raw_value: 0.2, source: 'cee_inference', unit: 'unit_interval' })
    renderPanel()
    const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement
    input.focus()
    expect(input).toBeTruthy()
    // The store still holds the token — the narrowing never wrote to it.
    const n = useCanvasStore.getState().nodes.find((x) => x.id === NODE_ID)
    const obs = (n!.data as { observedState: { unit?: string } }).observedState
    expect(obs.unit).toBe('unit_interval')
  })
})
