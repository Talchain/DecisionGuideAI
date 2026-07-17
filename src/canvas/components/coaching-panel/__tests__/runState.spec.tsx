/**
 * F9 (UI brief 2026-07-16 item 3): the coaching-panel body gates on run
 * state with the same two primitives as the other dock surfaces: running
 * banner when coaching content is retained, skeleton when there is none.
 *
 * The panel stays render-only (Phase 0): run state arrives as PROPS, never
 * from a store, so the future mount PR decides the wiring exactly as it
 * decides the coaching envelope. While a run is in flight the panel must
 * never show the frozen "no coaching" empty line (that reads as a settled
 * answer the system does not hold), and it must never mint its own live
 * region (the dock-level announcer is the single voice).
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

import { CoachingPanel } from '../CoachingPanel'
import { typicalPanel } from '../__fixtures__/coaching.fixtures'

describe('F9: CoachingPanel run-state coverage', () => {
  it('positive control: idle and empty shows the empty line, no run treatment', () => {
    render(<CoachingPanel coaching={null} />)
    expect(screen.getByTestId('coaching-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
  })

  it('run in flight with retained signals: banner above the retained cards, never blanked', () => {
    render(<CoachingPanel coaching={typicalPanel} isRunning runStartedAt={Date.now()} />)
    expect(screen.getByTestId('analysis-running-banner')).toBeInTheDocument()
    expect(screen.getAllByTestId('coaching-card').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
  })

  it('run in flight with nothing retained: skeleton, and the frozen empty line is suppressed', () => {
    render(<CoachingPanel coaching={null} isRunning />)
    expect(screen.getByTestId('analysis-run-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('coaching-empty')).not.toBeInTheDocument()
  })

  it('settle: treatment gone, empty line back', () => {
    const { rerender } = render(<CoachingPanel coaching={null} isRunning />)
    rerender(<CoachingPanel coaching={null} isRunning={false} />)
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('coaching-empty')).toBeInTheDocument()
  })

  it('contributes no aria-live region of its own (the dock announcer is the single voice)', () => {
    const { container } = render(
      <CoachingPanel coaching={typicalPanel} isRunning runStartedAt={Date.now()} />,
    )
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(0)
  })
})
