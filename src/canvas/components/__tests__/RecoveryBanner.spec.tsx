/**
 * P0-2: Autosave Recovery Banner Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecoveryBanner } from '../RecoveryBanner'
import * as scenarios from '../../store/scenarios'

// Mock scenarios module
vi.mock('../../store/scenarios', () => ({
  hasUnsavedWork: vi.fn(),
  loadAutosave: vi.fn(),
  clearAutosave: vi.fn()
}))

// Mock the store module
vi.mock('../../store', () => {
  const mockReseedIds = vi.fn()
  const mockGetState = vi.fn(() => ({
    reseedIds: mockReseedIds
  }))

  return {
    useCanvasStore: Object.assign(
      vi.fn(() => ({
        getState: mockGetState
      })),
      {
        getState: mockGetState,
        setState: vi.fn(),
        _mockReseedIds: mockReseedIds // Expose for testing
      }
    )
  }
})

import { useCanvasStore } from '../../store'

// Extract mock functions
const mockReseedIds = (useCanvasStore as any)._mockReseedIds

describe('RecoveryBanner (P0-2)', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear()
    vi.clearAllMocks()

    // Reset mock
    mockReseedIds.mockClear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('shows banner when autosave is available and not dismissed', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: fiveMinutesAgo,
      scenarioId: 'test-scenario',
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    render(<RecoveryBanner />)

    expect(screen.getByTestId('autosave-recovery-banner')).toBeInTheDocument()
    expect(screen.getByText('Autosave recovery available')).toBeInTheDocument()
    expect(screen.getByText(/We found a more recent autosave from 5 minutes ago/)).toBeInTheDocument()
  })

  it('does not show banner when no unsaved work', () => {
    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(false)

    const { container } = render(<RecoveryBanner />)

    expect(container.firstChild).toBeNull()
  })

  it('does not show banner when dismissed this session', () => {
    sessionStorage.setItem('autosave-recovery-dismissed', 'true')

    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: Date.now(),
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    const { container } = render(<RecoveryBanner />)

    expect(container.firstChild).toBeNull()
  })

  it('recovers autosave when Recover is clicked', () => {
    const autosaveData = {
      timestamp: Date.now(),
      scenarioId: 'test-scenario',
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    }

    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue(autosaveData)

    render(<RecoveryBanner />)

    const recoverButton = screen.getByTestId('btn-recover-autosave')
    fireEvent.click(recoverButton)

    // Should clear autosave
    expect(scenarios.clearAutosave).toHaveBeenCalled()

    // Should mark as dismissed in sessionStorage
    expect(sessionStorage.getItem('autosave-recovery-dismissed')).toBe('true')

    // Should call reseedIds with autosave data
    expect(mockReseedIds).toHaveBeenCalledWith(autosaveData.nodes, autosaveData.edges)
  })

  it('dismisses banner when Dismiss is clicked', () => {
    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: Date.now(),
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    render(<RecoveryBanner />)

    const dismissButton = screen.getByTestId('btn-dismiss-recovery')
    fireEvent.click(dismissButton)

    // Should NOT clear autosave (only dismiss)
    expect(scenarios.clearAutosave).not.toHaveBeenCalled()

    // Should mark as dismissed in sessionStorage
    expect(sessionStorage.getItem('autosave-recovery-dismissed')).toBe('true')
  })

  it('dismisses banner when X button is clicked', () => {
    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: Date.now(),
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    render(<RecoveryBanner />)

    const closeButton = screen.getByLabelText('Close recovery banner')
    fireEvent.click(closeButton)

    // Should mark as dismissed
    expect(sessionStorage.getItem('autosave-recovery-dismissed')).toBe('true')
  })

  it('displays "just now" for very recent autosaves', () => {
    const thirtySecondsAgo = Date.now() - 30 * 1000

    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: thirtySecondsAgo,
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    render(<RecoveryBanner />)

    expect(screen.getByText(/just now/)).toBeInTheDocument()
  })

  it('displays minutes for autosaves < 1 hour old', () => {
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000

    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: thirtyMinutesAgo,
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    render(<RecoveryBanner />)

    expect(screen.getByText(/30 minutes ago/)).toBeInTheDocument()
  })

  it('displays hours for autosaves > 1 hour old', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000

    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: twoHoursAgo,
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    render(<RecoveryBanner />)

    expect(screen.getByText(/2 hours ago/)).toBeInTheDocument()
  })

  it('has proper ARIA attributes for accessibility', () => {
    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: Date.now(),
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    render(<RecoveryBanner />)

    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByLabelText('Close recovery banner')).toBeInTheDocument()
  })

  it('does not show banner for empty autosave', () => {
    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: Date.now(),
      nodes: [],
      edges: []
    })

    const { container } = render(<RecoveryBanner />)

    expect(container.firstChild).toBeNull()
  })

  it('uses singular "minute" for 1 minute ago', () => {
    const oneMinuteAgo = Date.now() - 60 * 1000

    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: oneMinuteAgo,
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    render(<RecoveryBanner />)

    expect(screen.getByText(/1 minute ago/)).toBeInTheDocument()
    expect(screen.queryByText(/1 minutes ago/)).not.toBeInTheDocument()
  })

  it('uses singular "hour" for 1 hour ago', () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue({
      timestamp: oneHourAgo,
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    })

    render(<RecoveryBanner />)

    expect(screen.getByText(/1 hour ago/)).toBeInTheDocument()
    expect(screen.queryByText(/1 hours ago/)).not.toBeInTheDocument()
  })

  /**
   * C10 P1 Polish: Session-scoped dismissal test
   * Verifies sessionStorage prevents repeat prompts after navigation
   */
  it('does not show banner after navigation when dismissed in same session (C10)', () => {
    const autosaveData = {
      timestamp: Date.now(),
      nodes: [{ id: '1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    }

    vi.mocked(scenarios.hasUnsavedWork).mockReturnValue(true)
    vi.mocked(scenarios.loadAutosave).mockReturnValue(autosaveData)

    // First render: banner shows
    const { unmount } = render(<RecoveryBanner />)
    expect(screen.getByTestId('autosave-recovery-banner')).toBeInTheDocument()

    // User dismisses banner
    const dismissButton = screen.getByTestId('btn-dismiss-recovery')
    fireEvent.click(dismissButton)

    // Verify dismissal is in sessionStorage (not localStorage)
    expect(sessionStorage.getItem('autosave-recovery-dismissed')).toBe('true')
    expect(localStorage.getItem('autosave-recovery-dismissed')).toBeNull()

    // Simulate navigation: unmount and re-render
    unmount()
    render(<RecoveryBanner />)

    // Banner should NOT re-appear (same session)
    expect(screen.queryByTestId('autosave-recovery-banner')).not.toBeInTheDocument()

    // Simulate browser close/reopen: clear sessionStorage (but not localStorage)
    sessionStorage.clear()
    render(<RecoveryBanner />)

    // Banner SHOULD re-appear in new session
    expect(screen.getByTestId('autosave-recovery-banner')).toBeInTheDocument()
  })
})
