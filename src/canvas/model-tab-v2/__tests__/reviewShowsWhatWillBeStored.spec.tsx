/**
 * ⭐ REVIEW SHOWS WHAT WILL BE STORED (RC 5825756972, ruling 3).
 *
 * Witnessed 25 Sep 2026 02:30Z, local integration build, CEE `e39f6e0`, OpenAI,
 * Paul's pricing brief:
 * - "Price-driven churn rate" records no unit and no value.
 * - Typing `8%` reviewed as "Not set → 8%". Confirm stored
 *   `{value: 8, raw_value: 8}`, and the row then read "8".
 * - The commit sends `parseFloat(draft)` alone (`ModelTabV2Panel.tsx`
 *   `confirmEdit` → `proposeFactorValue(num)`), so the "%" never left the
 *   browser.
 * - The rerun was refused: "no recorded range or unit".
 *
 * Carrying the typed unit on the wire is framing (#1832). RC ruled it out for
 * tonight. So the Review step says plainly that the unit cannot be used, and
 * never advances to a proposal that would store something else.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { toModelRows } from '../adapters'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module rather than hand-listing its exports.
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { openOutlineGroups } from './openOutlineGroups'

// The bytes a user reads, spelled out rather than imported (trap 13b).
const UNIT_NOT_USABLE = "Olumi can't use a unit on this value yet. Enter the number on its own."

/** The witness: a drafted factor with no unit and no value (pricing's churn rate). */
const UNITLESS_ID = 'price_driven_churn_rate'
/** A factor that records its unit (pricing's "Paying seats", 100 seats). */
const SEATS_ID = 'paying_seats'

function factor(id: string, data: Record<string, unknown>): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Label ${id}`, kind: 'factor', category: 'observable', ...data },
  } as unknown as Node
}

const allNodes = (): Node[] => [
  factor(UNITLESS_ID, {}),
  factor(SEATS_ID, { observedState: { value: 0.01, raw_value: 100, unit: 'seats', cap: 10000 } }),
]
const allEdges = (): Edge[] => []

function renderPanel() {
  render(<ModelTabV2Panel nodes={allNodes()} edges={allEdges()} goalThreshold={null} />)
  openOutlineGroups()
}

function typeInto(id: string, draft: string): HTMLElement {
  fireEvent.click(screen.getByTestId(`model-row-v2-${id}-value`))
  const input = screen.getByTestId(`model-row-v2-${id}-value-input`)
  fireEvent.change(input, { target: { value: draft } })
  return input
}

const blockedText = (id: string): string | null =>
  screen.queryByTestId(`model-row-v2-${id}-value-blocked`)?.textContent ?? null
const confirmButton = (id: string) => screen.queryByTestId(`model-row-v2-${id}-confirm`)
const rowFor = (id: string) => toModelRows({ nodes: allNodes(), edges: [], goalThreshold: null }).find(r => r.id === id)

beforeEach(() => {
  vi.clearAllMocks()
  useCanvasStore.setState({ nodes: allNodes(), edges: allEdges() } as never, false)
})
afterEach(() => cleanup())

describe('PRECONDITIONS', () => {
  it('the adapter marks the unitless factor, and only that one', () => {
    expect(rowFor(UNITLESS_ID)?.declaresNoUnit).toBe(true)
    expect(rowFor(SEATS_ID)?.declaresNoUnit).toBeUndefined()
    expect('declaresNoUnit' in (rowFor(SEATS_ID) ?? {})).toBe(false)
  })
})

describe('⭐ a unit typed into a factor that records none is refused at Review, in plain words', () => {
  it('⭐ "8%" → the sentence, and Review does not advance to a proposal', () => {
    renderPanel()
    const input = typeInto(UNITLESS_ID, '8%')
    expect(blockedText(UNITLESS_ID)).toBe(UNIT_NOT_USABLE)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(confirmButton(UNITLESS_ID), 'no "Not set → 8%" proposal to confirm').toBeNull()
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it.each(['8 %', '95 seats', '£40', '10k'])('"%s" on the unitless factor → the same sentence', (draft) => {
    renderPanel()
    typeInto(UNITLESS_ID, draft)
    expect(blockedText(UNITLESS_ID)).toBe(UNIT_NOT_USABLE)
  })

  it('OPPOSITE CONTROL: the bare number "8" on the same factor reviews normally', () => {
    renderPanel()
    const input = typeInto(UNITLESS_ID, '8')
    expect(blockedText(UNITLESS_ID)).not.toBe(UNIT_NOT_USABLE)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(confirmButton(UNITLESS_ID), 'the bare number reaches a proposal').not.toBeNull()
  })

  it('CONTROL: a factor that records its unit is unchanged ("95 seats" is not refused for its unit)', () => {
    renderPanel()
    typeInto(SEATS_ID, '95 seats')
    expect(blockedText(SEATS_ID)).not.toBe(UNIT_NOT_USABLE)
  })

  it('ORDER KEPT: no number at all still says "Enter a number"', () => {
    renderPanel()
    typeInto(UNITLESS_ID, 'abc')
    expect(blockedText(UNITLESS_ID)).toBe('Enter a number to review this change')
  })
})
