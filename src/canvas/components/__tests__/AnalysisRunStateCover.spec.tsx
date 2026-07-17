/**
 * F9 (UI brief 2026-07-16 item 3): AnalysisRunStateCover — the shared
 * banner-or-skeleton in-flight treatment for surfaces OUTSIDE the Analysis
 * tab (Compare tab, Model tab, coaching panel).
 *
 * The rule (brief item 3 build (ii)): running banner when content is
 * retained behind it, skeleton when nothing is retained. Both forms are
 * VISUAL ONLY here: the dock-level AnalysisRunAnnouncer is the single
 * aria-live voice for run transitions, so neither form may mint its own
 * live region (the exact stacked-narration class Wave1-L2 removed).
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

import { AnalysisRunStateCover } from '../AnalysisRunStateCover'

describe('F9: AnalysisRunStateCover', () => {
  it('renders nothing when no run is in flight', () => {
    const { container } = render(
      <AnalysisRunStateCover isRunning={false} contentRetained />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the running banner when content is retained, without its own live region', () => {
    render(
      <AnalysisRunStateCover isRunning contentRetained startedAt={Date.now()} />,
    )
    const banner = screen.getByTestId('analysis-running-banner')
    expect(banner).toBeInTheDocument()
    // The dock announcer is the one voice; the reused banner must not
    // announce (that would be one live region per surface).
    expect(banner).not.toHaveAttribute('aria-live')
    expect(banner).not.toHaveAttribute('role')
    expect(screen.queryByTestId('analysis-run-skeleton')).not.toBeInTheDocument()
  })

  it('shows the skeleton when nothing is retained, decorative only', () => {
    render(<AnalysisRunStateCover isRunning contentRetained={false} />)
    const skeleton = screen.getByTestId('analysis-run-skeleton')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveAttribute('aria-hidden', 'true')
    expect(skeleton.querySelector('[aria-live]')).toBeNull()
    expect(skeleton.querySelector('[role="status"]')).toBeNull()
    expect(screen.queryByTestId('analysis-running-banner')).not.toBeInTheDocument()
  })

  it('narrates from the true run clock, not mount time (mid-run mount shows the escalated stage)', () => {
    // A run that started 45s ago must show the 40s-stage copy on its FIRST
    // frame; a mount-time clock would show the fresh-start line (the #327
    // round-2 regression class).
    render(
      <AnalysisRunStateCover
        isRunning
        contentRetained
        startedAt={Date.now() - 45_000}
      />,
    )
    expect(screen.getByTestId('analysis-narration')).toHaveTextContent(
      'Still analysing',
    )
  })
})
