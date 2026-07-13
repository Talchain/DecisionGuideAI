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

// Wave F-B: the hero rerun routes through the canonical runner (its old
// private useV2Run instance retired); running state derives from the store.
import {
  registerCanonicalRunner,
  __resetCanonicalRunnerForTests,
} from '../../../../canvas/analysis/canonicalRunRegistry'
import { useCanvasStore } from '../../../../canvas/store'

const runSpy = vi.fn(async (_opts?: import('../../../../canvas/analysis/canonicalRunRegistry').CanonicalRunOptions) => ({ status: 'dispatched' as const }))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isFocusNowPanelEnabled: vi.fn(() => true),
    isStrengthenPanelEnabled: vi.fn(() => false),
  }
})

import { isFocusNowPanelEnabled, isStrengthenPanelEnabled } from '@/flags'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { Recommendation } from '../../strengthen/strengthenTypes'

describe('AnalysisHero — interaction', () => {
  beforeEach(() => {
    runSpy.mockClear()
    __resetCanonicalRunnerForTests()
    registerCanonicalRunner(runSpy)
    useCanvasStore.getState().resultsReset()
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(true)
    vi.mocked(isStrengthenPanelEnabled).mockReturnValue(false)
    useStrengthenStore.getState()._reset()
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

    // Home/End jump to the first/last lens of the FULL strip (WAI-ARIA
    // APG) — unavailable lenses are focusable and selectable (their panel
    // explains itself), so End lands on What changed.
    const whatChangedTab = screen.getByTestId('hero-lens-tab-whatChanged')
    fireEvent.keyDown(goalTab, { key: 'End' })
    expect(whatChangedTab).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(whatChangedTab, { key: 'Home' })
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

  it('stale: content stays readable and interactive (v6); the footer re-run route remains', () => {
    render(<AnalysisHeroContainer data={makeHeroData()} isStale />)
    // Prototype v6 stale doctrine: NO lockout — tabs stay enabled and rows
    // keep their disclosures (the freshness strip owns the warning).
    expect(screen.getByTestId('hero-lens-tab-goal')).toBeEnabled()
    expect(screen.getByRole('button', { name: /Two developers/ })).toBeInTheDocument()
    // The footer swaps the generic focus-next for the retained re-run route.
    expect(screen.queryByTestId('hero-focus-next')).toBeNull()

    const rerun = screen.getByTestId('hero-rerun')
    fireEvent.click(rerun)
    expect(runSpy).toHaveBeenCalledTimes(1)
    expect(runSpy.mock.calls[0][0]).toMatchObject({ source: 'analysis-hero' })
  })

  it('stale: re-run is disabled while an analysis is already running', () => {
    useCanvasStore.getState().resultsAnalysing()
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

  it('focus-next is NOT an enabled clickable when the scroll target is absent (flag on)', () => {
    // Coaching panel flag on but its element absent (e.g. its error
    // boundary tripped): a keyboard/screen-reader user must not be offered
    // a dead affordance — the line degrades to plain text.
    render(<AnalysisHeroContainer data={makeHeroData()} />)
    expect(document.querySelector('[data-testid="focus-now-panel"]')).toBeNull()
    const focusNext = screen.getByTestId('hero-focus-next')
    expect(focusNext.tagName).toBe('P')
    expect(focusNext).toHaveTextContent('Focus next: review the top actions below.')
    // No button/link role anywhere in the footer line.
    expect(screen.queryByRole('button', { name: /actions panel below/i })).toBeNull()
  })

  it('focus-next degrades to plain text when the coaching panel is off (no dead link)', () => {
    vi.mocked(isFocusNowPanelEnabled).mockReturnValue(false)
    render(<AnalysisHeroContainer data={makeHeroData()} />)
    const focusNext = screen.getByTestId('hero-focus-next')
    expect(focusNext.tagName).toBe('P')
    expect(focusNext).toHaveTextContent('Focus next: review the top actions below.')
  })

  it('focus-next targets the Strengthen panel when its flag is on (retired FocusNow re-key)', () => {
    vi.mocked(isStrengthenPanelEnabled).mockReturnValue(true)
    const target = document.createElement('div')
    target.setAttribute('data-testid', 'strengthen-panel')
    const scrollSpy = vi.fn()
    target.scrollIntoView = scrollSpy
    document.body.appendChild(target)
    // A stale focus-now anchor must NOT satisfy the presence gate.
    const staleAnchor = document.createElement('div')
    staleAnchor.setAttribute('data-testid', 'focus-now-panel')
    staleAnchor.scrollIntoView = vi.fn()
    document.body.appendChild(staleAnchor)
    try {
      render(<AnalysisHeroContainer data={makeHeroData()} />)
      fireEvent.click(screen.getByTestId('hero-focus-next'))
      expect(scrollSpy).toHaveBeenCalledTimes(1)
      expect(staleAnchor.scrollIntoView).not.toHaveBeenCalled()
    } finally {
      target.remove()
      staleAnchor.remove()
    }
  })

  it('renders the Next-step row from the top Strengthen record and suppresses the generic line', () => {
    vi.mocked(isStrengthenPanelEnabled).mockReturnValue(true)
    const rec = (id: string, title: string, priority: number): Recommendation => ({
      id,
      helpType: 'clarify',
      title,
      signal: 's',
      whyNow: 'w',
      tryThis: 't',
      sourceLine: 'src',
      action: { kind: 'inline-edit', label: 'Do it' },
      targetId: null,
      priority,
    })
    useStrengthenStore
      .getState()
      .reconcile([rec('strengthen:b', 'Second entry', 2), rec('strengthen:a', 'Top entry', 1)], 'hash1')
    const target = document.createElement('div')
    target.setAttribute('data-testid', 'strengthen-panel')
    const scrollSpy = vi.fn()
    target.scrollIntoView = scrollSpy
    document.body.appendChild(target)
    try {
      render(<AnalysisHeroContainer data={makeHeroData()} />)
      // Mirrors the store's priority order — the SAME top the panel shows.
      expect(screen.getByTestId('hero-next-rec-title')).toHaveTextContent('Top entry')
      expect(screen.queryByTestId('hero-focus-next')).toBeNull()
      fireEvent.click(screen.getByTestId('hero-next-rec-open'))
      expect(scrollSpy).toHaveBeenCalledTimes(1)
    } finally {
      target.remove()
    }
  })

  it('no Next-step row when the Strengthen flag is off, even with active records', () => {
    vi.mocked(isStrengthenPanelEnabled).mockReturnValue(false)
    useStrengthenStore.getState().reconcile(
      [
        {
          id: 'strengthen:x',
          helpType: 'clarify',
          title: 'Hidden entry',
          signal: 's',
          whyNow: 'w',
          tryThis: 't',
          sourceLine: 'src',
          action: { kind: 'inline-edit', label: 'Do it' },
          targetId: null,
          priority: 1,
        },
      ],
      'hash1',
    )
    render(<AnalysisHeroContainer data={makeHeroData()} />)
    expect(screen.queryByTestId('hero-next-rec')).toBeNull()
  })

  it('renders nothing at all for the empty model (fail-closed mount)', () => {
    const { container } = render(
      <AnalysisHeroContainer data={makeHeroData({ options: [] })} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
