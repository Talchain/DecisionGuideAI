/**
 * StatusBar — unit tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBar } from '../StatusBar'

describe('StatusBar', () => {
  it('renders nothing when all counts are zero', () => {
    const { container } = render(
      <StatusBar
        factorsToVerify={0}
        fragileEdgeCount={0}
        contestedCount={0}
        evpiMap={new Map()}
        recommendationStability={null}
        hasAnalysisData={false}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows "to verify" segment pre-analysis', () => {
    render(
      <StatusBar
        factorsToVerify={3}
        fragileEdgeCount={0}
        contestedCount={0}
        evpiMap={new Map()}
        recommendationStability={null}
        hasAnalysisData={false}
      />
    )
    expect(screen.getByTestId('status-verify')).toHaveTextContent('3 to verify')
  })

  it('hides contested and EVPI pre-analysis', () => {
    render(
      <StatusBar
        factorsToVerify={1}
        fragileEdgeCount={0}
        contestedCount={2}
        evpiMap={new Map([['f1', 8], ['f2', 5]])}
        recommendationStability={0.71}
        hasAnalysisData={false}
      />
    )
    expect(screen.queryByTestId('status-contested')).not.toBeInTheDocument()
    expect(screen.queryByTestId('status-evpi')).not.toBeInTheDocument()
    expect(screen.queryByTestId('status-stability')).not.toBeInTheDocument()
  })

  it('shows all segments post-analysis', () => {
    render(
      <StatusBar
        factorsToVerify={2}
        fragileEdgeCount={4}
        contestedCount={1}
        evpiMap={new Map([['f1', 8], ['f2', 5], ['f3', 3], ['f4', 1]])}
        recommendationStability={0.71}
        hasAnalysisData={true}
      />
    )
    expect(screen.getByTestId('status-verify')).toHaveTextContent('2 to verify')
    expect(screen.getByTestId('status-fragile')).toHaveTextContent('4 fragile')
    expect(screen.getByTestId('status-contested')).toHaveTextContent('1 contested')
    // Top 3 EVPI: 8 + 5 + 3 = 16
    expect(screen.getByTestId('status-evpi')).toHaveTextContent('16pp via EVPI')
    expect(screen.getByTestId('status-stability')).toHaveTextContent('71% stability')
  })

  it('hides contested when 0', () => {
    render(
      <StatusBar
        factorsToVerify={1}
        fragileEdgeCount={0}
        contestedCount={0}
        evpiMap={new Map()}
        recommendationStability={0.5}
        hasAnalysisData={true}
      />
    )
    expect(screen.queryByTestId('status-contested')).not.toBeInTheDocument()
  })

  it('clicking a segment calls scrollIntoView', () => {
    const mockEl = { scrollIntoView: vi.fn() }
    vi.spyOn(document, 'querySelector').mockReturnValue(mockEl as unknown as HTMLElement)

    render(
      <StatusBar
        factorsToVerify={2}
        fragileEdgeCount={0}
        contestedCount={0}
        evpiMap={new Map()}
        recommendationStability={null}
        hasAnalysisData={false}
      />
    )
    fireEvent.click(screen.getByTestId('status-verify'))
    expect(mockEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })
})
