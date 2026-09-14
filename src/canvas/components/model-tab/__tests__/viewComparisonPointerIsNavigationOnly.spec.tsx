/**
 * The Model-tab pointer: present only when there is something to point AT, and
 * worded so it claims nothing.
 *
 * ⚠ THE SECOND HALF IS THE ONE A GREEN SUITE MISSES. A spec that only checked
 * "the button renders" would pass just as happily on "Review what caused the
 * change" — which presupposes a cause the producer refuses to attribute on four
 * of its five cases. So the wording is asserted, not just the presence.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { ViewComparisonPointer, VIEW_COMPARISON_TESTID } from '../ViewComparisonPointer'
import { useCanvasStore } from '../../../store'
import { useUIStore } from '../../../../stores/uiStore'

const DELTA = { attribution_case: 'C2_unpaired' } as unknown as RunDelta

function seed(over: Partial<{ runDelta: unknown; results: unknown; currentScenarioId: string | null }> = {}): void {
  useCanvasStore.setState({
    runDelta: { delta: DELTA, analysisHash: 'hash-A', scenarioId: 'scn-1' },
    results: { hash: 'hash-A' },
    currentScenarioId: 'scn-1',
    ...over,
  } as never)
}

beforeEach(() => { seed() })

describe('it points only at a comparison that exists and is current', () => {
  it('renders when the stored delta is about the displayed analysis', () => {
    render(<ViewComparisonPointer />)
    expect(screen.getByTestId(VIEW_COMPARISON_TESTID)).toBeTruthy()
  })

  it('renders NOTHING when there is no delta', () => {
    seed({ runDelta: null })
    const { container } = render(<ViewComparisonPointer />)
    expect(container.innerHTML).toBe('')
  })

  it('renders NOTHING when the delta is about a superseded analysis', () => {
    seed({ results: { hash: 'hash-B' } })
    const { container } = render(<ViewComparisonPointer />)
    expect(container.innerHTML).toBe('')
  })

  it('renders NOTHING when the scenario has moved on', () => {
    seed({ currentScenarioId: 'scn-2' })
    const { container } = render(<ViewComparisonPointer />)
    expect(container.innerHTML).toBe('')
  })
})

describe('the wording is navigation and nothing more', () => {
  it('says "View comparison"', () => {
    render(<ViewComparisonPointer />)
    expect(screen.getByTestId(VIEW_COMPARISON_TESTID).textContent?.trim()).toBe('View comparison')
  })

  it('⛔ never presupposes a cause — the compare-tab precedent this refuses to copy', () => {
    render(<ViewComparisonPointer />)
    const text = screen.getByTestId(VIEW_COMPARISON_TESTID).textContent ?? ''
    expect(text).not.toMatch(/caused|because|due to|your change|impact|effect of/i)
  })

  it('is a real button, so it reads as pressable', () => {
    render(<ViewComparisonPointer />)
    expect(screen.getByTestId(VIEW_COMPARISON_TESTID).tagName).toBe('BUTTON')
  })
})

describe('it actually navigates', () => {
  it('sends the reader to the Reasoning tab, where the section lives', () => {
    const spy = vi.spyOn(useUIStore.getState(), 'setActiveOutputTab')
    render(<ViewComparisonPointer />)
    fireEvent.click(screen.getByTestId(VIEW_COMPARISON_TESTID))
    expect(spy).toHaveBeenCalledWith('analysisNew')
  })
})
