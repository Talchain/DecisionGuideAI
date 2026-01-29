/**
 * PreAnalysisReadinessPanel Tests
 *
 * Tests for the pre-analysis readiness panel that displays
 * quality scores, blocking issues, and coaching suggestions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreAnalysisReadinessPanel } from '../PreAnalysisReadinessPanel'

// Mock the hooks
vi.mock('../../../canvas/store', () => ({
  useCanvasStore: vi.fn((selector) => {
    const mockState = {
      nodes: [
        { id: 'node1', type: 'factor', data: { label: 'Cost Factor' } },
        { id: 'node2', type: 'option', data: { label: 'Option A' } },
        { id: 'node3', type: 'option', data: { label: 'Option B' } },
      ],
      edges: [
        { source: 'node1', target: 'node2' },
        { source: 'node1', target: 'node3' },
      ],
      ceeAnalysisReady: {
        status: 'ready',
        goal_node_id: 'goal1',
        options: [
          { id: 'node2', label: 'Option A', status: 'ready', interventions: {} },
          { id: 'node3', label: 'Option B', status: 'ready', interventions: {} },
        ],
      },
      setHighlightedNodes: vi.fn(),
    }
    return selector(mockState)
  }),
}))

vi.mock('../../../canvas/hooks/usePreRunValidation', () => ({
  usePreRunValidation: vi.fn(() => ({
    canRun: true,
    blockers: [],
    warnings: [],
  })),
}))

vi.mock('../../../canvas/hooks/useGraphReadiness', () => ({
  useGraphReadiness: vi.fn(() => ({
    readiness: {
      readiness_score: 85,
      readiness_level: 'strong',
      can_run_analysis: true,
      confidence_explanation: 'Your model has good structure and connections',
      improvements: [
        {
          category: 'completeness',
          action: 'Add risk factors',
          current_gap: '86% of connections use default weights',
          quality_impact: 5,
          target_quality: 90,
          priority: 'medium',
          effort_minutes: 10,
          affected_nodes: ['node1'],
        },
      ],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}))

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

describe('PreAnalysisReadinessPanel', () => {
  const mockOnAnalyse = vi.fn()
  const mockOnBlockersChange = vi.fn()
  const mockOnCanRunChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders quality header with score and level', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    // Should show quality level and score
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.getByText('(85%)')).toBeInTheDocument()
  })

  it('shows summary line with node, edge, and option counts in expanded breakdown', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    // Summary line is now inside the collapsed breakdown - expand it first
    const toggle = screen.getByText('Estimated breakdown')
    fireEvent.click(toggle)

    // Summary line shows counts for nodes, edges, and options
    expect(screen.getByText(/3 nodes/)).toBeInTheDocument()
    expect(screen.getByText(/2 edges/)).toBeInTheDocument()
    // Use more specific pattern to match summary line, not "All 2 options configured"
    expect(screen.getByText(/2 edges · 2 options/)).toBeInTheDocument()
  })

  it('shows "Analyse Now" button when ready', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    const button = screen.getByRole('button', { name: /run analysis/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
    expect(screen.getByText('Analyse Now')).toBeInTheDocument()
  })

  it('shows "Analyzing..." button when isAnalysing is true', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        isAnalysing={true}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    expect(screen.getByText("Analysing...")).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /analysis in progress/i })
    expect(button).toBeDisabled()
  })

  it('toggles quality breakdown when clicked', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    const toggle = screen.getByText('Estimated breakdown')
    fireEvent.click(toggle)

    // Should show breakdown bars
    expect(screen.getByText('Structure')).toBeInTheDocument()
    expect(screen.getByText('Coverage')).toBeInTheDocument()
    expect(screen.getByText('Causality')).toBeInTheDocument()
    expect(screen.getByText('Safety')).toBeInTheDocument()
  })

  it('shows ready state with option chips when no blockers', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    expect(screen.getByText('Ready to analyse')).toBeInTheDocument()
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
    expect(screen.getByText(/All 2 options configured/)).toBeInTheDocument()
  })

  it('shows coaching suggestions accordion', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    // Accordion should be visible (auto-expanded when no blockers)
    expect(screen.getByText(/Coaching Suggestions/)).toBeInTheDocument()
    // The 'completeness' category maps to "Refine influence weights" action
    expect(screen.getByText(/Refine influence weights/)).toBeInTheDocument()
  })

  it('calls onAnalyse when button is clicked', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    const button = screen.getByRole('button', { name: /run analysis/i })
    fireEvent.click(button)

    expect(mockOnAnalyse).toHaveBeenCalledTimes(1)
  })

  it('calls onCanRunChange with readiness state', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    expect(mockOnCanRunChange).toHaveBeenCalledWith(true)
  })

  it('calls onBlockersChange with blocker state', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={mockOnBlockersChange}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    // No blockers, should be called with false
    expect(mockOnBlockersChange).toHaveBeenCalledWith(false)
  })
})

describe('PreAnalysisReadinessPanel with blockers', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Override hook to return blockers
    const { usePreRunValidation } = await import('../../../canvas/hooks/usePreRunValidation')
    vi.mocked(usePreRunValidation).mockReturnValue({
      canRun: false,
      blockers: [
        {
          code: 'INTERVENTION_TARGET_NOT_FOUND',
          message: 'Option targets missing factor',
          affectedIds: ['node2'],
          action: { type: 'focus', label: 'Focus', nodeId: 'node1' },
        },
        {
          code: 'OPTIONS_NEED_MAPPING',
          message: '2 options need intervention values',
          affectedIds: ['node2', 'node3'],
        },
      ],
      warnings: [],
    })
  })

  it('shows "Fix N Issues First" button when blockers exist', async () => {
    const mockOnAnalyse = vi.fn()

    render(
      <PreAnalysisReadinessPanel
        onAnalyse={mockOnAnalyse}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Button should show blocker count
    expect(screen.getByText(/Fix.*Issue/i)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /fix issues/i })
    expect(button).toBeDisabled()
  })

  it('shows blocking issue cards with human-readable labels', async () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Should show human-readable title
    expect(screen.getByText('Options reference missing factor')).toBeInTheDocument()
  })

  it('shows max 3 issue cards with overflow count', async () => {
    // Override to return 5 blockers
    const { usePreRunValidation } = await import('../../../canvas/hooks/usePreRunValidation')
    vi.mocked(usePreRunValidation).mockReturnValue({
      canRun: false,
      blockers: [
        { code: 'A', message: 'Issue 1', affectedIds: ['n1'] },
        { code: 'B', message: 'Issue 2', affectedIds: ['n2'] },
        { code: 'C', message: 'Issue 3', affectedIds: ['n3'] },
        { code: 'D', message: 'Issue 4', affectedIds: ['n4'] },
        { code: 'E', message: 'Issue 5', affectedIds: ['n5'] },
      ],
      warnings: [],
    })

    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Should show overflow message
    expect(screen.getByText(/2 more issues? not shown/)).toBeInTheDocument()
  })
})

describe('PreAnalysisReadinessPanel empty state', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Override store to return empty nodes
    const { useCanvasStore } = await import('../../../canvas/store')
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const mockState = {
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        setHighlightedNodes: vi.fn(),
      }
      return selector(mockState)
    })
  })

  it('returns null when canvas is empty', () => {
    const { container } = render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    expect(container.firstChild).toBeNull()
  })
})

describe('PreAnalysisReadinessPanel readiness states', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  it('disables button when readiness.can_run_analysis is false', async () => {
    // Override readiness hook to return can_run_analysis: false
    const { useGraphReadiness } = await import('../../../canvas/hooks/useGraphReadiness')
    vi.mocked(useGraphReadiness).mockReturnValue({
      readiness: {
        readiness_score: 85,
        readiness_level: 'strong',
        can_run_analysis: false,
        confidence_explanation: 'Graph needs more data',
        improvements: [],
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Button should be disabled even without blockers
    const button = screen.getByRole('button', { name: /fix issues/i })
    expect(button).toBeDisabled()
  })

  it('calls onCanRunChange with false when readiness.can_run_analysis is false', async () => {
    const mockOnCanRunChange = vi.fn()

    const { useGraphReadiness } = await import('../../../canvas/hooks/useGraphReadiness')
    vi.mocked(useGraphReadiness).mockReturnValue({
      readiness: {
        readiness_score: 85,
        readiness_level: 'strong',
        can_run_analysis: false,
        confidence_explanation: 'Graph needs more data',
        improvements: [],
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={mockOnCanRunChange}
      />
    )

    expect(mockOnCanRunChange).toHaveBeenCalledWith(false)
  })
})

describe('PreAnalysisReadinessPanel coaching accordion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows collapsing coaching accordion when expanded', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    // Find and click the coaching accordion button
    const accordionButton = screen.getByRole('button', { name: /Coaching Suggestions/i })

    // Should start expanded (no blockers)
    expect(accordionButton).toHaveAttribute('aria-expanded', 'true')

    // Click to collapse
    fireEvent.click(accordionButton)

    // Should now be collapsed
    expect(accordionButton).toHaveAttribute('aria-expanded', 'false')

    // Click to expand again
    fireEvent.click(accordionButton)
    expect(accordionButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('has proper ARIA attributes on quality breakdown toggle', () => {
    render(
      <PreAnalysisReadinessPanel
        onAnalyse={vi.fn()}
        onBlockersChange={vi.fn()}
        onCanRunChange={vi.fn()}
      />
    )

    const toggle = screen.getByText('Estimated breakdown').closest('button')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'quality-breakdown-content')

    // Click to expand
    fireEvent.click(toggle!)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
