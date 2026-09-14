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

describe('⛔ the pointer and the section must not be able to disagree', () => {
  /**
   * They share the predicate `runDeltaDescribesDisplayedAnalysis` but NOT its
   * arguments. The pointer reads `results.hash` off the store itself; the
   * Reasoning tab is handed `responseHash` as a prop by `OutputsDock`. Today
   * those are the same value only because the dock happens to pass the same
   * store read — and nothing pinned it, so a future edit that sourced the prop
   * from anywhere else would leave one surface offering a comparison the other
   * refuses to show, with no red.
   *
   * ⚠ SOURCE-LEVEL, DELIBERATELY. The divergence is in an ARGUMENT at a call
   * site, not in behaviour reachable from either component alone; a render test
   * of both cannot observe it, because both would be fed the same fixture.
   */
  const readSrc = (rel: string): string => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolve } = require('node:path') as typeof import('node:path')
    const text = readFileSync(resolve(__dirname, rel), 'utf8')
    expect(text.length).toBeGreaterThan(1000) // the read is not silently empty
    return text
  }

  it('the dock feeds the Reasoning tab from the SAME store read the pointer uses', () => {
    expect(readSrc('../../OutputsDock.tsx')).toMatch(/responseHash=\{results\?\.hash\}/)
  })

  it('and the pointer reads that same field, not a second notion of freshness', () => {
    expect(readSrc('../ViewComparisonPointer.tsx')).toMatch(/useCanvasStore\(\(s\) => s\.results\?\.hash\)/)
  })

  it('contrast — the probe can tell a present binding from an absent one', () => {
    expect(readSrc('../ViewComparisonPointer.tsx')).not.toMatch(/s\.someOtherHashThatDoesNotExist/)
  })
})
