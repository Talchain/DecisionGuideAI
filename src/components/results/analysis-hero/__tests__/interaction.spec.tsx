/**
 * Interaction — disclosure rows (one open at a time, keyboard), lens tabs
 * (roving arrows, local-state-only switching, no remount), stale
 * soft-disable with the re-run route, and safe focus-next degradation.
 *
 * Rendered through the real AnalysisHeroContainer with useV2Run and the
 * coaching-panel flag mocked, so the wiring under test is the shipped one.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnalysisHeroContainer } from '../AnalysisHeroContainer'
import { makeHeroData } from '../__fixtures__/hero.fixtures'

const runSpy = vi.fn()
let running = false

vi.mock('@/canvas/hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: runSpy, isRunning: running }),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return { ...actual, isFocusNowPanelEnabled: vi.fn(() => true) }
})

import { isFocusNowPanelEnabled } from '@/flags'

describe('AnalysisHero — interaction', () => {
  beforeEach(() => {
    runSpy.mockClear()
    running = false
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(true)
  })

  it('opens and closes option detail, keeping one row open at a time', () => {
    render(<AnalysisHeroContainer data={makeHeroData()} />)
    const rowA = screen.getByRole('button', { name: /Two developers/ })
    const rowB = screen.getByRole('button', { name: /Upskill the team/ })

    fireEvent.click(rowA)
    expect(rowA).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByTestId('hero-option-detail')).toHaveLength(1)

    fireEvent.click(rowB)
    expect(rowB).toHaveAttribute('aria-expanded', 'true')
    expect(rowA).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByTestId('hero-option-detail')).toHaveLength(1)

    fireEvent.click(rowB)
    expect(rowB).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('hero-option-detail')).toBeNull()
  })

  it('moves lens selection with arrow keys (roving tabindex)', () => {
    render(<AnalysisHeroContainer data={makeHeroData()} />)
    const goalTab = screen.getByTestId('hero-lens-tab-goal')
    const outcomeTab = screen.getByTestId('hero-lens-tab-outcome')
    expect(goalTab).toHaveAttribute('aria-selected', 'true')
    expect(outcomeTab).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(goalTab, { key: 'ArrowRight' })
    expect(outcomeTab).toHaveAttribute('aria-selected', 'true')
    expect(outcomeTab).toHaveAttribute('tabindex', '0')
    expect(goalTab).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(outcomeTab, { key: 'ArrowLeft' })
    expect(goalTab).toHaveAttribute('aria-selected', 'true')

    // Home/End jump to the first/last lens (WAI-ARIA APG).
    fireEvent.keyDown(goalTab, { key: 'End' })
    expect(outcomeTab).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(outcomeTab, { key: 'Home' })
    expect(goalTab).toHaveAttribute('aria-selected', 'true')

    // Up/Down are NOT hijacked on a horizontal tablist (page scroll keeps working).
    fireEvent.keyDown(goalTab, { key: 'ArrowDown' })
    expect(goalTab).toHaveAttribute('aria-selected', 'true')
  })

  it('lens switching is local state only: same row DOM nodes, no analysis call', () => {
    render(<AnalysisHeroContainer data={makeHeroData()} />)
    const row1 = screen.getByTestId('hero-option-row-1')
    const row2 = screen.getByTestId('hero-option-row-2')

    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    // Rows persist (values morph) — no remount of the chart.
    expect(screen.getByTestId('hero-option-row-1')).toBe(row1)
    expect(screen.getByTestId('hero-option-row-2')).toBe(row2)
    // Numbering is stable across lens switches (presentation order).
    expect(row1).toHaveTextContent(/^1/)
    expect(row2).toHaveTextContent(/^2/)
    expect(runSpy).not.toHaveBeenCalled()
  })

  it('stale: locks lens and row interactions and routes focus-next to re-run', () => {
    render(<AnalysisHeroContainer data={makeHeroData()} isStale />)
    // Lens tabs disabled; rows render as non-interactive (no disclosure buttons).
    expect(screen.getByTestId('hero-lens-tab-goal')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Two developers/ })).toBeNull()
    expect(screen.queryByTestId('hero-focus-next')).toBeNull()

    const rerun = screen.getByTestId('hero-rerun')
    fireEvent.click(rerun)
    expect(runSpy).toHaveBeenCalledTimes(1)
  })

  it('stale: re-run is disabled while an analysis is already running', () => {
    running = true
    render(<AnalysisHeroContainer data={makeHeroData()} isStale />)
    expect(screen.getByTestId('hero-rerun')).toBeDisabled()
  })

  it('focus-next scrolls to the mounted coaching panel', () => {
    const target = document.createElement('div')
    target.setAttribute('data-testid', 'focus-now-panel')
    const scrollSpy = vi.fn()
    target.scrollIntoView = scrollSpy
    document.body.appendChild(target)
    try {
      render(<AnalysisHeroContainer data={makeHeroData()} />)
      const focusNext = screen.getByTestId('hero-focus-next')
      expect(focusNext.tagName).toBe('BUTTON')
      fireEvent.click(focusNext)
      expect(scrollSpy).toHaveBeenCalledTimes(1)
    } finally {
      target.remove()
    }
  })

  it('focus-next degrades to plain text when the coaching panel is off (no dead link)', () => {
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(false)
    render(<AnalysisHeroContainer data={makeHeroData()} />)
    const focusNext = screen.getByTestId('hero-focus-next')
    expect(focusNext.tagName).toBe('P')
    expect(focusNext).toHaveTextContent('Focus next: review the top actions below.')
  })

  it('renders nothing at all for the empty model (fail-closed mount)', () => {
    const { container } = render(
      <AnalysisHeroContainer data={makeHeroData({ options: [] })} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
