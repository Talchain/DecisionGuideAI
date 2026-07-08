// Top strip — segmented-control a11y (radiogroup + arrow keys), state pills
// (Example data / Results out of date — the A7 top-strip leg), exit control.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { useViewLevelStore } from '../state/viewLevelStore'
import type { GraphExperienceVM, AnalysisContextVM } from '../vm/types'

const useVMMock = vi.fn<[], GraphExperienceVM>()
vi.mock('../vm/useGraphExperienceVM', () => ({
  useGraphExperienceVMContext: () => useVMMock(),
}))

import { VNextTopStrip } from '../VNextTopStrip'

configureAxe({ rules: { 'color-contrast': { enabled: false } } })

function makeVM(overrides: { provenance?: 'live' | 'fixture'; analysis?: Partial<AnalysisContextVM> } = {}): GraphExperienceVM {
  return {
    provenance: overrides.provenance ?? 'live',
    analysis: {
      displayState: 'complete',
      hasResults: true,
      isStaleResult: false,
      leadingOptionId: null,
      leadingOptionLabel: null,
      goalThreshold: null,
      ...overrides.analysis,
    },
    optionCards: {},
    edgeVisuals: {},
    relationshipCards: {},
  }
}

beforeEach(() => {
  sessionStorage.clear()
  useViewLevelStore.setState({ level: 'simple' })
})

describe('view level toggle', () => {
  it('is a labelled radiogroup with Simple checked by default', () => {
    useVMMock.mockReturnValue(makeVM())
    render(<VNextTopStrip onExit={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: 'View level' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Simple' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Detailed' })).toHaveAttribute('aria-checked', 'false')
  })

  it('click switches level; arrow keys move within the group', () => {
    useVMMock.mockReturnValue(makeVM())
    render(<VNextTopStrip onExit={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Detailed' }))
    expect(useViewLevelStore.getState().level).toBe('detailed')

    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' })
    expect(useViewLevelStore.getState().level).toBe('simple')
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' })
    expect(useViewLevelStore.getState().level).toBe('detailed')
  })
})

describe('state pills', () => {
  it('shows the stale pill iff results are stale (A7 top-strip leg)', () => {
    useVMMock.mockReturnValue(makeVM())
    const { unmount } = render(<VNextTopStrip onExit={() => {}} />)
    expect(screen.queryByTestId('vnext-stale-pill')).toBeNull()
    unmount()

    useVMMock.mockReturnValue(makeVM({ analysis: { displayState: 'results_stale', isStaleResult: true } }))
    render(<VNextTopStrip onExit={() => {}} />)
    expect(screen.getByTestId('vnext-stale-pill')).toHaveTextContent('Results out of date')
  })

  it('shows the fixture banner iff provenance is fixture', () => {
    useVMMock.mockReturnValue(makeVM())
    const { unmount } = render(<VNextTopStrip onExit={() => {}} />)
    expect(screen.queryByTestId('vnext-fixture-banner')).toBeNull()
    unmount()

    useVMMock.mockReturnValue(makeVM({ provenance: 'fixture' }))
    render(<VNextTopStrip onExit={() => {}} />)
    expect(screen.getByTestId('vnext-fixture-banner')).toHaveTextContent('Example data — not analysis output')
  })
})

describe('exit control', () => {
  it('fires onExit', () => {
    useVMMock.mockReturnValue(makeVM())
    const onExit = vi.fn()
    render(<VNextTopStrip onExit={onExit} />)
    fireEvent.click(screen.getByTestId('vnext-exit'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

describe('accessibility', () => {
  it('has no axe violations', async () => {
    useVMMock.mockReturnValue(makeVM({ provenance: 'fixture', analysis: { isStaleResult: true } }))
    const { container } = render(<VNextTopStrip onExit={() => {}} />)
    expect((await axe(container)).violations).toEqual([])
  })
})
