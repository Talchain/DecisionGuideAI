/**
 * DebugPanelV2 Component Tests
 *
 * Tests for the restructured 4-tab debug panel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DebugPanelV2 } from '../DebugPanelV2'
import { useDebugData } from '../hooks/useDebugData'

// Mock the useDebugData hook
vi.mock('../hooks/useDebugData', () => ({
  useDebugData: vi.fn(),
}))

const mockUseDebugData = vi.mocked(useDebugData)

// Default mock data
const defaultMockData = {
  overall: {
    status: 'success' as const,
    total_duration_ms: 2500,
    request_id: 'req-test-123',
  },
  services: {
    cee: {
      name: 'CEE',
      status: 200,
      success: true,
      duration_ms: 1200,
      endpoint: '/api/cee/extract',
    },
    plot: {
      name: 'PLoT',
      status: 200,
      success: true,
      duration_ms: 800,
      endpoint: '/api/plot/v2/run',
    },
    isl: null,
  },
  pipeline: {
    status: 'success' as const,
    total_duration_ms: 1100,
    stages: [],
    connectivity: {
      decision_count: 1,
      option_count: 2,
      goal_count: 1,
      factor_count: 3,
      edge_count: 5,
    },
  },
  payloads: {},
  gates: [],
  hasData: true,
}

// Mock the export utils
vi.mock('../utils/exportBundle', () => ({
  exportDebugBundle: vi.fn(),
  copyRequestId: vi.fn().mockResolvedValue(true),
}))

describe('DebugPanelV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDebugData.mockReturnValue(defaultMockData)
  })

  it('renders without crashing', () => {
    render(<DebugPanelV2 />)
    expect(screen.getByText('Debug Panel')).toBeInTheDocument()
  })

  it('displays status badge with OK status', () => {
    render(<DebugPanelV2 />)
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('renders all four tabs', () => {
    render(<DebugPanelV2 />)

    expect(screen.getByRole('tab', { name: 'Summary' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Data Flow' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pipeline' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Captured' })).toBeInTheDocument()
  })

  it('shows Summary tab by default', () => {
    render(<DebugPanelV2 />)

    const summaryTab = screen.getByRole('tab', { name: 'Summary' })
    expect(summaryTab).toHaveAttribute('aria-selected', 'true')
  })

  it('switches tabs when clicked', () => {
    render(<DebugPanelV2 />)

    const dataFlowTab = screen.getByRole('tab', { name: 'Data Flow' })
    fireEvent.click(dataFlowTab)

    expect(dataFlowTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'false')
  })

  it('renders Copy Request ID button', () => {
    render(<DebugPanelV2 />)

    const copyButton = screen.getByRole('button', { name: 'Copy request ID' })
    expect(copyButton).toBeInTheDocument()
    expect(copyButton).toHaveTextContent('Copy Request ID')
  })

  it('handles Copy Request ID click', async () => {
    const { copyRequestId } = await import('../utils/exportBundle')
    render(<DebugPanelV2 />)

    const copyButton = screen.getByRole('button', { name: 'Copy request ID' })
    fireEvent.click(copyButton)

    expect(copyRequestId).toHaveBeenCalledWith('req-test-123')
  })

  it('renders Export All button', () => {
    render(<DebugPanelV2 />)

    const exportButton = screen.getByRole('button', { name: 'Export all debug data' })
    expect(exportButton).toBeInTheDocument()
    expect(exportButton).toHaveTextContent('Export All')
  })

  it('handles Export All click', async () => {
    const { exportDebugBundle } = await import('../utils/exportBundle')
    render(<DebugPanelV2 />)

    const exportButton = screen.getByRole('button', { name: 'Export all debug data' })
    fireEvent.click(exportButton)

    expect(exportDebugBundle).toHaveBeenCalled()
  })

  it('renders close button when onClose provided', () => {
    const onClose = vi.fn()
    render(<DebugPanelV2 onClose={onClose} />)

    const closeButton = screen.getByRole('button', { name: 'Close debug panel' })
    expect(closeButton).toBeInTheDocument()

    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render close button when onClose not provided', () => {
    render(<DebugPanelV2 />)

    expect(screen.queryByRole('button', { name: 'Close debug panel' })).not.toBeInTheDocument()
  })

  it('has accessible tab navigation', () => {
    render(<DebugPanelV2 />)

    const tablist = screen.getByRole('tablist', { name: 'Debug panel tabs' })
    expect(tablist).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(5) // Summary, Data Flow, Pipeline, Captured, Payload Lab

    // Each tab should have aria-controls
    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute('aria-controls')
      expect(tab).toHaveAttribute('aria-selected')
    })
  })
})

describe('DebugPanelV2 with error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDebugData.mockReturnValue({
      overall: {
        status: 'error',
        total_duration_ms: 1500,
        request_id: 'req-error-456',
      },
      services: {
        cee: {
          name: 'CEE',
          status: 500,
          success: false,
          duration_ms: 1500,
          endpoint: '/api/cee/extract',
          error: 'Internal server error',
        },
        plot: null,
        isl: null,
      },
      pipeline: {
        status: 'error',
        stages: [],
        connectivity: {
          decision_count: 0,
          option_count: 0,
          goal_count: 0,
          factor_count: 0,
          edge_count: 0,
        },
      },
      payloads: {},
      gates: [],
      hasData: true,
    })
  })

  it('displays Error status badge in header', () => {
    render(<DebugPanelV2 />)
    // Look for the status badge in the header - there may be multiple "Error" texts
    const errorBadges = screen.getAllByText('Error')
    // At least one should exist (the header badge)
    expect(errorBadges.length).toBeGreaterThan(0)
    // The header badge should be visible
    expect(errorBadges[0]).toBeInTheDocument()
  })
})

describe('DebugPanelV2 with pending state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDebugData.mockReturnValue({
      overall: {
        status: 'pending',
        total_duration_ms: null,
        request_id: null,
      },
      services: {
        cee: null,
        plot: null,
        isl: null,
      },
      pipeline: {
        status: 'pending',
        stages: [],
        connectivity: {
          decision_count: 0,
          option_count: 0,
          goal_count: 0,
          factor_count: 0,
          edge_count: 0,
        },
      },
      payloads: {},
      gates: [],
      hasData: false,
    })
  })

  it('displays Pending status badge in header', () => {
    render(<DebugPanelV2 />)
    // Look for the status badge in the header
    const pendingBadges = screen.getAllByText('Pending')
    expect(pendingBadges.length).toBeGreaterThan(0)
    expect(pendingBadges[0]).toBeInTheDocument()
  })

  it('disables Export All when no data', () => {
    render(<DebugPanelV2 />)

    const exportButton = screen.getByRole('button', { name: 'Export all debug data' })
    expect(exportButton).toBeDisabled()
  })
})
