/**
 * CompactOptionSpread — single-line option summary for V17 Analysis tab.
 *
 * Renders top-2 options with their win probabilities and rolls the rest up
 * into "others". Clicking "Compare options" switches the OutputsDock to the
 * Compare tab via uiStore.setActiveOutputTab('compare').
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CompactOptionSpread, canRenderCompactOptionSpread } from '../CompactOptionSpread'
import { useUIStore } from '../../../stores/uiStore'
import type { OptionResult } from '../types'

vi.mock('../../../canvas/utils/sandboxTelemetry', () => ({
  trackCompareOpened: vi.fn(),
  trackIssuesOpened: vi.fn(),
}))
import { trackCompareOpened } from '../../../canvas/utils/sandboxTelemetry'

function opt(id: string, label: string, winProbability: number | null): OptionResult {
  return {
    id,
    label,
    winProbability: winProbability ?? undefined,
    isRecommended: false,
    expected: 0,
    outcome: { p10: 0, p50: 0, p90: 0 },
    p10: 0,
    p50: 0,
    p90: 0,
  } as OptionResult
}

beforeEach(() => {
  useUIStore.setState({ activeOutputTab: 'results' })
  vi.mocked(trackCompareOpened).mockClear()
})

describe('CompactOptionSpread', () => {
  it('renders top-2 by win probability with an "others" rollup of the rest', () => {
    render(
      <CompactOptionSpread
        options={[
          opt('a', 'Tech Lead', 0.8),
          opt('b', 'Two Developers', 0.18),
          opt('c', 'Hold', 0.01),
          opt('d', 'Outsource', 0.01),
        ]}
      />,
    )
    const node = screen.getByTestId('compact-option-spread')
    expect(node.textContent).toContain('Option spread:')
    expect(node.textContent).toContain('Tech Lead 80%')
    expect(node.textContent).toContain('Two Developers 18%')
    expect(node.textContent).toContain('others 2%')
  })

  it('omits "others" when only two options carry a probability', () => {
    render(
      <CompactOptionSpread
        options={[opt('a', 'A', 0.7), opt('b', 'B', 0.3)]}
      />,
    )
    const node = screen.getByTestId('compact-option-spread')
    expect(node.textContent).toContain('A 70%')
    expect(node.textContent).toContain('B 30%')
    expect(node.textContent).not.toContain('others')
  })

  it('omits "others" when the rest rolls up to effectively zero', () => {
    render(
      <CompactOptionSpread
        options={[opt('a', 'A', 0.6), opt('b', 'B', 0.4), opt('c', 'C', 0.001)]}
      />,
    )
    const node = screen.getByTestId('compact-option-spread')
    expect(node.textContent).not.toContain('others')
  })

  it('returns null when fewer than two options carry a probability', () => {
    const { container: c1 } = render(
      <CompactOptionSpread options={[opt('a', 'A', 0.7)]} />,
    )
    expect(c1.firstChild).toBeNull()
    const { container: c2 } = render(
      <CompactOptionSpread options={[opt('a', 'A', 0.7), opt('b', 'B', null)]} />,
    )
    expect(c2.firstChild).toBeNull()
  })

  it('Compare options button switches the active output tab to "compare"', () => {
    render(
      <CompactOptionSpread options={[opt('a', 'A', 0.6), opt('b', 'B', 0.4)]} />,
    )
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    fireEvent.click(screen.getByTestId('compact-option-spread-compare'))
    expect(useUIStore.getState().activeOutputTab).toBe('compare')
  })

  it('Compare options button fires trackCompareOpened telemetry (code-review P2 #2: parity with OutputsDock tab-click)', () => {
    render(
      <CompactOptionSpread options={[opt('a', 'A', 0.6), opt('b', 'B', 0.4)]} />,
    )
    expect(trackCompareOpened).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('compact-option-spread-compare'))
    expect(trackCompareOpened).toHaveBeenCalledTimes(1)
  })

  it('sorts options by descending win probability regardless of input order', () => {
    render(
      <CompactOptionSpread
        options={[
          opt('c', 'C', 0.02),
          opt('a', 'A', 0.7),
          opt('b', 'B', 0.28),
        ]}
      />,
    )
    const text = screen.getByTestId('compact-option-spread').textContent ?? ''
    // First named option in the rendered string must be the highest-prob one.
    expect(text.indexOf('A 70%')).toBeLessThan(text.indexOf('B 28%'))
    expect(text.indexOf('B 28%')).toBeLessThan(text.indexOf('others 2%'))
  })

  it('filters out NaN and Infinity probabilities (defensive against degenerate upstream)', () => {
    const nanOpt = { ...opt('x', 'NaN-opt', 0), winProbability: NaN } as OptionResult
    const infOpt = { ...opt('y', 'Inf-opt', 0), winProbability: Infinity } as OptionResult
    render(
      <CompactOptionSpread
        options={[nanOpt, opt('a', 'A', 0.6), infOpt, opt('b', 'B', 0.4)]}
      />,
    )
    const text = screen.getByTestId('compact-option-spread').textContent ?? ''
    expect(text).toContain('A 60%')
    expect(text).toContain('B 40%')
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('Infinity')
    // Two finite options + two degenerate → no "others" segment.
    expect(text).not.toContain('others')
  })

  it('returns null when fewer than two finite probabilities remain after NaN filter', () => {
    const nanOpt = { ...opt('x', 'NaN-opt', 0), winProbability: NaN } as OptionResult
    const { container } = render(
      <CompactOptionSpread options={[opt('a', 'A', 0.6), nanOpt]} />,
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('canRenderCompactOptionSpread helper (code-review P1 #1)', () => {
  it('returns true when at least two options carry finite probabilities', () => {
    expect(canRenderCompactOptionSpread([opt('a', 'A', 0.6), opt('b', 'B', 0.4)]))
      .toBe(true)
  })

  it('returns false when fewer than two options carry probability at all', () => {
    expect(canRenderCompactOptionSpread([opt('a', 'A', 0.6), opt('b', 'B', null)]))
      .toBe(false)
  })

  it('returns false when all probabilities are non-finite (NaN / Infinity)', () => {
    const nanOpt = { ...opt('x', 'X', 0), winProbability: NaN } as OptionResult
    const infOpt = { ...opt('y', 'Y', 0), winProbability: Infinity } as OptionResult
    expect(canRenderCompactOptionSpread([nanOpt, infOpt])).toBe(false)
  })

  it('returns false for an empty options array', () => {
    expect(canRenderCompactOptionSpread([])).toBe(false)
  })
})
